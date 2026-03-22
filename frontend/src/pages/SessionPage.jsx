import React, { useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSessionStore } from '../store/sessionStore';
import { getSocket, disconnectSocket } from '../utils/socket';
import { useHost } from '../hooks/useHost';
import { useViewer } from '../hooks/useViewer';
import { useLatency } from '../hooks/useLatency';
import VideoStream from '../components/VideoStream';
import ParticipantList from '../components/ParticipantList';
import ControlBar from '../components/ControlBar';
import { Monitor } from 'lucide-react';

export default function SessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { role, myName, setSession, reset, isConnected, setConnected } = useSessionStore();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const controlLayerRef = useRef(null);

  // If no role set (e.g. page refresh), redirect home
  useEffect(() => {
    if (!role) {
      navigate(`/?session=${sessionId}`, { replace: true });
    }
  }, [role, sessionId, navigate]);

  // Socket connection status
  useEffect(() => {
    const socket = getSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) setConnected(true);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [setConnected]);

  // Latency ping
  useLatency();

  // Host logic
  const { startScreenShare, stopScreenShare, toggleControl } = useHost({ localVideoRef });

  // Viewer logic
  useViewer({ remoteVideoRef, controlLayerRef });

  const handleLeave = useCallback(() => {
    stopScreenShare?.();
    disconnectSocket();
    reset();
    navigate('/');
  }, [stopScreenShare, reset, navigate]);

  if (!role) return null;

  const isHost = role === 'host';

  return (
    <div className="min-h-screen flex flex-col bg-ink">
      {/* Header */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-accent flex items-center justify-center">
            <Monitor size={13} className="text-ink" />
          </div>
          <span className="font-display font-bold text-white text-sm tracking-wider">SCREENSYNC</span>
          <div className="w-px h-4 bg-border" />
          <span className="text-muted text-xs font-display">{isHost ? 'HOST' : 'VIEWER'}</span>
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-success' : 'bg-danger'} recording-pulse`} />
        </div>
        <div className="text-muted text-xs font-display hidden sm:block truncate max-w-xs">
          {sessionId}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Main video area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {isHost ? (
            <VideoStream ref={localVideoRef} isLocal={true} />
          ) : (
            <VideoStream ref={remoteVideoRef} isLocal={false} controlLayerRef={controlLayerRef} />
          )}

          {/* Control bar */}
          <ControlBar
            sessionId={sessionId}
            onStartShare={startScreenShare}
            onStopShare={stopScreenShare}
            onToggleControl={toggleControl}
            onLeave={handleLeave}
          />
        </div>

        {/* Sidebar */}
        <div className="w-56 flex-shrink-0 border-l border-border flex flex-col overflow-y-auto hidden md:flex">
          <ParticipantList />
        </div>
      </div>
    </div>
  );
}
