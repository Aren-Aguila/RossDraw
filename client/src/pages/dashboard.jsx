import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from "@clerk/clerk-react";

function Dashboard() {
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const { user } = useUser(); 
  
  const [role, setRole] = useState(null);
  const [newPrompt, setNewPrompt] = useState('');
  
  // State for our Database arrays
  const [requests, setRequests] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [myPrompts, setMyPrompts] = useState([]); // NEW: Tracks the user's history
  
  const [zoomedImage, setZoomedImage] = useState(null);

  useEffect(() => {
    socketRef.current = io('http://localhost:5000');

    socketRef.current.on('connect', () => {
      // 1. Fetch the gallery
      socketRef.current.emit('request_gallery');
      // 2. Fetch the pending AI queue
      socketRef.current.emit('request_active_prompts'); 
      // 3. If logged in, fetch personal history
      if (user) {
        socketRef.current.emit('request_my_prompts', { author_id: user.id });
      }
    });

    socketRef.current.on('load_active_prompts', (data) => setRequests(data));
    socketRef.current.on('load_my_prompts', (data) => setMyPrompts(data));
    socketRef.current.on('gallery_update', (data) => setGallery(data));

    socketRef.current.on('receive_new_prompt', (newRequestData) => {
      setRequests((prev) => [newRequestData, ...prev]);
      // If the prompt belongs to this user, update their history list too!
      if (user && newRequestData.author_id === user.id) {
        setMyPrompts((prev) => [{ id: newRequestData.id, prompt: newRequestData.prompt, status: 'pending' }, ...prev]);
      }
    });

    socketRef.current.on('remove_prompt', (dataToRemove) => {
      setRequests((prev) => prev.filter(req => req.id !== dataToRemove.id));
      // If an artwork was published, mark it as completed in personal history
      setMyPrompts((prev) => 
        prev.map(p => p.id === dataToRemove.id ? { ...p, status: 'completed' } : p)
      );
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [user]);

  const handleAccept = (requestId, promptString) => {
    navigate(`/room/${requestId}_private`, { 
      state: { promptText: promptString, role: 'ai' } 
    });
  };

  const handleRequestSubmit = (e) => {
    e.preventDefault();
    if (newPrompt.trim() !== '') {
      const uniqueId = `req_${Date.now()}`;
      const authorId = user ? user.id : 'guest';
      
      navigate(`/room/${uniqueId}_private`, { 
        state: { 
          promptText: newPrompt, 
          role: 'engineer',
          authorId: authorId 
        } 
      });
    }
  };

  const handleVote = (id, type) => {
    socketRef.current.emit('vote_artwork', { id, type });
  };

  // --- VIEW 1: HOME PAGE ---
  if (!role) {
    return (
      <div style={{ maxWidth: '900px', margin: '5vh auto', padding: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '60px', position: 'relative' }}>
          
          <div style={{ position: 'absolute', top: 0, right: 0 }}>
            <SignedOut>
              <SignInButton mode="modal">
                <button style={{ padding: '8px 16px', backgroundColor: '#111', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Sign In</button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>

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

        <div>
          <h2 style={{ borderBottom: '2px solid #eaeaea', paddingBottom: '10px', color: '#333' }}>🖼️ Community Gallery</h2>
          {gallery.length === 0 ? (
            <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', padding: '40px' }}>No artworks published yet. Be the first!</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', marginTop: '20px' }}>
              {gallery.map((art) => (
                <div key={art.id} style={{ backgroundColor: '#fafafa', padding: '20px', borderRadius: '12px', border: '1px solid #eee', boxShadow: '0 4px 10px rgba(0,0,0,0.03)' }}>
                  <div onClick={() => setZoomedImage(art.image)} style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '15px', overflow: 'hidden', cursor: 'zoom-in', transition: 'transform 0.2s', height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={art.image} alt={art.prompt} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                  </div>
                  <h3 style={{ margin: '0 0 10px 0', fontStyle: 'italic', color: '#222', fontSize: '20px' }}>"{art.prompt}"</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button onClick={() => handleVote(art.id, 'like')} style={{ padding: '8px 12px', backgroundColor: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe', borderRadius: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}>👍 {art.likes}</button>
                    <button onClick={() => handleVote(art.id, 'dislike')} style={{ padding: '8px 12px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}>👎 {art.dislikes}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {zoomedImage && (
          <div onClick={() => setZoomedImage(null)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', padding: '40px', boxSizing: 'border-box' }}>
            <img src={zoomedImage} style={{ width: '90vw', height: '90vh', objectFit: 'contain', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }} alt="Zoomed Artwork" />
          </div>
        )}
      </div>
    );
  }

  // --- VIEW 2: ENGINEER TERMINAL ---
  if (role === 'engineer') {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
        <button onClick={() => setRole(null)} style={{ background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer', fontSize: '16px', padding: '0 0 20px 0' }}>← Back to Home</button>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '30px', color: '#111' }}>⌨️ Engineer Terminal</h1>

        <div style={{ backgroundColor: '#f0f4f8', padding: '30px', borderRadius: '12px', marginBottom: '40px' }}>
          <h3 style={{ marginTop: 0, color: '#333' }}>Inject New Prompt</h3>
          <form onSubmit={handleRequestSubmit} style={{ display: 'flex', gap: '10px' }}>
            <input type="text" value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} placeholder="Describe the image you want generated..." style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '16px' }} required />
            <button type="submit" style={{ padding: '12px 24px', backgroundColor: '#0066cc', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>Execute →</button>
          </form>
        </div>

        {/* NEW: PERSONAL HISTORY UI */}
        <div>
          <h3 style={{ borderBottom: '2px solid #eaeaea', paddingBottom: '10px', color: '#333' }}>My Prompt History</h3>
          {!user ? (
            <p style={{ color: '#888', fontStyle: 'italic', padding: '20px 0' }}>Sign in with Clerk to track your generated prompts!</p>
          ) : myPrompts.length === 0 ? (
            <p style={{ color: '#888', fontStyle: 'italic', padding: '20px 0' }}>You haven't submitted any prompts yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {myPrompts.map(p => (
                <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px', backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '8px', marginBottom: '10px' }}>
                  <span style={{ fontWeight: '500' }}>"{p.prompt}"</span>
                  {p.status === 'completed' ? (
                    <span style={{ color: '#28a745', fontWeight: 'bold', fontSize: '14px' }}>✓ Completed</span>
                  ) : (
                    <span style={{ color: '#d63384', fontWeight: 'bold', fontSize: '14px' }}>⏳ Waiting for AI...</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    );
  }

  // --- VIEW 3: AI QUEUE ---
  if (role === 'ai') {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
        <button onClick={() => setRole(null)} style={{ background: 'none', border: 'none', color: '#d63384', cursor: 'pointer', fontSize: '16px', padding: '0 0 20px 0' }}>← Back to Home</button>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '30px', color: '#111' }}>🧠 Processing Queue</h1>

        <div>
          <p style={{ color: '#666', fontSize: '1.2rem', marginBottom: '20px' }}>Select an active prompt to begin generation.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            {requests.map((req) => (
              <div key={req.id} style={{ border: '2px solid #eaeaea', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', textAlign: 'center', backgroundColor: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <p style={{ fontSize: '20px', fontWeight: '500', margin: '0 0 20px 0', color: '#333' }}>"{req.prompt}"</p>
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