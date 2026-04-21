import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Studio from './pages/Studio';

function App() {
  return (
    <BrowserRouter>
      <div style={{ fontFamily: 'sans-serif', padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* You could put a persistent Navbar here later! */}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/room/:roomId" element={<Studio />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;