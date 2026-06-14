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

  // VOICE CONTROL HUB STATES
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    fetchRecentMemories();
    initializeSpeechRecognition();
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
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

  // INITIALIZE WEB SPEECH API ENGINE
  const initializeSpeechRecognition = () => {
    // Check browser speech support (Chrome, Edge, and Safari natively support this)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Web Speech API is not supported in this browser engine.");
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false; // Stop listening automatically when user pauses speaking
    rec.interimResults = false; // Only care about the finalized sentence block
    rec.lang = 'en-US';

    rec.onstart = () => {
      setIsListening(true);
      setBambiStatus('Listening');
      setBambiThinking('Ambient microphone array engaged. Speak your recall request...');
    };

    rec.onresult = (event) => {
      const spokenText = event.results[0][0].transcript;
      setSearchQuery(spokenText);
      setBambiThinking(`I heard: "${spokenText}". Initializing instant vector lookup...`);
      
      // Auto-trigger the semantic search right away using the spoken string
      executeSearchPipeline(spokenText);
    };

    rec.onerror = (event) => {
      console.error("Speech Recognition Error:", event.error);
      setIsListening(false);
      setBambiStatus('Active');
      if (event.error === 'not-allowed') {
        setBambiThinking('Microphone access blocked. Please enable browser permissions.');
      } else {
        setBambiThinking('Audio stream dropped. Let\'s try that again.');
      }
    };

    rec.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = rec;
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setBambiThinking('Voice interface unavailable on this browser framework.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      // Clear previous states before opening stream
      setSearchResults([]);
      recognitionRef.current.start();
    }
  };

  // Refactored Search Pipeline to handle both manual text inputs and audio strings
  const executeSearchPipeline = async (queryText) => {
    const targetQuery = queryText || searchQuery;
    if (!targetQuery.trim()) return;

    setBambiStatus('Thinking');
    try {
      const response = await axios.post('http://127.0.0.1:8000/snippets/search', {
        query: targetQuery
      });
      if (response.data.status === 'success') {
        setSearchResults(response.data.results);
        setBambiStatus('Active');
        setBambiThinking(
          response.data.results.length === 0 
            ? `I matched 0 nodes for "${targetQuery}". Try different terminology context.`
            : `Matrix complete. Extracted ${response.data.results.length} memories relating directly to your audio stream.`
        );
      }
    } catch (error) {
      console.error(error);
      setBambiStatus('Error');
      setBambiThinking('An operational delay occurred while mapping vectors.');
    }
  };

  const handleCopyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopyStatus(id);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const handleDeleteSnippet = async (id) => {
    if (!window.confirm("Are you sure you want to purge this memory node permanently?")) return;
    try {
      const response = await axios.delete(`http://127.0.0.1:8000/snippets/${id}`);
      if (response.data.status === 'success') {
        setRecentSnippets(prev => prev.filter(item => item.id !== id));
        setSearchResults(prev => prev.filter(item => item.id !== id));
      }
    } catch (error) {
      console.error("Purge failure:", error);
    }
  };

  const categories = ['All', ...new Set(recentSnippets.map(s => s.category))];
  const filteredSnippets = selectedCategory === 'All' 
    ? recentSnippets 
    : recentSnippets.filter(s => s.category === selectedCategory);

  return (
    <div className="smoke-canvas w-screen h-screen flex flex-col justify-between p-6 overflow-hidden relative">
      
      {/* 1. TOP UTILITY ACTIONS NAVBAR */}
      <div className="w-full flex justify-between items-center z-10">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
          <span className={`w-1.5 h-1.5 rounded-full ${
            bambiStatus === 'Thinking' ? 'bg-amber-400 animate-ping' : 
            bambiStatus === 'Listening' ? 'bg-rose-500 animate-pulse' : 'bg-neutral-200'
          }`}></span>
          <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-400">
            {bambiStatus === 'Listening' ? 'System Mic Recording' : `Bambi Core v1.2`}
          </span>
        </div>
        
        <button 
          onClick={() => { fetchRecentMemories(); setIsLedgerOpen(true); }}
          className="text-xs font-medium text-neutral-300 hover:text-white bg-white/[0.02] hover:bg-white/[0.06] border border-white/10 px-5 py-2.5 rounded-xl transition-all shadow-lg"
        >
          Open Fullscreen Memory Vault ({recentSnippets.length})
        </button>
      </div>

      {/* 2. CORE IMMERSIVE INTERACTION ZONE */}
      <div className="max-w-2xl w-full mx-auto flex flex-col items-center justify-center flex-1 z-10 -mt-12">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-light tracking-tight text-white font-sans mb-3">
            Bambi <span className="font-serif italic text-neutral-400">Vault</span>
          </h1>
          <p className="font-serif italic text-sm text-neutral-400 max-w-lg mx-auto leading-relaxed min-h-[48px] transition-all duration-300">
            {bambiThinking}
          </p>
        </div>

        {/* Minimal Search Bar + Voice Activation Trigger */}
        <div className="w-full relative flex items-center mb-8 gap-3">
          <div className="relative flex-1 flex items-center">
            <input 
              type="text" 
              placeholder="Ask Bambi or press the mic to talk..."
              className={`w-full bg-white/[0.01] border text-white placeholder-neutral-700 px-6 py-5 pr-16 text-sm rounded-2xl focus:outline-none transition-all font-sans shadow-2xl ${
                isListening ? 'border-rose-500/40 bg-rose-500/[0.01]' : 'border-white/10 focus:border-white/20'
              }`}
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

          {/* AUDIO HUB ACTIVATION BUTTON */}
          <button
            onClick={toggleListening}
            className={`p-4.5 rounded-2xl border transition-all flex items-center justify-center active:scale-95 ${
              isListening 
                ? 'bg-rose-500 border-rose-400 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse'
                : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:border-white/20'
            }`}
            title={isListening ? "Stop listening" : "Activate voice query"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 0 3-3v-6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" />
            </svg>
          </button>
        </div>

        {/* Dynamic Vector Matrix Output Row */}
        {searchResults.length > 0 && (
          <div className="w-full space-y-3 max-h-64 overflow-y-auto pr-2 animate-fade-in">
            <h3 className="font-mono text-[9px] tracking-widest text-neutral-500 uppercase px-1">
              Relevant Context Discovered
            </h3>
            {searchResults.map((res, index) => (
              <div key={index} className="p-4 bg-white/[0.01] border border-white/5 rounded-xl flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[8px] tracking-widest text-neutral-400 uppercase bg-white/5 px-2 py-0.5 rounded border border-white/5">
                    {res.category}
                  </span>
                  <span className="font-mono text-[9px] text-neutral-500">
                    {(res.score * 100).toFixed(0)}% Match Confidence
                  </span>
                </div>
                <p className="text-neutral-300 text-xs font-serif italic leading-relaxed">"{res.content}"</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FOOTER METRICS SYSTEM STATUS */}
      <div className="w-full text-center z-10 opacity-30">
        <p className="font-mono text-[9px] tracking-widest text-neutral-600 uppercase">
          AI Voice Interface Matrix Network Operational
        </p>
      </div>

      {/* 3. FULLSCREEN IMMERSIVE LEDGER ARCHIVE OVERLAY */}
      {isLedgerOpen && (
        <div className="absolute inset-0 bg-[#060608] z-50 flex flex-col p-8 overflow-hidden animate-fade-in">
          <div className="w-full max-w-7xl mx-auto flex justify-between items-center border-b border-white/5 pb-6 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-3xl font-light font-serif text-white">
                  Knowledge <span className="font-sans font-normal text-neutral-400">Archive Ledger</span>
                </h2>
                <span className="bg-white/10 text-neutral-300 font-mono text-[10px] px-2.5 py-0.5 rounded-full border border-white/10">
                  {recentSnippets.length} Nodes Synchronized
                </span>
              </div>
              <p className="font-mono text-[9px] tracking-widest text-neutral-500 uppercase">Universal Persistent Memory Records</p>
            </div>
            <button 
              onClick={() => setIsLedgerOpen(false)}
              className="text-xs font-medium bg-white/5 hover:bg-white/10 text-white border border-white/10 px-5 py-2.5 rounded-xl transition-all"
            >
              ✕ Exit Vault View
            </button>
          </div>

          <div className="w-full max-w-7xl mx-auto flex-1 flex flex-col overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="p-4 bg-white/[0.01] border border-white/5 rounded-xl flex flex-col justify-between">
                <span className="font-mono text-[9px] tracking-widest text-neutral-500 uppercase">Total Log Count</span>
                <span className="text-2xl font-light text-white mt-1 font-mono">{recentSnippets.length} <span className="text-xs text-neutral-600">entries</span></span>
              </div>
              <div className="p-4 bg-white/[0.01] border border-white/5 rounded-xl flex flex-col justify-between">
                <span className="font-mono text-[9px] tracking-widest text-neutral-500 uppercase">Unique Domain Groups</span>
                <span className="text-2xl font-light text-white mt-1 font-mono">{categories.length - 1} <span className="text-xs text-neutral-600">categories</span></span>
              </div>
              <div className="p-4 bg-white/[0.01] border border-white/5 rounded-xl flex flex-col justify-between">
                <span className="font-mono text-[9px] tracking-widest text-neutral-500 uppercase">Network Status</span>
                <span className="text-2xl font-light text-emerald-400 mt-1 font-mono">100% <span className="text-xs text-neutral-600">operational</span></span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-6 border-b border-white/[0.03] pb-4">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`text-[10px] font-mono tracking-wider px-4 py-1.5 rounded-full border transition-all uppercase ${
                    selectedCategory === cat
                      ? 'bg-white text-black border-white font-semibold'
                      : 'bg-white/[0.02] text-neutral-400 border-white/5 hover:border-white/20 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {filteredSnippets.length === 0 ? (
                <div className="p-20 text-center rounded-2xl border border-dashed border-white/5 bg-white/[0.005]">
                  <p className="text-sm font-serif italic text-neutral-500">No logs mapped inside this category view filter choice.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pb-6">
                  {filteredSnippets.map((snip) => (
                    <div key={snip.id} className="bg-white/[0.01] border border-white/5 p-5 rounded-2xl flex flex-col justify-between hover:bg-white/[0.02] hover:border-white/10 transition-all duration-300 group relative">
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <span className="bg-white/5 border border-white/10 text-neutral-400 font-mono text-[8px] tracking-widest px-2.5 py-0.5 rounded-md uppercase">
                            {snip.category}
                          </span>
                          <span className="text-[10px] text-neutral-600 font-mono">
                            {snip.created_at.split(' ')[0]}
                          </span>
                        </div>
                        <p className="text-neutral-300 text-xs font-serif leading-relaxed italic border-l border-white/10 pl-3">
                          "{snip.content}"
                        </p>
                      </div>

                      <div className="text-[8px] text-neutral-600 font-mono border-t border-white/[0.03] pt-4 mt-5 flex justify-between items-center">
                        <span>Ref Locked: {snip.created_at.split(' ')[1]}</span>
                        <div className="flex gap-3 opacity-40 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleCopyToClipboard(snip.content, snip.id)}
                            className={`hover:text-white transition-colors uppercase ${copyStatus === snip.id ? 'text-emerald-400 font-bold' : ''}`}
                          >
                            {copyStatus === snip.id ? '✓ Copied' : '📄 Copy'}
                          </button>
                          <button 
                            onClick={() => handleDeleteSnippet(snip.id)}
                            className="hover:text-rose-400 transition-colors uppercase"
                          >
                            ✕ Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;