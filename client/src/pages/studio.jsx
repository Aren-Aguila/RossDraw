import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import LiveCanvas from './components/livecanvas.jsx';

const ChatHistory = ({ messages }) => (
  <div style={{ flex: 1, backgroundColor: '#fafafa', marginBottom: '10px', borderRadius: '6px', padding: '10px', overflowY: 'auto', border: '1px solid #eee' }}>
    {messages.map((msg, index) => (
      <div key={index} style={{ marginBottom: '8px', fontSize: '14px' }}>
        <strong style={{ color: msg.sender === 'System' ? '#aaa' : '#0066cc' }}>
          {msg.sender}: 
        </strong> {msg.text}
      </div>
    ))}
  </div>
);

function Studio() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  
  const location = useLocation();
  const { promptText, role } = location.state || {}; 
  
  const socketRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  
  const [isSocketReady, setIsSocketReady] = useState(false);

  useEffect(() => {
    socketRef.current = io('http://localhost:5000');

    socketRef.current.on('connect', () => {
      setIsSocketReady(true); 

      socketRef.current.emit('join_room', { room_id: roomId });

      if (promptText && role === 'engineer') {
        socketRef.current.emit('submit_prompt', {
          id: roomId.replace('_private', ''),
          prompt: promptText
        });
      }
    });

    // We successfully restored this missing section!
    socketRef.current.on('receive_message', (data) => {
      setMessages((prevMessages) => [...prevMessages, data]);
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [roomId, promptText, role]); // <-- The crucial missing bracket!

  const sendMessage = (e) => {
    e.preventDefault(); 
    if (chatInput.trim() !== '') {
      socketRef.current.emit('send_message', { room_id: roomId, text: chatInput });
      setChatInput(''); 
    }
  };

  const handlePublish = () => {
    const confirmPublish = window.confirm("Are you sure you're done? This will publish the drawing to the gallery.");
    if (confirmPublish) {
      alert("Artwork published!");
      navigate('/');
    }
  };

  return (
    <div style={{ width: role === 'engineer' ? '75vw' : '1200px', maxWidth: '95%', margin: '0 auto', padding: '20px 0' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={() => navigate('/')} style={{ padding: '8px 16px', cursor: 'pointer' }}>← Leave Room</button>
        {role === 'ai' && (
          <button onClick={handlePublish} style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            ✨ Finish & Publish
          </button>
        )}
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>🔒 Private 1-on-1 Studio</h2>
        <h3 style={{ margin: '10px 0', color: '#0066cc', fontStyle: 'italic', fontSize: '24px' }}>
          "{promptText || 'Loading prompt...'}"
        </h3>
        <p style={{ color: '#999', fontSize: '14px', margin: 0 }}>
          Room ID: <strong>{roomId.replace('_private', '')}</strong>
        </p>
      </div>

      {role === 'engineer' ? (
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ width: '100%', height: '60vh', minHeight: '400px', backgroundColor: '#fff', border: '2px solid #ccc', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.05)' }}>
            {isSocketReady && <LiveCanvas socketRef={socketRef} roomId={roomId} role={role} />}
          </div>

          <div style={{ width: '100%', height: '250px', border: '1px solid #eaeaea', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ margin: '0 0 10px 0' }}>Studio Chat</h4>
            <ChatHistory messages={messages} />
            <form onSubmit={sendMessage} style={{ display: 'flex', gap: '5px' }}>
              <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Give the AI artist feedback..." style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
              <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Send</button>
            </form>
          </div>

        </div>

      ) : (

        <div style={{ display: 'flex', gap: '20px' }}>
          
          <div style={{ flex: 3, height: '700px', backgroundColor: '#fff', border: '2px solid #ccc', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.05)' }}>
            {isSocketReady && <LiveCanvas socketRef={socketRef} roomId={roomId} role={role} />}
          </div>

          <div style={{ flex: 1, height: '700px', border: '1px solid #eaeaea', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ margin: '0 0 10px 0' }}>Engineer Feedback</h4>
            <ChatHistory messages={messages} />
            <div style={{ padding: '15px', backgroundColor: '#fff0f5', borderRadius: '6px', textAlign: 'center', color: '#d63384', fontSize: '14px', border: '1px solid #f8b4d9' }}>
              ⚠️ As the Human AI, your chat is disabled. Let your art do the talking!
            </div>
          </div>

        </div>

      )}
      
    </div>
  );
}

export default Studio;