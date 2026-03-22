import { useEffect, useRef } from 'react';
import { getSocket } from '../utils/socket';
import { useSessionStore } from '../store/sessionStore';

export function useLatency() {
  const { setLatency } = useSessionStore();
  const intervalRef = useRef(null);

  useEffect(() => {
    const socket = getSocket();

    const ping = () => {
      const start = Date.now();
      socket.emit('ping_ts', start, (serverTs) => {
        const rtt = Date.now() - start;
        setLatency(Math.round(rtt / 2));
      });
    };

    intervalRef.current = setInterval(ping, 3000);
    ping();

    return () => clearInterval(intervalRef.current);
  }, [setLatency]);
}
