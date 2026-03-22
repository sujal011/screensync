# ScreenSync 🖥️

Real-time browser-based screen sharing and remote control collaboration app.  
**No installs. No extensions. Just a link.**

---

## Architecture

```
Browser A (Host)          Signaling Server          Browser B (Viewer)
     │                    (Hono + Socket.io)              │
     │──── create-session ────────────────────────────────│
     │                         │                          │
     │                         │◄──── join-session ───────│
     │◄──── user-joined ───────│                          │
     │                         │                          │
     │──── webrtc-offer ──────►│──── webrtc-offer ───────►│
     │◄─── webrtc-answer ──────│◄─── webrtc-answer ───────│
     │──── ice-candidate ─────►│──── ice-candidate ──────►│
     │                         │                          │
     │◄════════ WebRTC P2P Video Stream ════════════════► │
     │                         │                          │
     │◄─── control-event ──────│◄─── control-event ───────│
     │  (replayed in DOM)      │  (mouse/keyboard)        │
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Zustand |
| Backend | Node.js, Socket.io, HTTP |
| Video | WebRTC (`getDisplayMedia`) |
| Signaling | WebSocket via Socket.io |
| Fonts | Space Mono (display), DM Sans (body) |

---

## Local Development

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env → set FRONTEND_URL=http://localhost:5173
npm run dev
# Runs on http://localhost:3001
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local → VITE_BACKEND_URL=http://localhost:3001
npm run dev
# Runs on http://localhost:5173
```

---

## Deployment

### Backend → Render (Free tier)

1. Push `backend/` to a GitHub repo
2. Create a new **Web Service** on Render
3. Set:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Environment variables:**
     - `FRONTEND_URL` → your Vercel frontend URL (e.g. `https://screensync.vercel.app`)
     - `PORT` → `3001` (or leave for Render to assign)

### Frontend → Vercel

1. Push `frontend/` to a GitHub repo
2. Import to Vercel
3. Set environment variable:
   - `VITE_BACKEND_URL` → your Render backend URL (e.g. `https://screensync-backend.onrender.com`)
4. Deploy — `vercel.json` handles SPA routing

---

## Features

### Session System
- Host creates a session → gets a unique UUID-based session ID + shareable link
- Viewers join via link or by pasting session ID
- Participant list with role badges (👑 host, 👁 viewer)

### Screen Sharing
- `navigator.mediaDevices.getDisplayMedia()` — tab, window, or full screen
- Preview shown to host immediately
- Stream auto-stops when host closes the browser share UI

### WebRTC Streaming
- Peer-to-peer video via WebRTC (no video passes through server)
- STUN servers for NAT traversal
- Multiple viewers: host creates one `RTCPeerConnection` per viewer (mesh)
- ICE candidate exchange via Socket.io signaling

### Remote Control (Browser-only)
- Host toggles control on/off per session
- Viewers send: `mousemove`, `mousedown`, `mouseup`, `keydown`, `keyup`
- Host replays events via `element.dispatchEvent()` at coordinates
- Text input support: `HTMLInputElement.value` setter + `input` event dispatch
- Backspace support for text fields

### Performance & Safety
- Mousemove throttled to ~40ms on viewer side
- Server-side rate limiting: 30ms per socket
- Control events rejected if `controlEnabled === false`
- Host cannot accidentally send control to themselves

### Viewer Cursors
- All viewer cursor positions broadcast to host in real time
- Color-coded cursors with name labels rendered as DOM overlays
- CSS `transition` for smooth cursor animation

### Latency Indicator
- RTT ping every 3 seconds via Socket.io ack
- Color coded: green <50ms, yellow <120ms, red ≥120ms

---

## Socket Events Reference

| Event | Direction | Payload |
|-------|-----------|---------|
| `create-session` | Client→Server | `{ hostName }` → `{ success, sessionId }` |
| `join-session` | Client→Server | `{ sessionId, viewerName }` → `{ success, session, viewerId }` |
| `webrtc-offer` | Client→Server→Client | `{ targetId, offer }` |
| `webrtc-answer` | Client→Server→Client | `{ targetId, answer }` |
| `ice-candidate` | Client→Server→Client | `{ targetId, candidate }` |
| `control-event` | Viewer→Server→Host | `{ type, x, y, key, ... }` |
| `toggle-control` | Host→Server | `{ enabled }` |
| `control-toggled` | Server→All | `{ enabled }` |
| `user-joined` | Server→Room | `{ id, name, role }` |
| `user-left` | Server→Room | `{ id, name }` |
| `cursor-update` | Server→Room | `{ id, name, x, y }` |
| `host-left` | Server→Viewers | `{}` |
| `ping_ts` | Client→Server | `timestamp` → `timestamp` |

---

## Limitations (By Design)

- **Browser-only control**: Events are replayed via DOM APIs only — no OS-level control
- **No video relay**: Backend never touches video data; all streams are P2P
- **Same-origin control**: Remote control works on the host's current browser viewport
- **STUN only**: For production with strict NAT, add TURN servers to `webrtc.js`

## Adding TURN Servers (Production)

Edit `frontend/src/utils/webrtc.js`:

```js
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:your-turn-server.com:3478',
      username: 'user',
      credential: 'pass',
    },
  ],
};
```

Free TURN options: [Metered.ca](https://www.metered.ca/tools/openrelay/), [Cloudflare Calls](https://developers.cloudflare.com/calls/)

