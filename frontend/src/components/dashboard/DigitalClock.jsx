import React, { useState, useEffect } from 'react';

export default function DigitalClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <div className="flex flex-col items-end">
      <div className="text-2xl font-bold font-mono tracking-tighter text-cyber-accent flex items-baseline gap-1">
        <span className="drop-shadow-glow">{formatTime(time).split(':')[0]}</span>
        <span className="text-cyber-muted animate-pulse">:</span>
        <span className="drop-shadow-glow">{formatTime(time).split(':')[1]}</span>
        <span className="text-cyber-muted animate-pulse">:</span>
        <span className="text-sm opacity-70">{formatTime(time).split(':')[2]}</span>
      </div>
      <div className="text-[10px] font-mono text-cyber-muted uppercase tracking-widest mt-0.5">
        {formatDate(time)}
      </div>
    </div>
  );
}
