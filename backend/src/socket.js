import {
  createSession, getSession, addViewer, removeParticipant,
  setControlEnabled, updateViewerCursor, serializeSession,
} from './sessionManager.js';

const rateLimits = new Map();
const CONTROL_THROTTLE_MS = 30;

function isRateLimited(socketId) {
  const now = Date.now();
  const last = rateLimits.get(socketId) || 0;
  if (now - last < CONTROL_THROTTLE_MS) return true;
  rateLimits.set(socketId, now);
  return false;
}

export function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log(`[+] ${socket.id}`);

    // ── Latency ping ───────────────────────────────────────────────────
    socket.on('ping_ts', (ts, cb) => {
      if (typeof cb === 'function') cb(Date.now());
    });

    // ── Create Session ─────────────────────────────────────────────────
    socket.on('create-session', ({ hostName }, callback) => {
      try {
        const sessionId = createSession(socket.id, hostName || 'Host');
        socket.join(sessionId);
        socket.data.sessionId = sessionId;
        socket.data.role = 'host';
        socket.data.name = hostName || 'Host';
        console.log(`[Session] Created: ${sessionId}`);
        callback({ success: true, sessionId });
      } catch (err) {
        callback({ success: false, error: err.message });
      }
    });

    // ── Join Session ───────────────────────────────────────────────────
    socket.on('join-session', ({ sessionId, viewerName }, callback) => {
      const session = getSession(sessionId);
      if (!session) return callback({ success: false, error: 'Session not found' });

      const ok = addViewer(sessionId, socket.id, viewerName || 'Viewer');
      if (!ok) return callback({ success: false, error: 'Could not join' });

      socket.join(sessionId);
      socket.data.sessionId = sessionId;
      socket.data.role = 'viewer';
      socket.data.name = viewerName || 'Viewer';

      // Ack first so viewer sets up socket listeners, then notify host
      callback({ success: true, session: serializeSession(session), viewerId: socket.id });

      // Notify host AFTER callback is sent (gives viewer time to register listeners)
      setTimeout(() => {
        socket.to(sessionId).emit('user-joined', {
          id: socket.id,
          name: viewerName || 'Viewer',
          role: 'viewer',
        });
      }, 200);

      console.log(`[Session] ${socket.id} (${viewerName}) joined ${sessionId}`);
    });

    // ── WebRTC Signaling ───────────────────────────────────────────────
    socket.on('webrtc-offer', ({ targetId, offer }) => {
      console.log(`[SIG] offer ${socket.id} → ${targetId}`);
      io.to(targetId).emit('webrtc-offer', { fromId: socket.id, offer });
    });

    socket.on('webrtc-answer', ({ targetId, answer }) => {
      console.log(`[SIG] answer ${socket.id} → ${targetId}`);
      io.to(targetId).emit('webrtc-answer', { fromId: socket.id, answer });
    });

    socket.on('ice-candidate', ({ targetId, candidate }) => {
      io.to(targetId).emit('ice-candidate', { fromId: socket.id, candidate });
    });

    // ── Control Events ─────────────────────────────────────────────────
    socket.on('control-event', (data) => {
      const sessionId = socket.data.sessionId;
      if (!sessionId) return;
      const session = getSession(sessionId);
      if (!session?.controlEnabled) return;
      if (session.hostSocketId === socket.id) return;

      if (data.type === 'mousemove') {
        if (isRateLimited(socket.id)) return;
        updateViewerCursor(sessionId, socket.id, { x: data.x, y: data.y });
        socket.to(sessionId).emit('cursor-update', {
          id: socket.id, name: socket.data.name, x: data.x, y: data.y,
        });
      }

      io.to(session.hostSocketId).emit('control-event', {
        ...data, fromId: socket.id, fromName: socket.data.name,
      });
    });

    // ── Toggle Control ─────────────────────────────────────────────────
    socket.on('toggle-control', ({ enabled }) => {
      const sessionId = socket.data.sessionId;
      if (!sessionId) return;
      const session = getSession(sessionId);
      if (!session || session.hostSocketId !== socket.id) return;
      setControlEnabled(sessionId, enabled);
      io.to(sessionId).emit('control-toggled', { enabled });
    });

    // ── Disconnect ─────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[-] ${socket.id}`);
      const sessionId = socket.data.sessionId;
      const removedSessions = removeParticipant(socket.id);
      rateLimits.delete(socket.id);

      if (sessionId) {
        if (removedSessions.includes(sessionId)) {
          io.to(sessionId).emit('host-left');
        } else {
          socket.to(sessionId).emit('user-left', { id: socket.id, name: socket.data.name });
        }
      }
    });
  });
}
