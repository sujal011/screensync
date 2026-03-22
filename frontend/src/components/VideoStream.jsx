import React, { useRef, forwardRef } from 'react';
import { Monitor, WifiOff, MousePointer } from 'lucide-react';
import { useSessionStore } from '../store/sessionStore';
import RemoteCursors from './RemoteCursors';

const VideoStream = forwardRef(function VideoStream({ isLocal = false, controlLayerRef }, ref) {
  const { isStreaming, isSharingScreen, controlEnabled, role } = useSessionStore();
  const containerRef = useRef(null);

  const showVideo = isLocal ? isSharingScreen : isStreaming;
  const showControlHint = !isLocal && controlEnabled;

  return (
    <div ref={containerRef} className="relative flex-1 video-wrapper scanlines bg-ink min-h-0">
      {/* Grid overlay when no stream */}
      {!showVideo && (
        <div className="absolute inset-0 grid-bg flex flex-col items-center justify-center gap-4">
          {isLocal ? (
            <>
              <div className="w-16 h-16 border border-border flex items-center justify-center">
                <Monitor size={28} className="text-muted" />
              </div>
              <div className="text-center">
                <div className="text-muted text-sm font-display mb-1">NO SCREEN SHARED</div>
                <div className="text-muted/50 text-xs font-body">Click "Start Sharing" to begin</div>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 border border-border flex items-center justify-center animate-pulse-slow">
                <WifiOff size={28} className="text-muted" />
              </div>
              <div className="text-center">
                <div className="text-muted text-sm font-display mb-1">WAITING FOR HOST</div>
                <div className="text-muted/50 text-xs font-body">Stream will appear when host shares</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Video element */}
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-contain transition-opacity duration-300 ${showVideo ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Control overlay — captures mouse/keyboard events */}
      {!isLocal && (
        <div
          ref={controlLayerRef}
          className={`absolute inset-0 z-20 ${
            controlEnabled
              ? 'cursor-crosshair'
              : 'cursor-default pointer-events-none'
          }`}
          tabIndex={controlEnabled ? 0 : -1}
          style={{ outline: 'none' }}
        />
      )}

      {/* Remote cursors (host sees viewer cursors) */}
      {isLocal && (
        <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
          <RemoteCursors containerRef={containerRef} />
        </div>
      )}

      {/* Status badges */}
      <div className="absolute top-3 left-3 flex items-center gap-2 z-40">
        {isLocal && isSharingScreen && (
          <div className="flex items-center gap-2 bg-danger/90 px-3 py-1.5 text-xs font-display text-white">
            <div className="w-1.5 h-1.5 rounded-full bg-white recording-pulse" />
            LIVE
          </div>
        )}
        {showControlHint && (
          <div className="flex items-center gap-1.5 bg-success/20 border border-success/40 px-3 py-1.5 text-xs font-display text-success">
            <MousePointer size={10} />
            CONTROL ACTIVE — click to interact
          </div>
        )}
      </div>

      {/* Corner decoration */}
      <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-accent/30 pointer-events-none z-40" />
      <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-accent/30 pointer-events-none z-40" />
      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-accent/30 pointer-events-none z-40" />
      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-accent/30 pointer-events-none z-40" />
    </div>
  );
});

export default VideoStream;
