import { useEffect, useState, useRef } from 'react';
import { getStroke } from 'perfect-freehand';

// Math helper for the Brush Tool (The "Donut" outline)
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

// Math helper for the Lasso Fill Tool (The solid "Pancake")
function getSvgPathFromRawPoints(points) {
  if (!points || points.length === 0) return '';
  const d = points.map((pt, i) => (i === 0 ? 'M' : 'L') + ` ${pt[0]} ${pt[1]}`);
  d.push('Z');
  return d.join(' ');
}

export default function LiveCanvas({ socketRef, roomId, role }) {
  const [strokes, setStrokes] = useState([]); 
  const [redoStack, setRedoStack] = useState([]); 
  const [currentStroke, setCurrentStroke] = useState(null); 
  
  const [bgColor, setBgColor] = useState('#ffffff');
  const [brushColor, setBrushColor] = useState('#111111');
  const [brushSize, setBrushSize] = useState(12);
  
  // Track which tool is currently active
  const [activeTool, setActiveTool] = useState('brush'); // 'brush' or 'lasso'

  const isDrawing = useRef(false);
  const svgRef = useRef(null);

  const palette = ['#111111', '#e63946', '#2a9d8f', '#0077b6', '#f4a261', bgColor];

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.on('receive_draw_update', (data) => {
      if (data.type === 'start' || data.type === 'move') {
        setCurrentStroke({ points: data.points, color: data.color, size: data.size, tool: data.tool });
      } else if (data.type === 'end') {
        setStrokes((prev) => [...prev, { points: data.points, color: data.color, size: data.size, tool: data.tool }]);
        setCurrentStroke(null);
      } else if (data.type === 'bg') {
        setBgColor(data.color);
      } else if (data.type === 'sync') {
        setStrokes(data.strokes);
      }
    });

    return () => socket.off('receive_draw_update');
  }, [socketRef]);

  const getCoordinates = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top, e.pressure || 0.5];
  };

  const handlePointerDown = (e) => {
    if (role !== 'ai') return; 
    e.target.setPointerCapture(e.pointerId); 
    isDrawing.current = true;
    const pt = getCoordinates(e);
    
    setRedoStack([]);
    setCurrentStroke({ points: [pt], color: brushColor, size: brushSize, tool: activeTool });
    socketRef.current.emit('draw_update', { room_id: roomId, type: 'start', points: [pt], color: brushColor, size: brushSize, tool: activeTool });
  };

  const handlePointerMove = (e) => {
    if (!isDrawing.current || role !== 'ai') return;
    const pt = getCoordinates(e);
    
    setCurrentStroke((prev) => {
      const newPoints = [...prev.points, pt];
      socketRef.current.emit('draw_update', { room_id: roomId, type: 'move', points: newPoints, color: brushColor, size: brushSize, tool: activeTool });
      return { ...prev, points: newPoints };
    });
  };

  const handlePointerUp = () => {
    if (!isDrawing.current || role !== 'ai') return;
    isDrawing.current = false;
    if (currentStroke) {
      setStrokes((prev) => [...prev, currentStroke]);
      socketRef.current.emit('draw_update', { room_id: roomId, type: 'end', points: currentStroke.points, color: brushColor, size: brushSize, tool: activeTool });
    }
    setCurrentStroke(null);
  };

  const handleBgChange = (e) => {
    const newColor = e.target.value;
    setBgColor(newColor);
    socketRef.current.emit('draw_update', { room_id: roomId, type: 'bg', color: newColor });
    if (brushColor === bgColor) setBrushColor(newColor);
  };

  const handleUndo = () => {
    if (strokes.length === 0) return;
    const lastStroke = strokes[strokes.length - 1];
    const newStrokes = strokes.slice(0, -1);
    setStrokes(newStrokes);
    setRedoStack((prev) => [...prev, lastStroke]); 
    socketRef.current.emit('draw_update', { room_id: roomId, type: 'sync', strokes: newStrokes });
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const strokeToRestore = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);
    const newStrokes = [...strokes, strokeToRestore];
    setRedoStack(newRedoStack);
    setStrokes(newStrokes);
    socketRef.current.emit('draw_update', { room_id: roomId, type: 'sync', strokes: newStrokes });
  };

  const handleClear = () => {
    if (window.confirm("Are you sure you want to clear the entire canvas?")) {
      setStrokes([]);
      setRedoStack([]);
      socketRef.current.emit('draw_update', { room_id: roomId, type: 'sync', strokes: [] });
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', borderRadius: '10px', backgroundColor: bgColor, transition: 'background-color 0.3s ease' }}>
      
      {role === 'ai' ? (
        <div style={{ position: 'absolute', top: 10, left: 10, background: '#d63384', color: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          ✏️ Canvas Unlocked
        </div>
      ) : (
        <div style={{ position: 'absolute', top: 10, left: 10, background: '#0066cc', color: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          👁️ Live Viewer Mode
        </div>
      )}

      {role === 'ai' && (
        <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', backgroundColor: 'white', padding: '10px 20px', borderRadius: '30px', boxShadow: '0 4px 15px rgba(0,0,0,0.15)', display: 'flex', gap: '15px', alignItems: 'center', zIndex: 10, border: '1px solid #eaeaea', width: 'max-content' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#666', fontWeight: 'bold' }}>Canvas</span>
            <input type="color" value={bgColor} onChange={handleBgChange} style={{ width: '25px', height: '25px', padding: 0, border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }} />
          </div>

          <div style={{ width: '2px', height: '25px', backgroundColor: '#eee' }}></div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {palette.map((c, index) => {
              const isEraser = index === palette.length - 1;
              return (
                <button key={`${c}-${index}`} onClick={() => setBrushColor(c)} style={{ width: '25px', height: '25px', borderRadius: '50%', backgroundColor: isEraser ? '#f8f9fa' : c, border: brushColor === c ? '3px solid #000' : '2px solid #ddd', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isEraser && <span style={{ fontSize: '14px' }}>🧹</span>}
                </button>
              );
            })}
          </div>

          <div style={{ width: '2px', height: '25px', backgroundColor: '#eee' }}></div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setActiveTool('brush')}
              style={{ padding: '6px 10px', backgroundColor: activeTool === 'brush' ? '#d63384' : '#fff', color: activeTool === 'brush' ? 'white' : 'black', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer' }}
              title="Brush Tool"
            >
              🖌️
            </button>
            <button 
              onClick={() => setActiveTool('lasso')}
              style={{ padding: '6px 10px', backgroundColor: activeTool === 'lasso' ? '#d63384' : '#fff', color: activeTool === 'lasso' ? 'white' : 'black', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer' }}
              title="Lasso Fill Tool"
            >
              🪢
            </button>
          </div>

          <div style={{ width: '2px', height: '25px', backgroundColor: '#eee' }}></div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="range" min="2" max="50" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} style={{ cursor: 'pointer', width: '60px' }} />
          </div>

          <div style={{ width: '2px', height: '25px', backgroundColor: '#eee' }}></div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleUndo} disabled={strokes.length === 0} style={{ padding: '6px 10px', backgroundColor: strokes.length === 0 ? '#eee' : '#fff', border: '1px solid #ccc', borderRadius: '6px', cursor: strokes.length === 0 ? 'not-allowed' : 'pointer' }} title="Undo">↩️</button>
            <button onClick={handleRedo} disabled={redoStack.length === 0} style={{ padding: '6px 10px', backgroundColor: redoStack.length === 0 ? '#eee' : '#fff', border: '1px solid #ccc', borderRadius: '6px', cursor: redoStack.length === 0 ? 'not-allowed' : 'pointer' }} title="Redo">↪️</button>
            <button onClick={handleClear} disabled={strokes.length === 0} style={{ padding: '6px 10px', backgroundColor: strokes.length === 0 ? '#eee' : '#ffebee', border: '1px solid #ffcdd2', borderRadius: '6px', cursor: strokes.length === 0 ? 'not-allowed' : 'pointer', color: '#c62828' }} title="Clear Canvas">🗑️</button>
          </div>

        </div>
      )}

    <svg 
        id="live-canvas-svg" 
        xmlns="http://www.w3.org/2000/svg"
        ref={svgRef} 
        onPointerDown={handlePointerDown} 
        onPointerMove={handlePointerMove} 
        onPointerUp={handlePointerUp} 
        onPointerCancel={handlePointerUp} 
        style={{ width: '100%', height: '100%', touchAction: 'none', cursor: role === 'ai' ? 'crosshair' : 'default' }}
      >
        {strokes.map((stroke, i) => (
          <path 
            key={i} 
            d={stroke.tool === 'lasso' ? getSvgPathFromRawPoints(stroke.points) : getSvgPathFromStroke(getStroke(stroke.points, { size: stroke.size, thinning: 0.5, smoothing: 0.5, streamline: 0.5 }))} 
            fill={stroke.color} 
          />
        ))}
        {currentStroke && (
          <path 
            d={currentStroke.tool === 'lasso' ? getSvgPathFromRawPoints(currentStroke.points) : getSvgPathFromStroke(getStroke(currentStroke.points, { size: currentStroke.size, thinning: 0.5, smoothing: 0.5, streamline: 0.5 }))} 
            fill={currentStroke.color} 
          />
        )}
      </svg>
    </div>
  );
}