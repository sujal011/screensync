import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../utils/socket';
import { createPeerConnection, createAnswer, addIceCandidate } from '../utils/webrtc';
import { useSessionStore } from '../store/sessionStore';

// Throttle helper (using ref to avoid re-render)
function throttle(fn, ms) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn(...args);
    }
  };
}

export function useViewer({ remoteVideoRef, controlLayerRef }) {
  const pc = useRef(null);
  const { setStreaming, setControlEnabled, removeViewer, addViewer, controlEnabled } = useSessionStore();
  const lastPingRef = useRef(null);

  // Control event sender
  const sendControlEvent = useCallback((data) => {
    const socket = getSocket();
    socket.emit('control-event', data);
  }, []);

  const throttledMouseMove = useRef(
    throttle((data) => sendControlEvent(data), 40)
  ).current;

  // Attach control listeners to the video/overlay element
  const attachControlListeners = useCallback(() => {
    const layer = controlLayerRef?.current;
    if (!layer) return;

    const getCoords = (e) => {
      const rect = layer.getBoundingClientRect();
      return {
        x: Math.round(e.clientX - rect.left + window.scrollX),
        y: Math.round(e.clientY - rect.top + window.scrollY),
      };
    };

    const onMouseMove = (e) => {
      const { x, y } = getCoords(e);
      throttledMouseMove({ type: 'mousemove', x, y });
    };
    const onMouseDown = (e) => {
      const { x, y } = getCoords(e);
      sendControlEvent({ type: 'mousedown', x, y, button: e.button });
    };
    const onMouseUp = (e) => {
      const { x, y } = getCoords(e);
      sendControlEvent({ type: 'mouseup', x, y, button: e.button });
    };
    const onKeyDown = (e) => {
      e.preventDefault();
      sendControlEvent({ type: 'keydown', key: e.key, code: e.code, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey });
    };
    const onKeyUp = (e) => {
      sendControlEvent({ type: 'keyup', key: e.key, code: e.code, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey });
    };

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

    // WebRTC: receive offer from host
    socket.on('webrtc-offer', async ({ fromId, offer }) => {
      const conn = createPeerConnection();
      pc.current = conn;

      conn.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setStreaming(true);
        }
      };

      conn.onicecandidate = ({ candidate }) => {
        if (candidate) socket.emit('ice-candidate', { targetId: fromId, candidate });
      };

      conn.onconnectionstatechange = () => {
        if (['disconnected', 'failed', 'closed'].includes(conn.connectionState)) {
          setStreaming(false);
        }
      };

      const answer = await createAnswer(conn, offer);
      socket.emit('webrtc-answer', { targetId: fromId, answer });
    });

    socket.on('ice-candidate', async ({ fromId, candidate }) => {
      if (pc.current) await addIceCandidate(pc.current, candidate);
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

  // Attach/detach control listeners based on controlEnabled
  useEffect(() => {
    if (!controlEnabled) return;
    const cleanup = attachControlListeners();
    return cleanup;
  }, [controlEnabled, attachControlListeners]);

  return { sendControlEvent };
}
