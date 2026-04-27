import React from 'react';

export default function ActivityTimeline({ activities }) {
  const getIcon = (action) => {
    const a = action.toLowerCase();
    if (a.includes('login')) return '🔐';
    if (a.includes('scan')) return '📡';
    if (a.includes('alert')) return '⚠️';
    if (a.includes('threat')) return '🚨';
    if (a.includes('phishing')) return '🎣';
    if (a.includes('password')) return '🔑';
    return '📝';
  };

  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="glass-card p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xs font-bold font-mono text-cyber-muted uppercase tracking-widest">
          Activity Timeline
        </h3>
        <span className="text-[10px] font-mono text-cyber-muted">Latest 10 Events</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-5 pr-2 custom-scrollbar">
        {activities.length > 0 ? (
          activities.map((item, i) => (
            <div key={item._id || i} className="relative pl-6 border-l border-cyber-border/30 animate-slideUp" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-cyber-bg border border-cyber flex items-center justify-center text-[10px] z-10 shadow-glow">
                {getIcon(item.action)}
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyber-text">{item.action}</span>
                  <span className="text-[10px] font-mono text-cyber-muted">{getTimeAgo(item.timestamp)}</span>
                </div>
                <p className="text-[11px] text-cyber-muted leading-relaxed line-clamp-2">
                  {item.details}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full opacity-30 gap-2">
            <span className="text-4xl">🗒️</span>
            <p className="text-xs font-mono tracking-widest uppercase">No Recent Activity</p>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-cyber">
        <button className="w-full py-2 rounded-lg text-[10px] font-mono font-bold text-cyber-muted hover:text-cyber-accent hover:bg-cyber-accent/5 transition-all text-center uppercase tracking-widest">
          View Full Security Audit Log
        </button>
      </div>
    </div>
  );
}
