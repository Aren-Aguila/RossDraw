import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

function Dashboard() {
  const navigate = useNavigate();
  const socketRef = useRef(null);
  
  const [role, setRole] = useState(null);
  const [newPrompt, setNewPrompt] = useState('');

  const [requests, setRequests] = useState([
    { id: 'req_101', prompt: 'Edgy cyberpunk character with a neon jacket' },
    { id: 'req_102', prompt: 'A cute frog sitting on a mushroom' },
    { id: 'req_103', prompt: 'Landscape of a desolate alien planet' },
  ]);

  const mockGallery = [
    { id: 'art_001', prompt: 'A cup of black coffee on a wooden desk', imageUrl: '☕' }
  ];

  useEffect(() => {
    socketRef.current = io('http://localhost:5000');

    socketRef.current.on('receive_new_prompt', (newRequestData) => {
      setRequests((prevRequests) => [newRequestData, ...prevRequests]);
    });

    socketRef.current.on('remove_prompt', (dataToRemove) => {
      setRequests((prevRequests) => 
        prevRequests.filter(req => req.id !== dataToRemove.id)
      );
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  // UPGRADE 1: The AI now packs the prompt text and their 'ai' role into the luggage
  const handleAccept = (requestId, promptString) => {
    navigate(`/room/${requestId}_private`, { 
      state: { promptText: promptString, role: 'ai' } 
    });
  };

  // UPGRADE 2: The Engineer packs the prompt text and their 'engineer' role
  const handleRequestSubmit = (e) => {
    e.preventDefault();
    if (newPrompt.trim() !== '') {
      const uniqueId = `req_${Date.now()}`;
      navigate(`/room/${uniqueId}_private`, { 
        state: { promptText: newPrompt, role: 'engineer' } 
      });
    }
  };

  if (!role) {
    return (
      <div style={{ maxWidth: '900px', margin: '10vh auto', padding: '20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '3.5rem', marginBottom: '10px', color: '#111' }}>Human Canvas</h1>
        <p style={{ color: '#666', fontSize: '1.4rem', marginBottom: '50px' }}>Choose your role for this session.</p>
        
        <div style={{ display: 'flex', gap: '30px', justifyContent: 'center' }}>
          <div onClick={() => setRole('engineer')} style={{ flex: 1, backgroundColor: '#f0f4f8', padding: '50px 30px', borderRadius: '16px', cursor: 'pointer', border: '2px solid transparent', transition: '0.2s', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '2rem', margin: '0 0 15px 0', color: '#0066cc' }}>⌨️ Prompt Engineer</h2>
            <p style={{ fontSize: '1.1rem', color: '#555', margin: 0 }}>I have an idea. I want to submit a prompt and watch it come to life.</p>
          </div>
          <div onClick={() => setRole('ai')} style={{ flex: 1, backgroundColor: '#fff0f5', padding: '50px 30px', borderRadius: '16px', cursor: 'pointer', border: '2px solid transparent', transition: '0.2s', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '2rem', margin: '0 0 15px 0', color: '#d63384' }}>🧠 Human AI</h2>
            <p style={{ fontSize: '1.1rem', color: '#555', margin: 0 }}>I am the generator. I want to accept a prompt and draw it live.</p>
          </div>
        </div>
      </div>
    );
  }

  if (role === 'engineer') {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
        <button onClick={() => setRole(null)} style={{ background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer', fontSize: '16px', padding: '0 0 20px 0' }}>← Switch Role</button>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '30px', color: '#111' }}>⌨️ Engineer Terminal</h1>

        <div style={{ backgroundColor: '#f0f4f8', padding: '30px', borderRadius: '12px', marginBottom: '40px' }}>
          <h3 style={{ marginTop: 0, color: '#333' }}>Inject New Prompt</h3>
          <form onSubmit={handleRequestSubmit} style={{ display: 'flex', gap: '10px' }}>
            <input type="text" value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} placeholder="Describe the image you want generated..." style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '16px' }} required />
            <button type="submit" style={{ padding: '12px 24px', backgroundColor: '#0066cc', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>Execute →</button>
          </form>
        </div>

        <div>
          <h2 style={{ borderBottom: '2px solid #eaeaea', paddingBottom: '10px', color: '#333' }}>🖼️ Output Gallery</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
            {mockGallery.map((art) => (
              <div key={art.id} style={{ backgroundColor: '#fafafa', padding: '20px', borderRadius: '12px', border: '1px solid #eee' }}>
                <div style={{ height: '200px', backgroundColor: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', marginBottom: '15px', fontSize: '40px' }}>{art.imageUrl}</div>
                <p style={{ margin: 0, fontStyle: 'italic', color: '#555', fontSize: '18px' }}>Prompt: "{art.prompt}"</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (role === 'ai') {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
        <button onClick={() => setRole(null)} style={{ background: 'none', border: 'none', color: '#d63384', cursor: 'pointer', fontSize: '16px', padding: '0 0 20px 0' }}>← Switch Role</button>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '30px', color: '#111' }}>🧠 Processing Queue</h1>

        <div>
          <p style={{ color: '#666', fontSize: '1.2rem', marginBottom: '20px' }}>Select an active prompt to begin generation.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            {requests.map((req) => (
              <div key={req.id} style={{ border: '2px solid #eaeaea', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', textAlign: 'center', backgroundColor: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <p style={{ fontSize: '20px', fontWeight: '500', margin: '0 0 20px 0', color: '#333' }}>"{req.prompt}"</p>
                {/* UPGRADE 3: Pass the prompt string into the handleAccept function */}
                <button onClick={() => handleAccept(req.id, req.prompt)} style={{ padding: '12px 24px', width: '100%', cursor: 'pointer', backgroundColor: '#d63384', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px' }}>
                  Generate Canvas →
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
}

export default Dashboard;