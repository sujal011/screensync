import React from 'react';
import { Users, Crown, Eye } from 'lucide-react';
import { useSessionStore } from '../store/sessionStore';

function colorFromName(name) {
  const colors = ['#00e5ff', '#69ff47', '#ff6b6b', '#ffd93d', '#c792ea', '#ff9a9e'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function Avatar({ name, size = 28 }) {
  const color = colorFromName(name);
  return (
    <div
      className="flex items-center justify-center font-display font-bold text-xs flex-shrink-0"
      style={{ width: size, height: size, background: `${color}22`, border: `1px solid ${color}66`, color }}
    >
      {name[0]?.toUpperCase()}
    </div>
  );
}

export default function ParticipantList() {
  const { hostName, viewers, myId, hostId, role } = useSessionStore();

  const all = [
    { id: hostId, name: hostName || 'Host', role: 'host' },
    ...viewers.map((v) => ({ ...v, role: 'viewer' })),
  ];

  return (
    <div className="glass-panel">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Users size={13} className="text-accent" />
        <span className="text-xs font-display text-muted tracking-widest">PARTICIPANTS</span>
        <span className="ml-auto text-xs font-display text-accent">{all.length}</span>
      </div>
      <div className="p-2 space-y-1">
        {all.map((p) => (
          <div
            key={p.id}
            className={`flex items-center gap-3 px-3 py-2 ${p.id === myId ? 'bg-accent/5 border border-accent/20' : 'hover:bg-white/3'}`}
          >
            <Avatar name={p.name || '?'} />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white font-body truncate">
                {p.name}
                {p.id === myId && <span className="text-muted text-xs ml-1">(you)</span>}
              </div>
            </div>
            {p.role === 'host' ? (
              <Crown size={12} className="text-warning flex-shrink-0" />
            ) : (
              <Eye size={12} className="text-muted flex-shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export { Avatar, colorFromName };
