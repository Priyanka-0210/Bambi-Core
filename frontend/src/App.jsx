// frontend/src/App.jsx
import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import axios from 'axios';

function App() {
  const canvasRef = useRef(null);
  const [fabricCanvas, setFabricCanvas] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: window.innerWidth - 360,
      height: window.innerHeight - 100,
      backgroundColor: '#ffffff',
    });

    setFabricCanvas(canvas);

    const handleResize = () => {
      canvas.setWidth(window.innerWidth - 360);
      canvas.setHeight(window.innerHeight - 100);
      canvas.renderAll();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.dispose();
    };
  }, []);

  const handleBambiSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const response = await axios.post('http://127.0.0.1:8000/snippets/search', {
        query: searchQuery
      });
      if (response.data.status === 'success') {
        setSearchResults(response.data.results);
      }
    } catch (error) {
      console.error("Bambi retrieval failure:", error);
    }
  };

  const addTextSticker = (textContent) => {
    if (!fabricCanvas) return;
    
    const textObject = new fabric.Textbox(textContent, {
      left: 150,
      top: 150,
      width: 260,
      fontSize: 16,
      fill: '#201a18', // Deep brown-black text
      backgroundColor: '#c7b0a3', // Soft Sand color from your palette
      padding: 14,
      rx: 8,
      ry: 8,
      cornerColor: '#b66245', // Terracotta control handles
      cornerSize: 9,
      transparentCorners: false
    });
    
    fabricCanvas.add(textObject);
    fabricCanvas.setActiveObject(textObject);
    fabricCanvas.renderAll();
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f5ede9]">
      
      {/* SIDEBAR CONTROL PANEL */}
      <div className="w-85 h-full bg-[#2a2220] text-slate-100 flex flex-col p-5 shadow-2xl z-10 border-r border-[#3a302d]">
        <div className="mb-8">
          <h1 className="text-2xl font-black tracking-wider text-[#c37973]">BAMBI WORKSPACE</h1>
          <p className="text-xs text-slate-400 font-medium tracking-stretch">Intelligent Personal Memory Layer</p>
        </div>

        {/* Input Bar */}
        <div className="mb-6">
          <label className="text-[10px] font-bold text-slate-400 block mb-2 uppercase tracking-widest">
            Query My Digital Brain
          </label>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="What did I save about Disney?"
              className="w-full text-slate-900 p-2.5 text-sm rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#b66245] font-medium shadow-inner"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleBambiSearch()}
            />
            <button 
              onClick={handleBambiSearch}
              className="bg-[#b66245] hover:bg-[#aa4c3a] text-white font-bold text-xs px-4 rounded-lg shadow-md transition-all active:scale-95"
            >
              Go
            </button>
          </div>
        </div>

        {/* Dynamic Search Feed Panel */}
        <div className="flex-1 overflow-y-auto mb-4 pr-1 scrollbar-thin">
          <h3 className="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-widest">
            Retrieved Memories
          </h3>
          {searchResults.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#221b19] border border-[#3a302d] border-dashed text-center">
              <p className="text-xs text-slate-500 italic">No queried memories loaded yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {searchResults.map((res, index) => (
                <div 
                  key={index} 
                  onClick={() => addTextSticker(`[${res.category}] ${res.content}`)}
                  className="p-3 bg-[#332927] hover:bg-[#3d312f] rounded-xl text-xs border-l-4 border-[#b66245] cursor-pointer transition-all shadow-sm hover:translate-x-1"
                >
                  <span className="font-extrabold text-[#c37973] uppercase tracking-wider block mb-1 text-[10px]">
                    {res.category} • Match {Math.round(res.score * 100)}%
                  </span>
                  <p className="text-slate-300 font-medium leading-relaxed line-clamp-3">{res.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audio Interface Hub Status */}
        <div className="border-t border-[#3a302d] pt-4 bg-[#1b1514] p-4 rounded-xl text-center shadow-lg">
          <div className="text-xs text-[#c7b0a3] font-extrabold tracking-wider mb-1 flex items-center justify-center gap-1.5">
            <span className="animate-pulse text-sm">🔊</span> BAMBI AUDIO INTERFACE
          </div>
          <span className="text-[10px] text-slate-500 font-medium">Listening enabled. Say \"Find me this\"</span>
        </div>
      </div>

      {/* JOURNAL CANVAS CONTAINER */}
      <div className="flex-1 h-full p-6 flex flex-col justify-between">
        <div className="w-full flex justify-between items-center px-1">
          <div>
            <h2 className="text-sm font-bold text-[#201a18] uppercase tracking-wider">Digital Memory Canvas</h2>
            <p className="text-[11px] text-[#c37973] font-medium">Drag, scale, arrange, and design your stickers</p>
          </div>
          <button 
            onClick={() => addTextSticker("New Manual Note Entry")}
            className="text-xs font-bold bg-[#aa4c3a] hover:bg-[#b66245] text-white px-4 py-2 rounded-xl transition-all shadow-md active:scale-95"
          >
            + Quick Sticky
          </button>
        </div>
        
        {/* Fabric Window Container */}
        <div className="flex-1 mt-4 shadow-xl border border-slate-200/60 rounded-2xl overflow-hidden bg-white flex justify-center items-center">
          <canvas ref={canvasRef} className="outline-none" />
        </div>
      </div>

    </div>
  );
}

export default App;