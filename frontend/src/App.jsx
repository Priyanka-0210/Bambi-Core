// frontend/src/App.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [recentSnippets, setRecentSnippets] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [bambiStatus, setBambiStatus] = useState('Active');
  const [bambiThinking, setBambiThinking] = useState('Bambi is synced. What memory would you like to evoke?');
  const [copyStatus, setCopyStatus] = useState(null);

  // VOICE STATES
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  // FIXED SCREENSHOT CROP ENGAGEMENT STATES
  const [isSelectingArea, setIsSelectingArea] = useState(false);
  const [croppedImage, setCroppedImage] = useState(null);
  
  const canvasRef = useRef(null);
  const fullPageSnapshot = useRef(null);
  const isDragging = useRef(false);
  const startCoords = useRef({ x: 0, y: 0 });
  const currentCoords = useRef({ x: 0, y: 0 });

  useEffect(() => {
    fetchRecentMemories();
    initializeSpeechRecognition();
  }, []);

  const fetchRecentMemories = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/snippets/recent');
      if (response.data.status === 'success') {
        setRecentSnippets(response.data.results);
      }
    } catch (error) {
      console.error(error);
    }
  };

  // WEB SPEECH ENGINE
  const initializeSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.lang = 'en-US';
    rec.onstart = () => {
      setIsListening(true);
      setBambiStatus('Listening');
      setBambiThinking('Ambient microphone array engaged. Speak your recall request...');
    };
    rec.onresult = (event) => {
      const spokenText = event.results[0][0].transcript;
      setSearchQuery(spokenText);
      executeSearchPipeline(spokenText);
    };
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) { recognitionRef.current.stop(); } 
    else { setSearchResults([]); recognitionRef.current.start(); }
  };

  const executeSearchPipeline = async (queryText) => {
    const targetQuery = queryText || searchQuery;
    if (!targetQuery.trim()) return;
    setBambiStatus('Thinking');
    try {
      const response = await axios.post('http://127.0.0.1:8000/snippets/search', { query: targetQuery });
      if (response.data.status === 'success') {
        setSearchResults(response.data.results);
        setBambiStatus('Active');
        setBambiThinking(response.data.results.length === 0 ? `0 matches found for "${targetQuery}".` : `Extracted matches.`);
      }
    } catch (error) {
      setBambiStatus('Error');
    }
  };

  // NATIVE CAPTURE TOOL: Renders any screen view into a cropping frame
  const startAreaSelection = async () => {
    setCroppedImage(null);
    setBambiStatus('Thinking');
    setBambiThinking('Select the window or screen tab you want to capture...');

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" }, 
        audio: false
      });

      setBambiStatus('Active');
      setBambiThinking('Processing image frames... Ready to drag selection.');

      const video = document.createElement('video');
      video.srcObject = stream;
      
      video.onloadedmetadata = () => {
        setTimeout(() => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          fullPageSnapshot.current = canvas;
          
          stream.getTracks().forEach(track => track.stop());

          setIsSelectingArea(true);
          initCanvasOverlay(canvas);
        }, 500); 
      };
      video.play();

    } catch (error) {
      console.error("Capture stream error:", error);
      setBambiStatus('Error');
      setBambiThinking('Screen snapshot synchronization request denied.');
    }
  };

  const initCanvasOverlay = (sourceCanvas) => {
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, 100);
  };

  const drawSelection = () => {
    const canvas = canvasRef.current;
    if (!canvas || !fullPageSnapshot.current) return;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(fullPageSnapshot.current, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const left = Math.min(startCoords.current.x, currentCoords.current.x);
    const top = Math.min(startCoords.current.y, currentCoords.current.y);
    const width = Math.abs(startCoords.current.x - currentCoords.current.x);
    const height = Math.abs(startCoords.current.y - currentCoords.current.y);

    ctx.clearRect(left, top, width, height);
    ctx.drawImage(
      fullPageSnapshot.current,
      (left * fullPageSnapshot.current.width) / canvas.width,
      (top * fullPageSnapshot.current.height) / canvas.height,
      (width * fullPageSnapshot.current.width) / canvas.width,
      (height * fullPageSnapshot.current.height) / canvas.height,
      left, top, width, height
    );

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(left, top, width, height);
  };

  const onCropMouseDown = (e) => {
    isDragging.current = true;
    startCoords.current = { x: e.clientX, y: e.clientY };
    currentCoords.current = { x: e.clientX, y: e.clientY };
  };

  const onCropMouseMove = (e) => {
    if (!isDragging.current) return;
    currentCoords.current = { x: e.clientX, y: e.clientY };
    drawSelection();
  };

  const onCropMouseUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const left = Math.min(startCoords.current.x, currentCoords.current.x);
    const top = Math.min(startCoords.current.y, currentCoords.current.y);
    const width = Math.abs(startCoords.current.x - currentCoords.current.x);
    const height = Math.abs(startCoords.current.y - currentCoords.current.y);

    setIsSelectingArea(false);

    if (width < 15 || height < 15) {
      setBambiThinking('Crop target area was too small. Click Capture to reset.');
      return;
    }

    const srcCanvas = fullPageSnapshot.current;
    const finalCropCanvas = document.createElement('canvas');
    finalCropCanvas.width = width;
    finalCropCanvas.height = height;
    
    const ctx = finalCropCanvas.getContext('2d');
    
    const scaleX = srcCanvas.width / window.innerWidth;
    const scaleY = srcCanvas.height / window.innerHeight;

    ctx.drawImage(
      srcCanvas,
      left * scaleX, top * scaleY, width * scaleX, height * scaleY,
      0, 0, width, height
    );

    setCroppedImage(finalCropCanvas.toDataURL('image/png'));
    setBambiThinking('Region snippet isolated! Ready to deploy to your Bambi Vault archive log.');
  };

  const sendStickerToBambi = async () => {
    if (!croppedImage) return;
    setBambiStatus('Thinking');
    setBambiThinking('Transmitting visual data packets straight down the Gemini Vision pipeline...');

    try {
      const responseBlob = await fetch(croppedImage).then(res => res.blob());
      const imageFile = new File([responseBlob], "cropped-sticker.png", { type: "image/png" });
      
      const formData = new FormData();
      formData.append("file", imageFile);

      const response = await axios.post('http://127.0.0.1:8000/snippets/upload-sticker', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.status === 'success') {
        setBambiStatus('Active');
        setCroppedImage(null);
        setBambiThinking(`Memory secured! Pinned under category [${response.data.category}]. It is now completely searchable.`);
        fetchRecentMemories();
      }
    } catch (error) {
      console.error(error);
      setBambiStatus('Error');
      setBambiThinking('Bambi vision adapter rejected image telemetry tracks.');
    }
  };

  const handleDeleteSnippet = async (id) => {
    if (!window.confirm("Purge memory node permanently?")) return;
    try {
      await axios.delete(`http://127.0.0.1:8000/snippets/${id}`);
      setRecentSnippets(prev => prev.filter(item => item.id !== id));
      setSearchResults(prev => prev.filter(item => item.id !== id));
    } catch (e) { console.error(e); }
  };

  const categories = ['All', ...new Set(recentSnippets.map(s => s.category))];
  const filteredSnippets = selectedCategory === 'All' ? recentSnippets : recentSnippets.filter(s => s.category === selectedCategory);

  return (
    <div className="smoke-canvas w-screen h-screen flex flex-col justify-between p-6 overflow-hidden relative select-none">
      
      {/* FULLSCREEN MOUSE-CAPTURE WORKSPACE SCREEN OVERLAY CONTAINER */}
      {isSelectingArea && (
        <div className="fixed inset-0 z-[99999] bg-black">
          <canvas 
            ref={canvasRef}
            className="w-full h-full cursor-crosshair block"
            onMouseDown={onCropMouseDown}
            onMouseMove={onCropMouseMove}
            onMouseUp={onCropMouseUp}
          />
          <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-neutral-900/90 backdrop-blur text-white font-mono text-[10px] px-5 py-2.5 rounded-full tracking-wider uppercase border border-white/10 pointer-events-none shadow-2xl">
            ⚡ Click and drag a box across the static frame view to crop your sticker
          </div>
        </div>
      )}

      {/* 1. HEADER BAR COMPONENT */}
      <div className="w-full flex justify-between items-center z-10">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
          <span className={`w-1.5 h-1.5 rounded-full ${bambiStatus === 'Thinking' ? 'bg-neutral-400 animate-ping' : bambiStatus === 'Listening' ? 'bg-rose-500 animate-pulse' : 'bg-neutral-200'}`}></span>
          <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-400">Bambi Core v1.5</span>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={startAreaSelection}
            className="text-xs font-semibold text-black bg-white hover:bg-neutral-200 px-4 py-2.5 rounded-xl transition-all shadow-lg active:scale-95"
          >
            ✂ Capture Region Sticker
          </button>
          <button 
            onClick={() => { fetchRecentMemories(); setIsLedgerOpen(true); }}
            className="text-xs font-medium text-neutral-300 hover:text-white bg-white/[0.02] hover:bg-white/[0.06] border border-white/10 px-5 py-2.5 rounded-xl transition-all shadow-lg"
          >
            Vault Ledger ({recentSnippets.length})
          </button>
        </div>
      </div>

      {/* 2. CORE CENTRAL SEARCH HUB DISPLAY */}
      <div className="max-w-2xl w-full mx-auto flex flex-col items-center justify-center flex-1 z-10 -mt-8">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-light tracking-tight text-white font-sans mb-3">
            Bambi <span className="font-serif italic text-neutral-400">Vault</span>
          </h1>
          <p className="font-serif italic text-sm text-neutral-400 max-w-lg mx-auto leading-relaxed min-h-[48px] transition-all duration-300">
            {bambiThinking}
          </p>
        </div>

        {/* Search Input Layer */}
        <div className="w-full relative flex items-center mb-6 gap-3">
          <div className="relative flex-1 flex items-center">
            <input 
              type="text" 
              placeholder="Ask Bambi or select microphone to dictate query..."
              className="w-full bg-white/[0.01] border border-white/10 text-white placeholder-neutral-700 px-6 py-5 pr-16 text-sm rounded-2xl focus:outline-none focus:border-white/20 focus:bg-white/[0.03] transition-all font-sans shadow-2xl"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && executeSearchPipeline()}
            />
            <button 
              onClick={() => executeSearchPipeline()}
              className="absolute right-3 bg-white text-black hover:bg-neutral-200 text-xs font-semibold px-4 py-2.5 rounded-xl active:scale-95 transition-transform"
            >
              Search
            </button>
          </div>

          <button
            onClick={toggleListening}
            className={`p-4.5 rounded-2xl border transition-all flex items-center justify-center active:scale-95 ${
              isListening ? 'bg-rose-500 border-rose-400 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse' : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 0 3-3v-6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" /></svg>
          </button>
        </div>

        {/* CROP SNIPPET PREVIEW COMPONENT CARD */}
        {croppedImage && (
          <div className="w-full max-w-sm bg-[#121216]/90 border border-white/10 p-4 rounded-2xl flex flex-col gap-3 shadow-2xl mb-6 animate-fade-in backdrop-blur-md">
            <span className="font-mono text-[8px] text-neutral-500 uppercase tracking-widest">Isolated Region Sticker Clip Preview</span>
            <div className="rounded-lg overflow-hidden border border-white/5 bg-black max-h-40 flex items-center justify-center">
              <img src={croppedImage} alt="Crop Snippet" className="object-contain max-h-40 w-full" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCroppedImage(null)} className="flex-1 bg-white/5 hover:bg-white/10 text-white text-xs py-2 rounded-xl transition-all">Cancel</button>
              <button onClick={sendStickerToBambi} className="flex-1 bg-white text-black font-semibold text-xs py-2 rounded-xl transition-all hover:bg-neutral-200">Send to Bambi</button>
            </div>
          </div>
        )}

        {/* Semantic Query Results Display list box */}
        {searchResults.length > 0 && (
          <div className="w-full space-y-4 max-h-96 overflow-y-auto pr-2 animate-fade-in">
            <h3 className="font-mono text-[9px] tracking-widest text-neutral-500 uppercase px-1">Relevant Context Discovered</h3>
            {searchResults.map((res, index) => (
              <div key={index} className="p-4 bg-white/[0.01] border border-white/5 rounded-xl flex flex-col gap-3 hover:border-white/10 transition-colors">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[8px] tracking-widest text-neutral-400 uppercase bg-white/5 px-2 py-0.5 rounded border border-white/5">{res.category}</span>
                  <span className="font-mono text-[9px] text-neutral-500">{(res.score * 100).toFixed(0)}% Match</span>
                </div>
                <p className="text-neutral-300 text-xs font-serif italic leading-relaxed">"{res.content}"</p>
                
                {/* INLINE RETRIEVED IMAGE DISPLAY */}
                {res.image_url && (
                  <div className="mt-1 rounded-xl overflow-hidden border border-white/10 bg-black/40 max-h-64 flex items-center justify-start p-1 w-full">
                    <img 
                      src={res.image_url} 
                      alt="Retrieved Sticker Asset" 
                      className="object-contain max-h-60 rounded-lg max-w-full"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FOOTER BAR TRACK */}
      <div className="w-full text-center z-10 opacity-30">
        <p className="font-mono text-[9px] tracking-widest text-neutral-600 uppercase">AI Vector Matrix Interaction Network Layer</p>
      </div>

      {/* 3. FULLSCREEN LEDGER MODAL ARCHIVE RECOVERY VIEW */}
      {isLedgerOpen && (
        <div className="absolute inset-0 bg-[#060608] z-50 flex flex-col p-8 overflow-hidden animate-fade-in">
          <div className="w-full max-w-7xl mx-auto flex justify-between items-center border-b border-white/5 pb-6 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-3xl font-light font-serif text-white">Knowledge <span className="font-sans font-normal text-neutral-400">Ledger Index</span></h2>
                <span className="bg-white/10 text-neutral-300 font-mono text-[10px] px-2.5 py-0.5 rounded-full border border-white/10">{recentSnippets.length} Nodes Synchronized</span>
              </div>
            </div>
            <button onClick={() => setIsLedgerOpen(false)} className="text-xs font-medium bg-white/5 hover:bg-white/10 text-white border border-white/10 px-5 py-2.5 rounded-xl transition-all">✕ Exit Vault</button>
          </div>

          <div className="w-full max-w-7xl mx-auto flex-1 flex flex-col overflow-hidden">
            <div className="flex flex-wrap gap-2 mb-6 border-b border-white/[0.03] pb-4">
              {categories.map((cat) => (
                <button key={cat} onClick={() => setSelectedCategory(cat)} className={`text-[10px] font-mono tracking-wider px-4 py-1.5 rounded-full border transition-all uppercase ${selectedCategory === cat ? 'bg-white text-black border-white font-semibold' : 'bg-white/[0.02] text-neutral-400 border-white/5 hover:border-white/20'}`}>{cat}</button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pb-6">
                {filteredSnippets.map((snip) => (
                  <div key={snip.id} className="bg-white/[0.01] border border-white/5 p-5 rounded-2xl flex flex-col justify-between hover:bg-white/[0.02] hover:border-white/10 transition-all duration-300 group relative">
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <span className="bg-white/5 border border-white/10 text-neutral-400 font-mono text-[8px] tracking-widest px-2.5 py-0.5 rounded-md uppercase">{snip.category}</span>
                        <span className="text-[10px] text-neutral-600 font-mono">{snip.created_at.split(' ')[0]}</span>
                      </div>
                      <p className="text-neutral-300 text-xs font-serif leading-relaxed italic border-l border-white/10 pl-3">"{snip.content}"</p>
                      
                      {/* HISTORICAL LEDGER IMAGE RENDERING */}
                      {snip.image_url && (
                        <div className="mt-1 rounded-xl overflow-hidden border border-white/5 bg-black/20 max-h-40 flex items-center justify-center w-full p-0.5">
                          <img 
                            src={snip.image_url} 
                            alt="Vault Item Archive" 
                            className="object-contain max-h-38 rounded-lg max-w-full"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="text-[8px] text-neutral-600 font-mono border-t border-white/[0.03] pt-4 mt-5 flex justify-between items-center">
                      <span>Logged: {snip.created_at.split(' ')[1]}</span>
                      <button onClick={() => handleDeleteSnippet(snip.id)} className="hover:text-rose-400 transition-colors uppercase opacity-40 group-hover:opacity-100 font-bold">Purge</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;