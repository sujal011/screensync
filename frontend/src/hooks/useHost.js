import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../utils/socket';
import { createPeerConnection, createOffer, handleAnswer, createIceCandidateQueue } from '../utils/webrtc';
import { useSessionStore } from '../store/sessionStore';

export function useHost({ localVideoRef }) {
  const peerConnections = useRef({});  // viewerId -> { pc, iceQueue }
  const localStream = useRef(null);
  const { setStreaming, setSharingScreen, addViewer, removeViewer, setControlEnabled } = useSessionStore();

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true,
      });
      localStream.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setSharingScreen(true);
      setStreaming(true);
      stream.getVideoTracks()[0].addEventListener('ended', () => stopScreenShare());
      return stream;
    } catch (err) {
      console.error('Screen share error:', err);
      throw err;
    }
  }, [localVideoRef, setSharingScreen, setStreaming]);

  const stopScreenShare = useCallback(() => {
    if (localStream.current) {
      localStream.current.getTracks().forEach((t) => t.stop());
      localStream.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    Object.values(peerConnections.current).forEach(({ pc }) => pc.close());
    peerConnections.current = {};
    setSharingScreen(false);
    setStreaming(false);
  }, [localVideoRef, setSharingScreen, setStreaming]);

  const createConnectionForViewer = useCallback(async (viewerId) => {
    const socket = getSocket();

    // Close any stale connection for this viewer
    if (peerConnections.current[viewerId]) {
      peerConnections.current[viewerId].pc.close();
    }

    const pc = createPeerConnection();
    const iceQueue = createIceCandidateQueue(pc);
    peerConnections.current[viewerId] = { pc, iceQueue };

    // ── Add all local stream tracks BEFORE creating offer ──────────────
    if (localStream.current) {
      console.log('[Host] Adding', localStream.current.getTracks().length, 'tracks to PC for', viewerId);
      localStream.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStream.current);
      });
    } else {
      console.warn('[Host] No local stream when creating connection for', viewerId);
    }

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) socket.emit('ice-candidate', { targetId: viewerId, candidate });
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[Host] ICE state for', viewerId, ':', pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
      console.log('[Host] Conn state for', viewerId, ':', pc.connectionState);
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        pc.close();
        delete peerConnections.current[viewerId];
      }
    };

    // Create offer and send — tracks are already added so SDP includes media
    const offer = await createOffer(pc);
    console.log('[Host] Sending offer to viewer', viewerId);
    socket.emit('webrtc-offer', { targetId: viewerId, offer });

    return pc;
  }, []);

  const replayControlEvent = useCallback((data) => {
    const { type, x, y, button, key, code, shiftKey, ctrlKey, altKey, metaKey } = data;
    const el = document.elementFromPoint(x, y);
    if (!el) return;

    const mInit = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: button || 0, shiftKey, ctrlKey, altKey, metaKey };
    const kInit = { bubbles: true, cancelable: true, key, code, shiftKey, ctrlKey, altKey, metaKey };

    if (type === 'mousedown') {
      el.dispatchEvent(new MouseEvent('mousedown', mInit));
      el.focus?.();
    } else if (type === 'mouseup') {
      el.dispatchEvent(new MouseEvent('mouseup', mInit));
      el.dispatchEvent(new MouseEvent('click', mInit));
    } else if (type === 'mousemove') {
      el.dispatchEvent(new MouseEvent('mousemove', mInit));
    } else if (type === 'keydown') {
      el.dispatchEvent(new KeyboardEvent('keydown', kInit));
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        const proto = active.tagName === 'INPUT' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) {
          if (key === 'Backspace') {
            setter.call(active, active.value.slice(0, -1));
          } else if (key.length === 1) {
            setter.call(active, active.value + key);
          }
          active.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    } else if (type === 'keyup') {
      el.dispatchEvent(new KeyboardEvent('keyup', kInit));
    }
  }, []);

  useEffect(() => {
    const socket = getSocket();

    socket.on('user-joined', async (viewer) => {
      console.log('[Host] user-joined:', viewer.id);
      addViewer(viewer);
      // Only create WebRTC connection if we're already sharing
      if (localStream.current) {
        // Small delay to ensure viewer's socket listeners are registered
        setTimeout(() => createConnectionForViewer(viewer.id), 300);
      }
    });

    socket.on('user-left', ({ id }) => {
      removeViewer(id);
      if (peerConnections.current[id]) {
        peerConnections.current[id].pc.close();
        delete peerConnections.current[id];
      }
    });

    socket.on('webrtc-answer', async ({ fromId, answer }) => {
      console.log('[Host] Got answer from', fromId);
      const entry = peerConnections.current[fromId];
      if (entry) {
        await handleAnswer(entry.pc, answer);
        // Flush any ICE candidates that were queued before answer arrived
        await entry.iceQueue.flush();
      }
    });

    socket.on('ice-candidate', async ({ fromId, candidate }) => {
      const entry = peerConnections.current[fromId];
      if (entry) await entry.iceQueue.add(candidate);
    });

    socket.on('control-event', replayControlEvent);
    socket.on('control-toggled', ({ enabled }) => setControlEnabled(enabled));

    return () => {
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('webrtc-answer');
      socket.off('ice-candidate');
      socket.off('control-event');
      socket.off('control-toggled');
    };
  }, [createConnectionForViewer, replayControlEvent, addViewer, removeViewer, setControlEnabled]);

  const toggleControl = useCallback((enabled) => {
    getSocket().emit('toggle-control', { enabled });
    setControlEnabled(enabled);
  }, [setControlEnabled]);

  // When host starts sharing AFTER viewers are already in the session,
  // we need to create connections for all existing viewers
  const startShareAndConnect = useCallback(async () => {
    const stream = await startScreenShare();
    const { viewers } = useSessionStore.getState();
    console.log('[Host] Starting share, existing viewers:', viewers.length);
    for (const viewer of viewers) {
      setTimeout(() => createConnectionForViewer(viewer.id), 300);
    }
    return stream;
  }, [startScreenShare, createConnectionForViewer]);

  return { startScreenShare: startShareAndConnect, stopScreenShare, toggleControl };
}
