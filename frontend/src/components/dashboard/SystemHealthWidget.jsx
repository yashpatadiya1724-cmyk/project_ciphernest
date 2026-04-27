import React, { useState, useEffect } from 'react';
import { networkAPI } from '../../services/api';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';

export default function SystemHealthWidget() {
  const [stats, setStats] = useState({
    cpuLoad: 0,
    memUsage: 0,
    rx_sec: 0,
    tx_sec: 0,
    rxHistory: []
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await networkAPI.stats();
        setStats(prev => {
          const newHistory = [...prev.rxHistory, { time: Date.now(), rx: data.rx_sec / 1024, tx: data.tx_sec / 1024 }].slice(-20);
          return { ...data, rxHistory: newHistory };
        });
      } catch (err) {
        console.error('Stats fetch error:', err);
      }
    };

    const interval = setInterval(fetchStats, 3000);
    fetchStats();
    return () => clearInterval(interval);
  }, []);

  const formatBps = (bytes) => {
    if (bytes > 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB/s';
    if (bytes > 1024) return (bytes / 1024).toFixed(1) + ' KB/s';
    return bytes + ' B/s';
  };

  return (
    <div className="glass-card p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xs font-bold font-mono text-cyber-muted uppercase tracking-widest">
          Live System Health
        </h3>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyber-green animate-pulse" />
          <span className="text-[10px] font-mono text-cyber-green uppercase">Real-time</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-cyber-muted">CPU LOAD</span>
            <span className={stats.cpuLoad > 80 ? 'text-cyber-red' : 'text-cyber-accent'}>{stats.cpuLoad}%</span>
          </div>
          <div className="h-1.5 w-full bg-cyber-bg rounded-full overflow-hidden border border-cyber">
            <div className="h-full bg-gradient-to-r from-cyber-accent to-purple-500 transition-all duration-500" style={{ width: `${stats.cpuLoad}%` }} />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-cyber-muted">RAM USAGE</span>
            <span className={stats.memUsage > 80 ? 'text-cyber-red' : 'text-cyber-accent'}>{stats.memUsage}%</span>
          </div>
          <div className="h-1.5 w-full bg-cyber-bg rounded-full overflow-hidden border border-cyber">
            <div className="h-full bg-gradient-to-r from-cyber-accent to-purple-500 transition-all duration-500" style={{ width: `${stats.memUsage}%` }} />
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-[100px] mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={stats.rxHistory}>
            <Line 
              type="monotone" 
              dataKey="rx" 
              stroke="#00D4FF" 
              strokeWidth={2} 
              dot={false} 
              isAnimationActive={false}
            />
            <Line 
              type="monotone" 
              dataKey="tx" 
              stroke="#8B5CF6" 
              strokeWidth={2} 
              dot={false} 
              isAnimationActive={false}
            />
            <YAxis hide />
            <Tooltip 
              contentStyle={{ background: '#050505', border: '1px solid #1A2744', fontSize: '10px' }}
              itemStyle={{ padding: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 border-t border-cyber pt-4">
        <div>
          <p className="text-[9px] text-cyber-muted uppercase font-mono mb-1">Download</p>
          <p className="text-sm font-bold text-cyber-accent font-mono">{formatBps(stats.rx_sec)}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-cyber-muted uppercase font-mono mb-1">Upload</p>
          <p className="text-sm font-bold text-purple-400 font-mono">{formatBps(stats.tx_sec)}</p>
        </div>
      </div>
    </div>
  );
}
