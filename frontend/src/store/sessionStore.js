import { create } from 'zustand';

export const useSessionStore = create((set, get) => ({
  // Session info
  sessionId: null,
  role: null, // 'host' | 'viewer'
  myName: '',
  myId: null,

  // Participants
  viewers: [],
  hostName: '',
  hostId: null,

  // State
  controlEnabled: false,
  isStreaming: false,
  isConnected: false,
  isSharingScreen: false,

  // Latency
  latency: null,

  // Actions
  setSession: (data) => set(data),
  setRole: (role) => set({ role }),
  setMyName: (name) => set({ myName: name }),
  setMyId: (id) => set({ myId: id }),
  setConnected: (v) => set({ isConnected: v }),
  setStreaming: (v) => set({ isStreaming: v }),
  setSharingScreen: (v) => set({ isSharingScreen: v }),
  setControlEnabled: (v) => set({ controlEnabled: v }),
  setLatency: (v) => set({ latency: v }),

  addViewer: (viewer) =>
    set((s) => ({
      viewers: [...s.viewers.filter((v) => v.id !== viewer.id), viewer],
    })),

  removeViewer: (id) =>
    set((s) => ({ viewers: s.viewers.filter((v) => v.id !== id) })),

  setViewers: (viewers) => set({ viewers }),

  reset: () =>
    set({
      sessionId: null,
      role: null,
      myName: '',
      myId: null,
      viewers: [],
      hostName: '',
      hostId: null,
      controlEnabled: false,
      isStreaming: false,
      isConnected: false,
      isSharingScreen: false,
      latency: null,
    }),
}));
