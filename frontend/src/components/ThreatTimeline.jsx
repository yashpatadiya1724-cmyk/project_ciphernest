import React, { useState, useEffect } from 'react';
import { dashAPI } from '../services/api';
import socket from '../services/socket';
import { Spinner } from './common/index';

const ThreatTimeline = ({ limit = 20 }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTimeline = async () => {
    try {
      const { data } = await dashAPI.timeline(limit);
      setEvents(data);
    } catch (err) {
      console.error('Failed to fetch timeline:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();

    // Listen for real-time triggers that should refresh the timeline
    const handleUpdate = () => fetchTimeline();
    
    socket.on('port-update', handleUpdate);
    socket.on('network-update', handleUpdate);
    socket.on('alert-new', handleUpdate);

    return () => {
      socket.off('port-update', handleUpdate);
      socket.off('network-update', handleUpdate);
      socket.off('alert-new', handleUpdate);
    };
  }, []);

  if (loading) return <div className="flex justify-center p-8"><Spinner /></div>;

  if (events.length === 0) return (
    <div className="text-center p-12 glass-card border-dashed border-2">
      <p className="text-cyber-muted text-sm italic">No security events recorded yet.</p>
    </div>
  );

  return (
    <div className="space-y-4 relative">
      {/* Vertical line */}
      <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-cyber-accent/40 via-cyber-muted/10 to-transparent"></div>

      {events.map((event, idx) => (
        <div key={idx} className="relative pl-10 group animate-slideIn" style={{ animationDelay: `${idx * 0.05}s` }}>
          {/* Timeline Dot */}
          <div className={`absolute left-0 top-1.5 w-[40px] h-[40px] rounded-lg border flex items-center justify-center text-lg z-10 transition-all group-hover:scale-110 ${
            event.severity === 'critical' ? 'bg-cyber-red/10 border-cyber-red/30' : 
            event.severity === 'high' ? 'bg-cyber-red/5 border-cyber-red/20' :
            event.severity === 'medium' ? 'bg-cyber-yellow/5 border-cyber-yellow/20' :
            'bg-cyber-bg border-cyber-border/40'
          }`}>
            {event.icon}
          </div>

          <div className="glass-card p-4 hover:border-cyber-accent/30 transition-all">
            <div className="flex justify-between items-start mb-1">
              <h4 className={`text-sm font-bold ${
                event.severity === 'critical' ? 'text-cyber-red' : 
                event.severity === 'high' ? 'text-cyber-red/80' : 
                'text-cyber-text'
              }`}>
                {event.title}
              </h4>
              <span className="text-[10px] text-cyber-muted font-mono uppercase">
                {new Date(event.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="text-xs text-cyber-muted leading-relaxed">{event.desc}</p>
            
            <div className="flex items-center gap-2 mt-3">
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                event.type === 'alert' ? 'bg-cyber-red/10 text-cyber-red' : 
                event.type === 'tool' ? 'bg-cyber-accent/10 text-cyber-accent' : 
                'bg-cyber-muted/10 text-cyber-muted'
              }`}>
                {event.type}
              </span>
              {event.severity !== 'info' && (
                <span className={`text-[9px] font-mono tracking-tighter ${
                  event.severity === 'critical' || event.severity === 'high' ? 'text-cyber-red' : 'text-cyber-yellow'
                }`}>
                  [{event.severity.toUpperCase()}]
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ThreatTimeline;
