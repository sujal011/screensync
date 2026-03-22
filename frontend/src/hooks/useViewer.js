import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../utils/socket';
import { createPeerConnection, createAnswer, createIceCandidateQueue } from '../utils/webrtc';
import { useSessionStore } from '../store/sessionStore';

function throttle(fn, ms) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= ms) { last = now; fn(...args); }
  };
}

export function useViewer({ remoteVideoRef, controlLayerRef }) {
  const pc = useRef(null);
  const iceQueue = useRef(null);
  const { setStreaming, setControlEnabled, removeViewer, addViewer, controlEnabled } = useSessionStore();

  const sendControlEvent = useCallback((data) => {
    getSocket().emit('control-event', data);
  }, []);

  const throttledMouseMove = useRef(throttle((data) => sendControlEvent(data), 40)).current;

  const attachControlListeners = useCallback(() => {
    const layer = controlLayerRef?.current;
    if (!layer) return;

    const getCoords = (e) => {
      const rect = layer.getBoundingClientRect();
      return {
        x: Math.round(e.clientX - rect.left),
        y: Math.round(e.clientY - rect.top),
      };
    };

    const onMouseMove = (e) => throttledMouseMove({ type: 'mousemove', ...getCoords(e) });
    const onMouseDown = (e) => sendControlEvent({ type: 'mousedown', ...getCoords(e), button: e.button });
    const onMouseUp   = (e) => sendControlEvent({ type: 'mouseup',   ...getCoords(e), button: e.button });
    const onKeyDown   = (e) => { e.preventDefault(); sendControlEvent({ type: 'keydown', key: e.key, code: e.code, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey }); };
    const onKeyUp     = (e) => sendControlEvent({ type: 'keyup', key: e.key, code: e.code, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey });

    layer.addEventListener('mousemove', onMouseMove);
    layer.addEventListener('mousedown', onMouseDown);
    layer.addEventListener('mouseup', onMouseUp);
    layer.addEventListener('keydown', onKeyDown);
    layer.addEventListener('keyup', onKeyUp);
    layer.setAttribute('tabindex', '0');

    return () => {
      layer.removeEventListener('mousemove', onMouseMove);
      layer.removeEventListener('mousedown', onMouseDown);
      layer.removeEventListener('mouseup', onMouseUp);
      layer.removeEventListener('keydown', onKeyDown);
      layer.removeEventListener('keyup', onKeyUp);
    };
  }, [controlLayerRef, throttledMouseMove, sendControlEvent]);

  useEffect(() => {
    const socket = getSocket();

    // ── Receive WebRTC offer from host ──────────────────────────────────
    socket.on('webrtc-offer', async ({ fromId, offer }) => {
      console.log('[Viewer] Got offer from', fromId);

      // Close stale connection if any
      if (pc.current) { pc.current.close(); pc.current = null; }

      const conn = createPeerConnection();
      pc.current = conn;

      // Create ICE candidate queue BEFORE setting remote description
      const icq = createIceCandidateQueue(conn);
      iceQueue.current = icq;

      // ── Track handler — try both event.streams and addtrack on stream ──
      conn.ontrack = (event) => {
        console.log('[Viewer] ontrack fired, streams:', event.streams.length, 'track kind:', event.track.kind);
        const stream = event.streams[0];
        if (stream && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          // Chrome sometimes needs a play() call after srcObject assignment
          remoteVideoRef.current.play().catch(() => {
            // Autoplay blocked — unmute and try again (user gesture fallback)
            console.warn('[Viewer] Autoplay blocked, trying muted play');
            remoteVideoRef.current.muted = true;
            remoteVideoRef.current.play().catch(console.error);
          });
          setStreaming(true);
        } else if (!stream) {
          // Fallback: build MediaStream from tracks manually
          console.log('[Viewer] No stream in ontrack, building manually');
          let ms = remoteVideoRef.current?.srcObject;
          if (!(ms instanceof MediaStream)) {
            ms = new MediaStream();
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = ms;
          }
          ms.addTrack(event.track);
          remoteVideoRef.current?.play().catch(console.error);
          setStreaming(true);
        }
      };

      conn.onicecandidate = ({ candidate }) => {
        if (candidate) socket.emit('ice-candidate', { targetId: fromId, candidate });
      };

      conn.oniceconnectionstatechange = () => {
        console.log('[Viewer] ICE state:', conn.iceConnectionState);
        if (conn.iceConnectionState === 'connected' || conn.iceConnectionState === 'completed') {
          setStreaming(true);
        }
        if (['disconnected', 'failed', 'closed'].includes(conn.iceConnectionState)) {
          setStreaming(false);
        }
      };

      conn.onconnectionstatechange = () => {
        console.log('[Viewer] Connection state:', conn.connectionState);
      };

      // Create answer — this sets remoteDescription, then flush queued ICE
      const answer = await createAnswer(conn, offer);
      await icq.flush(); // flush any ICE candidates that arrived before this
      socket.emit('webrtc-answer', { targetId: fromId, answer });
      console.log('[Viewer] Sent answer to', fromId);
    });

    // ── ICE candidates from host ────────────────────────────────────────
    socket.on('ice-candidate', async ({ fromId, candidate }) => {
      console.log('[Viewer] Got ICE candidate from', fromId);
      if (iceQueue.current) {
        await iceQueue.current.add(candidate);
      } else if (pc.current?.remoteDescription) {
        try { await pc.current.addIceCandidate(new RTCIceCandidate(candidate)); }
        catch (e) { console.warn('ICE error:', e); }
      }
    });

    socket.on('user-joined', (user) => addViewer(user));
    socket.on('user-left', ({ id }) => removeViewer(id));
    socket.on('control-toggled', ({ enabled }) => setControlEnabled(enabled));
    socket.on('host-left', () => {
      setStreaming(false);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    });

    return () => {
      socket.off('webrtc-offer');
      socket.off('ice-candidate');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('control-toggled');
      socket.off('host-left');
      pc.current?.close();
    };
  }, [remoteVideoRef, setStreaming, setControlEnabled, addViewer, removeViewer]);

  useEffect(() => {
    if (!controlEnabled) return;
    return attachControlListeners();
  }, [controlEnabled, attachControlListeners]);

  return { sendControlEvent };
}
