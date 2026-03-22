import { v4 as uuidv4 } from 'uuid';

const sessions = new Map();

export function createSession(hostSocketId, hostName) {
  const sessionId = uuidv4();
  sessions.set(sessionId, {
    id: sessionId,
    hostSocketId,
    hostName,
    viewers: new Map(),
    controlEnabled: false,
    createdAt: Date.now(),
  });
  return sessionId;
}

export function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

export function addViewer(sessionId, socketId, viewerName) {
  const session = sessions.get(sessionId);
  if (!session) return false;
  session.viewers.set(socketId, {
    id: socketId,
    name: viewerName,
    cursor: { x: 0, y: 0 },
  });
  return true;
}

export function removeParticipant(socketId) {
  const removedSessions = [];
  for (const [sessionId, session] of sessions.entries()) {
    if (session.viewers.has(socketId)) {
      session.viewers.delete(socketId);
    }
    if (session.hostSocketId === socketId) {
      sessions.delete(sessionId);
      removedSessions.push(sessionId);
    }
  }
  return removedSessions;
}

export function getSessionByHost(socketId) {
  for (const session of sessions.values()) {
    if (session.hostSocketId === socketId) return session;
  }
  return null;
}

export function getSessionByParticipant(socketId) {
  for (const session of sessions.values()) {
    if (session.hostSocketId === socketId) return session;
    if (session.viewers.has(socketId)) return session;
  }
  return null;
}

export function setControlEnabled(sessionId, enabled) {
  const session = sessions.get(sessionId);
  if (session) session.controlEnabled = enabled;
}

export function updateViewerCursor(sessionId, socketId, cursor) {
  const session = sessions.get(sessionId);
  if (!session) return;
  const viewer = session.viewers.get(socketId);
  if (viewer) viewer.cursor = cursor;
}

export function serializeSession(session) {
  return {
    id: session.id,
    hostSocketId: session.hostSocketId,
    hostName: session.hostName,
    viewers: Array.from(session.viewers.values()),
    controlEnabled: session.controlEnabled,
  };
}
