import React, { useState } from 'react';
import { Monitor, MonitorOff, MousePointer, MousePointerBan, Copy, Check, Link, LogOut } from 'lucide-react';
import { useSessionStore } from '../store/sessionStore';

export default function ControlBar({ onStartShare, onStopShare, onToggleControl, onLeave, sessionId }) {
  const { role, isSharingScreen, controlEnabled, latency, viewers } = useSessionStore();
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    const url = `${window.location.origin}/?session=${sessionId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const latencyColor = !latency ? 'text-muted'
    : latency < 50 ? 'text-success'
    : latency < 120 ? 'text-warning'
    : 'text-danger';

  return (
    <div className="glass-panel border-t border-border">
      <div className="flex items-center gap-2 px-4 py-3 flex-wrap">

        {/* Session ID */}
        <div className="flex items-center gap-2 border border-border px-3 py-1.5 flex-1 min-w-0">
          <Link size={12} className="text-muted flex-shrink-0" />
          <span className="text-xs font-display text-muted truncate">{sessionId}</span>
        </div>

        {/* Copy link */}
        <button onClick={copyLink} className="btn-ghost flex items-center gap-2 py-1.5 text-xs">
          {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
          {copied ? 'COPIED' : 'COPY LINK'}
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-border" />

        {/* Host controls */}
        {role === 'host' && (
          <>
            {!isSharingScreen ? (
              <button onClick={onStartShare} className="btn-primary flex items-center gap-2 py-1.5 text-xs">
                <Monitor size={12} />
                START SHARING
              </button>
            ) : (
              <button
                onClick={onStopShare}
                className="flex items-center gap-2 px-4 py-1.5 text-xs font-display font-bold border border-danger/50 text-danger hover:bg-danger/10 transition-all active:scale-95"
              >
                <MonitorOff size={12} />
                STOP
              </button>
            )}

            <button
              onClick={() => onToggleControl(!controlEnabled)}
              className={`flex items-center gap-2 px-4 py-1.5 text-xs font-display font-bold border transition-all active:scale-95 ${
                controlEnabled
                  ? 'border-success/50 text-success bg-success/5 hover:bg-success/10'
                  : 'border-border text-muted hover:border-accent hover:text-accent'
              }`}
            >
              {controlEnabled ? <MousePointer size={12} /> : <MousePointerBan size={12} />}
              CONTROL {controlEnabled ? 'ON' : 'OFF'}
            </button>
          </>
        )}

        {/* Viewer: control status */}
        {role === 'viewer' && (
          <div className={`flex items-center gap-2 px-3 py-1.5 text-xs font-display border ${
            controlEnabled
              ? 'border-success/40 text-success bg-success/5'
              : 'border-border text-muted'
          }`}>
            {controlEnabled ? <MousePointer size={12} /> : <MousePointerBan size={12} />}
            {controlEnabled ? 'CONTROL ACTIVE' : 'VIEW ONLY'}
          </div>
        )}

        {/* Latency */}
        <div className={`flex items-center gap-1.5 text-xs font-display ${latencyColor} ml-auto`}>
          <div className={`w-1.5 h-1.5 rounded-full ${latencyColor.replace('text-', 'bg-')}`} />
          {latency != null ? `${latency}ms` : '—'}
        </div>

        {/* Viewer count */}
        <div className="text-xs font-display text-muted">
          {viewers.length} viewer{viewers.length !== 1 ? 's' : ''}
        </div>

        {/* Leave */}
        <button onClick={onLeave} className="btn-ghost flex items-center gap-2 py-1.5 text-xs text-danger border-danger/30 hover:border-danger hover:bg-danger/5">
          <LogOut size={12} />
          LEAVE
        </button>
      </div>
    </div>
  );
}
