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
  // NEW: We extract the authorId from the state
  const { promptText, role, authorId } = location.state || {}; 
  
  const socketRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  
  const [isSocketReady, setIsSocketReady] = useState(false);
  const [reviewState, setReviewState] = useState('drawing');

  useEffect(() => {
    socketRef.current = io('http://localhost:5000');

    socketRef.current.on('connect', () => {
      // FIX: This must stay INSIDE the connect block!
      setIsSocketReady(true); 
      
      socketRef.current.emit('join_room', { room_id: roomId });

      if (promptText && role === 'engineer') {
        // NEW: We send the authorId directly to Flask!
        socketRef.current.emit('submit_prompt', {
          id: roomId.replace('_private', ''),
          prompt: promptText,
          author_id: authorId 
        });
      }
    });

    socketRef.current.on('receive_message', (data) => {
      setMessages((prevMessages) => [...prevMessages, data]);
    });

    socketRef.current.on('review_requested', () => {
      setReviewState('reviewing');
    });

    socketRef.current.on('review_result', (data) => {
      if (data.status === 'approved') {
        alert("🎉 The Prompt Engineer approved your artwork! It has been published.");
        navigate('/');
      } else {
        alert("The Engineer requested changes. Check the chat!");
        setReviewState('drawing');
      }
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [roomId, promptText, role, authorId, navigate]);

  const sendMessage = (e) => {
    e.preventDefault(); 
    if (chatInput.trim() !== '') {
      socketRef.current.emit('send_message', { room_id: roomId, text: chatInput });
      setChatInput(''); 
    }
  };

  const handleSendReview = () => {
    if (window.confirm("Send this to the Engineer for final approval?")) {
      setReviewState('reviewing');
      socketRef.current.emit('request_review', { room_id: roomId });
    }
  };

  const handleApprove = () => {
    const svgElement = document.getElementById('live-canvas-svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const encodedData = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgData);

    socketRef.current.emit('publish_artwork', { 
      room_id: roomId, 
      prompt: promptText,
      image_data: encodedData
    });

    socketRef.current.emit('review_response', { room_id: roomId, status: 'approved' });

    alert("Artwork approved and published to the gallery!");
    navigate('/');
  };

  const handleReject = () => {
    const feedback = window.prompt("What changes would you like the AI to make?");
    if (feedback && feedback.trim() !== '') {
      socketRef.current.emit('send_message', { room_id: roomId, text: `[REVISION REQUESTED] ${feedback}` });
      socketRef.current.emit('review_response', { room_id: roomId, status: 'rejected' });
      setReviewState('drawing');
    }
  };

  return (
    <div style={{ width: role === 'engineer' ? '60vw' : '1200px', maxWidth: '95%', margin: '0 auto', padding: '20px 0' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={() => navigate('/')} style={{ padding: '8px 16px', cursor: 'pointer' }}>← Leave Room</button>
        
        {role === 'ai' && reviewState === 'drawing' && (
          <button onClick={handleSendReview} style={{ padding: '10px 20px', backgroundColor: '#0066cc', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            📤 Send for Review
          </button>
        )}
        {role === 'ai' && reviewState === 'reviewing' && (
          <span style={{ padding: '10px 20px', backgroundColor: '#f8f9fa', color: '#d63384', border: '1px solid #d63384', borderRadius: '6px', fontWeight: 'bold' }}>
            ⏳ Waiting for Engineer's Review...
          </span>
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

      {role === 'engineer' && reviewState === 'reviewing' && (
        <div style={{ backgroundColor: '#fff3cd', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #ffeeba', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
          <div>
            <h3 style={{ margin: '0 0 5px 0', color: '#856404' }}>Review Requested!</h3>
            <p style={{ margin: 0, color: '#666' }}>The Human AI has submitted their final artwork. Do you approve?</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleReject} style={{ padding: '10px 20px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              Request Changes
            </button>
            <button onClick={handleApprove} style={{ padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              ✓ Approve & Publish
            </button>
          </div>
        </div>
      )}

      {role === 'engineer' ? (
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ width: '100%', height: '700px', backgroundColor: '#fff', border: '2px solid #ccc', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.05)' }}>
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
          <div style={{ flex: 3, height: '700px', backgroundColor: '#fff', border: '2px solid #ccc', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.05)' }}>
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