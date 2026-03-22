import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, Users, Zap, Shield, ArrowRight, Eye } from 'lucide-react';
import { getSocket } from '../utils/socket';
import { useSessionStore } from '../store/sessionStore';

export default function HomePage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [joinId, setJoinId] = useState('');
  const [mode, setMode] = useState(null); // 'host' | 'join'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setSession, setRole, setMyName, setMyId } = useSessionStore();

  const handleCreate = useCallback(async () => {
    if (!name.trim()) { setError('Enter your name'); return; }
    setLoading(true);
    setError('');
    const socket = getSocket();

    socket.emit('create-session', { hostName: name.trim() }, (res) => {
      setLoading(false);
      if (res.success) {
        setRole('host');
        setMyName(name.trim());
        setMyId(socket.id);
        setSession({ sessionId: res.sessionId, hostName: name.trim(), hostId: socket.id });
        navigate(`/session/${res.sessionId}`);
      } else {
        setError(res.error || 'Failed to create session');
      }
    });
  }, [name, navigate, setRole, setMyName, setMyId, setSession]);

  const handleJoin = useCallback(async () => {
    if (!name.trim()) { setError('Enter your name'); return; }
    if (!joinId.trim()) { setError('Enter session ID'); return; }
    setLoading(true);
    setError('');
    const socket = getSocket();

    socket.emit('join-session', { sessionId: joinId.trim(), viewerName: name.trim() }, (res) => {
      setLoading(false);
      if (res.success) {
        setRole('viewer');
        setMyName(name.trim());
        setMyId(res.viewerId || socket.id);
        setSession({
          sessionId: joinId.trim(),
          hostName: res.session?.hostName,
          hostId: res.session?.hostSocketId,
          viewers: res.session?.viewers || [],
          controlEnabled: res.session?.controlEnabled || false,
        });
        navigate(`/session/${joinId.trim()}`);
      } else {
        setError(res.error || 'Session not found');
      }
    });
  }, [name, joinId, navigate, setRole, setMyName, setMyId, setSession]);

  // Check URL for pre-filled session ID
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('session');
    if (sid) { setJoinId(sid); setMode('join'); }
  }, []);

  return (
    <div className="min-h-screen grid-bg flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-accent flex items-center justify-center">
            <Monitor size={16} className="text-ink" />
          </div>
          <span className="font-display font-bold text-white tracking-wider">SCREENSYNC</span>
        </div>
        <span className="text-muted text-xs font-display">BROWSER-NATIVE · PEER-TO-PEER</span>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-5xl">
          {/* Title block */}
          <div className="mb-16 text-center animate-slide-up">
            <div className="inline-flex items-center gap-2 border border-accent/30 bg-accent/5 px-4 py-2 mb-8">
              <div className="w-1.5 h-1.5 rounded-full bg-accent recording-pulse" />
              <span className="text-accent text-xs font-display tracking-widest">LIVE COLLABORATION</span>
            </div>
            <h1 className="font-display text-5xl md:text-7xl font-bold text-white leading-none mb-6">
              SHARE.<br />
              <span className="text-accent glow-text-accent">CONTROL.</span><br />
              COLLABORATE.
            </h1>
            <p className="text-muted font-body text-lg max-w-lg mx-auto">
              Real-time screen sharing with browser-based remote control.
              No installs, no extensions — just a link.
            </p>
          </div>

          {/* Action cards */}
          <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto mb-8">
            {/* Host card */}
            <button
              onClick={() => { setMode('host'); setError(''); }}
              className={`p-6 border text-left transition-all duration-200 hover:border-accent group ${
                mode === 'host' ? 'border-accent bg-accent/5 glow-accent' : 'border-border hover:bg-panel'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 flex items-center justify-center border ${
                  mode === 'host' ? 'border-accent bg-accent/10' : 'border-border'
                }`}>
                  <Monitor size={18} className={mode === 'host' ? 'text-accent' : 'text-muted'} />
                </div>
                <ArrowRight size={16} className={`transition-transform group-hover:translate-x-1 ${mode === 'host' ? 'text-accent' : 'text-muted'}`} />
              </div>
              <div className="font-display font-bold text-white mb-1">HOST SESSION</div>
              <div className="text-muted text-sm">Share your screen and control who can interact</div>
            </button>

            {/* Viewer card */}
            <button
              onClick={() => { setMode('join'); setError(''); }}
              className={`p-6 border text-left transition-all duration-200 hover:border-accent group ${
                mode === 'join' ? 'border-accent bg-accent/5 glow-accent' : 'border-border hover:bg-panel'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 flex items-center justify-center border ${
                  mode === 'join' ? 'border-accent bg-accent/10' : 'border-border'
                }`}>
                  <Eye size={18} className={mode === 'join' ? 'text-accent' : 'text-muted'} />
                </div>
                <ArrowRight size={16} className={`transition-transform group-hover:translate-x-1 ${mode === 'join' ? 'text-accent' : 'text-muted'}`} />
              </div>
              <div className="font-display font-bold text-white mb-1">JOIN SESSION</div>
              <div className="text-muted text-sm">View a shared screen and optionally control it</div>
            </button>
          </div>

          {/* Form area */}
          {mode && (
            <div className="max-w-2xl mx-auto animate-slide-up">
              <div className="glass-panel p-6">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-display text-muted tracking-widest block mb-2">YOUR NAME</label>
                    <input
                      className="input-field"
                      placeholder="e.g. Sujal"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (mode === 'host' ? handleCreate() : handleJoin())}
                      autoFocus
                    />
                  </div>

                  {mode === 'join' && (
                    <div>
                      <label className="text-xs font-display text-muted tracking-widest block mb-2">SESSION ID</label>
                      <input
                        className="input-field"
                        placeholder="Paste session ID or link"
                        value={joinId}
                        onChange={(e) => {
                          // Handle full URLs pasted
                          const val = e.target.value;
                          const match = val.match(/session\/([a-f0-9-]{36})/);
                          setJoinId(match ? match[1] : val);
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                      />
                    </div>
                  )}

                  {error && (
                    <div className="text-danger text-xs font-display border border-danger/30 bg-danger/5 px-4 py-3">
                      {error}
                    </div>
                  )}

                  <button
                    className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
                    onClick={mode === 'host' ? handleCreate : handleJoin}
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="font-display">CONNECTING...</span>
                    ) : (
                      <>
                        <span className="font-display">{mode === 'host' ? 'CREATE SESSION' : 'JOIN SESSION'}</span>
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-3 mt-12">
            {[
              { icon: Zap, label: 'WebRTC P2P' },
              { icon: Shield, label: 'Host-controlled access' },
              { icon: Users, label: 'Multi-viewer' },
              { icon: Monitor, label: 'No install required' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 border border-border px-4 py-2 text-xs text-muted font-display">
                <Icon size={12} className="text-accent" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
