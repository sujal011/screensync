import {
  createSession,
  getSession,
  addViewer,
  removeParticipant,
  getSessionByHost,
  getSessionByParticipant,
  setControlEnabled,
  updateViewerCursor,
  serializeSession,
} from './sessionManager.js';

// Simple rate limiter per socket
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
    console.log(`[+] Connected: ${socket.id}`);

    // ─── Create Session ────────────────────────────────────────────────
    socket.on('create-session', ({ hostName }, callback) => {
      try {
        const sessionId = createSession(socket.id, hostName || 'Host');
        socket.join(sessionId);
        socket.data.sessionId = sessionId;
        socket.data.role = 'host';
        socket.data.name = hostName || 'Host';
        console.log(`[Session] Created: ${sessionId} by ${socket.id}`);
        callback({ success: true, sessionId });
      } catch (err) {
        callback({ success: false, error: err.message });
      }
    });

    // ─── Join Session ──────────────────────────────────────────────────
    socket.on('join-session', ({ sessionId, viewerName }, callback) => {
      const session = getSession(sessionId);
      if (!session) {
        return callback({ success: false, error: 'Session not found' });
      }

      const ok = addViewer(sessionId, socket.id, viewerName || 'Viewer');
      if (!ok) return callback({ success: false, error: 'Could not join session' });

      socket.join(sessionId);
      socket.data.sessionId = sessionId;
      socket.data.role = 'viewer';
      socket.data.name = viewerName || 'Viewer';

      // Notify others
      socket.to(sessionId).emit('user-joined', {
        id: socket.id,
        name: viewerName || 'Viewer',
        role: 'viewer',
      });

      callback({
        success: true,
        session: serializeSession(session),
        viewerId: socket.id,
      });

      console.log(`[Session] ${socket.id} joined ${sessionId}`);
    });

    // ─── WebRTC Signaling ──────────────────────────────────────────────
    socket.on('webrtc-offer', ({ targetId, offer }) => {
      io.to(targetId).emit('webrtc-offer', {
        fromId: socket.id,
        offer,
      });
    });

    socket.on('webrtc-answer', ({ targetId, answer }) => {
      io.to(targetId).emit('webrtc-answer', {
        fromId: socket.id,
        answer,
      });
    });

    socket.on('ice-candidate', ({ targetId, candidate }) => {
      io.to(targetId).emit('ice-candidate', {
        fromId: socket.id,
        candidate,
      });
    });

    // ─── Control Events ────────────────────────────────────────────────
    socket.on('control-event', (data) => {
      const sessionId = socket.data.sessionId;
      if (!sessionId) return;

      const session = getSession(sessionId);
      if (!session) return;
      if (!session.controlEnabled) return;
      if (session.hostSocketId === socket.id) return; // host can't send control to themselves

      // Rate limit mousemove
      if (data.type === 'mousemove' && isRateLimited(socket.id)) return;

      // Track cursor for visualization
      if (data.type === 'mousemove' && data.x != null) {
        updateViewerCursor(sessionId, socket.id, { x: data.x, y: data.y });
        // Broadcast cursor to all in session (including host)
        socket.to(sessionId).emit('cursor-update', {
          id: socket.id,
          name: socket.data.name,
          x: data.x,
          y: data.y,
        });
      }

      // Forward to host
      io.to(session.hostSocketId).emit('control-event', {
        ...data,
        fromId: socket.id,
        fromName: socket.data.name,
      });
    });

    // ─── Toggle Control ────────────────────────────────────────────────
    socket.on('toggle-control', ({ enabled }) => {
      const sessionId = socket.data.sessionId;
      if (!sessionId) return;
      const session = getSession(sessionId);
      if (!session || session.hostSocketId !== socket.id) return;

      setControlEnabled(sessionId, enabled);
      io.to(sessionId).emit('control-toggled', { enabled });
      console.log(`[Control] Session ${sessionId}: control ${enabled ? 'ON' : 'OFF'}`);
    });

    // ─── Disconnect ────────────────────────────────────────────────────
    socket.on('ping_ts', (ts, cb) => { if (typeof cb === 'function') cb(Date.now()); });

    socket.on('disconnect', () => {
      console.log(`[-] Disconnected: ${socket.id}`);
      const sessionId = socket.data.sessionId;
      const removedSessions = removeParticipant(socket.id);
      rateLimits.delete(socket.id);

      if (sessionId) {
        if (removedSessions.includes(sessionId)) {
          // Host left — notify everyone
          io.to(sessionId).emit('host-left');
        } else {
          socket.to(sessionId).emit('user-left', {
            id: socket.id,
            name: socket.data.name,
          });
        }
      }
    });
  });
}

// Note: ping_ts is added inline above — this file is complete.
