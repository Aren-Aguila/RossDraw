import { useEffect, useState, useRef } from 'react';
import { getStroke } from 'perfect-freehand';

// A math helper that turns a list of coordinates into a smooth SVG shape
function getSvgPathFromStroke(stroke) {
  if (!stroke.length) return '';
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...stroke[0], 'Q']
  );
  d.push('Z');
  return d.join(' ');
}

export default function LiveCanvas({ socketRef, roomId, role }) {
  const [strokes, setStrokes] = useState([]); // All finished strokes
  const [currentStroke, setCurrentStroke] = useState([]); // The stroke actively being drawn
  
  const isDrawing = useRef(false);
  const svgRef = useRef(null);

  // 1. Listen for the artist's live strokes coming from Flask
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.on('receive_draw_update', (data) => {
      if (data.type === 'start' || data.type === 'move') {
        setCurrentStroke(data.points);
      } else if (data.type === 'end') {
        setStrokes((prev) => [...prev, data.points]);
        setCurrentStroke([]);
      }
    });

    return () => socket.off('receive_draw_update');
  }, [socketRef]);

  // 2. Capture coordinates accurately inside the box
  const getCoordinates = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    return [
      e.clientX - rect.left,
      e.clientY - rect.top,
      e.pressure || 0.5 // Automatically grabs stylus pressure if using an iPad/Tablet!
    ];
  };

  // 3. Drawing Handlers (LOCKED if the user is the Engineer)
  const handlePointerDown = (e) => {
    if (role !== 'ai') return; 
    e.target.setPointerCapture(e.pointerId); // Keeps drawing even if mouse leaves the box fast
    isDrawing.current = true;
    const pt = getCoordinates(e);
    setCurrentStroke([pt]);
    socketRef.current.emit('draw_update', { room_id: roomId, type: 'start', points: [pt] });
  };

  const handlePointerMove = (e) => {
    if (!isDrawing.current || role !== 'ai') return;
    const pt = getCoordinates(e);
    setCurrentStroke((prev) => {
      const newStroke = [...prev, pt];
      // Stream the live coordinates to the Engineer!
      socketRef.current.emit('draw_update', { room_id: roomId, type: 'move', points: newStroke });
      return newStroke;
    });
  };

  const handlePointerUp = () => {
    if (!isDrawing.current || role !== 'ai') return;
    isDrawing.current = false;
    setStrokes((prev) => [...prev, currentStroke]);
    socketRef.current.emit('draw_update', { room_id: roomId, type: 'end', points: currentStroke });
    setCurrentStroke([]);
  };

  // 4. Render the Engine
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', borderRadius: '10px' }}>
      
      {/* Dynamic Status Badges */}
      {role === 'ai' ? (
        <div style={{ position: 'absolute', top: 10, left: 10, background: '#d63384', color: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          ✏️ Canvas Unlocked
        </div>
      ) : (
        <div style={{ position: 'absolute', top: 10, left: 10, background: '#0066cc', color: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          👁️ Live Viewer Mode
        </div>
      )}

      {/* The Actual Drawing Surface */}
      <svg
        ref={svgRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ width: '100%', height: '100%', touchAction: 'none', cursor: role === 'ai' ? 'crosshair' : 'default' }}
      >
        {/* Render all finished strokes */}
        {strokes.map((stroke, i) => (
          <path key={i} d={getSvgPathFromStroke(getStroke(stroke, { size: 12, thinning: 0.5, smoothing: 0.5, streamline: 0.5 }))} fill="#111" />
        ))}
        {/* Render the active stroke being drawn RIGHT NOW */}
        {currentStroke.length > 0 && (
          <path d={getSvgPathFromStroke(getStroke(currentStroke, { size: 12, thinning: 0.5, smoothing: 0.5, streamline: 0.5 }))} fill="#111" />
        )}
      </svg>
    </div>
  );
}