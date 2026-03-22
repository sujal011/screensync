import { createServer } from 'http';
import { Server } from 'socket.io';
import { setupSocket } from './socket.js';

const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || '*';

const httpServer = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', FRONTEND_URL);
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', service: 'ScreenSync', ts: Date.now() }));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL === '*' ? '*' : FRONTEND_URL.split(','),
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingInterval: 10000,
  pingTimeout: 5000,
});

setupSocket(io);

httpServer.listen(PORT, () => {
  console.log(`🚀 ScreenSync backend running on port ${PORT}`);
  console.log(`   CORS: ${FRONTEND_URL}`);
});
