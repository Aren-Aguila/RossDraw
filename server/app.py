from flask import Flask, request
from flask_socketio import SocketIO, emit, join_room
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SECRET_KEY'] = 'my_super_secret_key'

# Configure the SQLite database file
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///canvas.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# --- DATABASE SCHEMA ---
class Prompt(db.Model):
    id = db.Column(db.String(50), primary_key=True)
    text = db.Column(db.String(500), nullable=False)
    author_id = db.Column(db.String(100), nullable=False) # Clerk ID
    status = db.Column(db.String(20), default='pending')  # 'pending' or 'completed'

class Artwork(db.Model):
    id = db.Column(db.String(50), primary_key=True)
    prompt_id = db.Column(db.String(50), nullable=False) 
    prompt_text = db.Column(db.String(500), nullable=False)
    image_data = db.Column(db.Text, nullable=False)
    likes = db.Column(db.Integer, default=0)
    dislikes = db.Column(db.Integer, default=0)

# Create the tables if they don't exist
with app.app_context():
    db.create_all()

# --- WEBSOCKET EVENTS ---

@socketio.on('connect')
def handle_connect():
    print(f"🟢 A user connected: {request.sid}")

@socketio.on('join_room')
def handle_join(data):
    room = data['room_id']
    join_room(room)
    emit('receive_message', {'sender': 'System', 'text': 'A user has entered the studio.'}, to=room)

@socketio.on('send_message')
def handle_chat(data):
    emit('receive_message', {'sender': 'Collaborator', 'text': data['text']}, to=data['room_id'])

@socketio.on('draw_update')
def handle_draw_update(data):
    emit('receive_draw_update', data, to=data['room_id'], include_self=False)

@socketio.on('request_review')
def handle_request_review(data):
    emit('review_requested', data, to=data['room_id'], include_self=False)

@socketio.on('review_response')
def handle_review_response(data):
    emit('review_result', data, to=data['room_id'], include_self=False)

# --- PERMANENT PROMPT PIPELINE ---

@socketio.on('submit_prompt')
def handle_new_prompt(data):
    # Save the prompt permanently to the database
    new_prompt = Prompt(
        id=data['id'], 
        text=data['prompt'], 
        author_id=data.get('author_id', 'guest')
    )
    db.session.add(new_prompt)
    db.session.commit()

    print(f"📢 DB SAVED - New Prompt: {data['prompt']}")
    emit('receive_new_prompt', data, broadcast=True)

@socketio.on('request_active_prompts')
def handle_request_prompts():
    # Send only 'pending' prompts to the AI's queue
    pending = Prompt.query.filter_by(status='pending').all()
    prompts_data = [{'id': p.id, 'prompt': p.text, 'author_id': p.author_id} for p in pending]
    emit('load_active_prompts', prompts_data, to=request.sid)

@socketio.on('request_my_prompts')
def handle_my_prompts(data):
    # Let the Engineer fetch their personal history
    author_id = data.get('author_id')
    my_prompts = Prompt.query.filter_by(author_id=author_id).order_by(Prompt.id.desc()).all()
    prompts_data = [{'id': p.id, 'prompt': p.text, 'status': p.status} for p in my_prompts]
    emit('load_my_prompts', prompts_data, to=request.sid)

# --- PERMANENT GALLERY PIPELINE ---

@socketio.on('publish_artwork')
def handle_publish(data):
    prompt_id = data['room_id'].replace('_private', '')

    # 1. Save the image to the database
    new_art = Artwork(
        id=data['room_id'],
        prompt_id=prompt_id,
        prompt_text=data['prompt'],
        image_data=data['image_data']
    )
    db.session.add(new_art)

    # 2. Find the original prompt and mark it as 'completed'
    prompt = Prompt.query.get(prompt_id)
    if prompt:
        prompt.status = 'completed'

    db.session.commit()
    print(f"🖼️ DB SAVED - Artwork published: {data['prompt']}")
    
    # Broadcast the updated gallery to everyone
    gallery = Artwork.query.order_by(Artwork.id.desc()).all()
    gallery_data = [{'id': a.id, 'prompt': a.prompt_text, 'image': a.image_data, 'likes': a.likes, 'dislikes': a.dislikes} for a in gallery]
    emit('gallery_update', gallery_data, broadcast=True)

    # Tell the AIs to remove this prompt from their queue
    emit('remove_prompt', {'id': prompt_id}, broadcast=True)

@socketio.on('request_gallery')
def handle_request_gallery():
    gallery = Artwork.query.order_by(Artwork.id.desc()).all()
    gallery_data = [{'id': a.id, 'prompt': a.prompt_text, 'image': a.image_data, 'likes': a.likes, 'dislikes': a.dislikes} for a in gallery]
    emit('gallery_update', gallery_data, to=request.sid)

@socketio.on('vote_artwork')
def handle_vote(data):
    art = Artwork.query.get(data['id'])
    if art:
        if data['type'] == 'like':
            art.likes += 1
        elif data['type'] == 'dislike':
            art.dislikes += 1
        db.session.commit()
        
        gallery = Artwork.query.order_by(Artwork.id.desc()).all()
        gallery_data = [{'id': a.id, 'prompt': a.prompt_text, 'image': a.image_data, 'likes': a.likes, 'dislikes': a.dislikes} for a in gallery]
        emit('gallery_update', gallery_data, broadcast=True)

if __name__ == '__main__':
    print("🚀 Starting Flask WebSocket Server with SQLite Database...")
    socketio.run(app, debug=True, port=5000)