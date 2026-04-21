from flask import Flask, request # <-- Added request here
from flask_socketio import SocketIO, emit, join_room
from flask_cors import CORS

app = Flask(__name__)
app.config['SECRET_KEY'] = 'my_super_secret_key'
CORS(app)

socketio = SocketIO(app, cors_allowed_origins="*")

# NEW: A dictionary to remember which user (sid) submitted which prompt
guest_prompts = {}

# --- WEBSOCKET EVENTS ---

@socketio.on('connect')
def handle_connect():
    print(f"🟢 A user connected: {request.sid}")

@socketio.on('join_room')
def handle_join(data):
    room = data['room_id']
    join_room(room)
    print(f"🚪 User {request.sid} joined room: {room}")
    
    emit('receive_message', {
        'sender': 'System', 
        'text': 'A user has entered the studio.'
    }, to=room)

@socketio.on('send_message')
def handle_chat(data):
    room = data['room_id']
    message_text = data['text']
    
    emit('receive_message', {
        'sender': 'Collaborator', 
        'text': message_text
    }, to=room)
    
@socketio.on('draw_update')
def handle_draw_update(data):
    room = data['room_id']
    # include_self=False ensures the artist's own drawing isn't bounced back to them
    emit('receive_draw_update', data, to=room, include_self=False)

@socketio.on('submit_prompt')
def handle_new_prompt(data):
    # NEW: Link the prompt ID to this specific user's socket connection
    guest_prompts[request.sid] = data['id']
    
    print(f"📢 Global Broadcast - New Prompt: {data['prompt']}")
    emit('receive_new_prompt', data, broadcast=True)

# NEW: The Auto-Cleanup function!
@socketio.on('disconnect')
def handle_disconnect():
    print(f"🔴 User disconnected: {request.sid}")
    
    # Check if the person who just left was a Guest waiting for art
    if request.sid in guest_prompts:
        prompt_id = guest_prompts[request.sid]
        print(f"🗑️ Guest left! Deleting orphaned prompt: {prompt_id}")
        
        # Tell all the 'Human AIs' to remove this prompt from their screen
        emit('remove_prompt', {'id': prompt_id}, broadcast=True)
        
        # Remove the tracking record from server memory
        del guest_prompts[request.sid]

# --- SERVER STARTUP ---

if __name__ == '__main__':
    print("🚀 Starting Flask WebSocket Server on port 5000...")
    socketio.run(app, debug=True, port=5000)