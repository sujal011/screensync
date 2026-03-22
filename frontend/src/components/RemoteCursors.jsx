import React, { useState, useEffect } from 'react';
import { getSocket } from '../utils/socket';
import { colorFromName } from './ParticipantList';

export default function RemoteCursors({ containerRef }) {
  const [cursors, setCursors] = useState({}); // id -> { x, y, name }

  useEffect(() => {
    const socket = getSocket();
    socket.on('cursor-update', ({ id, name, x, y }) => {
      setCursors((prev) => ({ ...prev, [id]: { x, y, name } }));
    });
    socket.on('user-left', ({ id }) => {
      setCursors((prev) => { const n = { ...prev }; delete n[id]; return n; });
    });
    return () => {
      socket.off('cursor-update');
      socket.off('user-left');
    };
  }, []);

  return (
    <>
      {Object.entries(cursors).map(([id, { x, y, name }]) => {
        const color = colorFromName(name);
        return (
          <div
            key={id}
            className="remote-cursor"
            style={{ left: x, top: y }}
          >
            {/* Cursor SVG */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 2L16 10L10 11L7 18L4 2Z" fill={color} stroke="#000" strokeWidth="1" />
            </svg>
            {/* Name label */}
            <div
              className="absolute top-5 left-2 text-xs font-display px-2 py-0.5 whitespace-nowrap"
              style={{ background: `${color}dd`, color: '#000' }}
            >
              {name}
            </div>
          </div>
        );
      })}
    </>
  );
}
