import React, { useRef, useEffect, forwardRef } from 'react';
import { Monitor, WifiOff, MousePointer } from 'lucide-react';
import { useSessionStore } from '../store/sessionStore';
import RemoteCursors from './RemoteCursors';

const VideoStream = forwardRef(function VideoStream({ isLocal = false, controlLayerRef }, ref) {
  const { isStreaming, isSharingScreen, controlEnabled } = useSessionStore();
  const containerRef = useRef(null);

  const showVideo = isLocal ? isSharingScreen : isStreaming;
  const showControlHint = !isLocal && controlEnabled;

  // For remote video: start muted so autoplay works, then unmute once playing
  useEffect(() => {
    if (isLocal) return;
    const video = ref?.current;
    if (!video) return;

    const onPlay = () => {
      // Slight delay before unmuting avoids a Chrome click/pop
      setTimeout(() => {
        if (video) video.muted = false;
      }, 200);
    };

    video.addEventListener('play', onPlay);
    return () => video.removeEventListener('play', onPlay);
  }, [isLocal, ref]);

  return (
    <div ref={containerRef} className="relative flex-1 video-wrapper scanlines bg-ink min-h-0" style={{ minHeight: 0 }}>
      {/* Empty state */}
      {!showVideo && (
        <div className="absolute inset-0 grid-bg flex flex-col items-center justify-center gap-4 z-10">
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

      {/* Video — always in DOM so ref is stable; hidden until stream active */}
      <video
        ref={ref}
        autoPlay
        playsInline
        muted        // always start muted; useEffect unmutes after play
        className={`w-full h-full object-contain transition-opacity duration-300 ${showVideo ? 'opacity-100' : 'opacity-0'}`}
        style={{ display: 'block' }}
      />

      {/* Control capture overlay — sits above video, captures pointer/keyboard */}
      {!isLocal && (
        <div
          ref={controlLayerRef}
          className={`absolute inset-0 z-20 ${controlEnabled ? 'cursor-crosshair' : 'pointer-events-none'}`}
          tabIndex={controlEnabled ? 0 : -1}
          style={{ outline: 'none', background: 'transparent' }}
        />
      )}

      {/* Remote cursors rendered on host view */}
      {isLocal && (
        <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
          <RemoteCursors containerRef={containerRef} />
        </div>
      )}

      {/* Status badges */}
      <div className="absolute top-3 left-3 flex items-center gap-2 z-40 pointer-events-none">
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

      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-accent/30 pointer-events-none z-40" />
      <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-accent/30 pointer-events-none z-40" />
      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-accent/30 pointer-events-none z-40" />
      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-accent/30 pointer-events-none z-40" />
    </div>
  );
});

export default VideoStream;
