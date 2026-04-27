import React, { useState, useEffect } from 'react';
import socket from '../services/socket';
import { Spinner, RiskBadge } from './common/index';

const PortScanner = () => {
  const [scanData, setScanData] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    socket.on('port-update', (data) => {
      setScanData(data);
      setHistory(prev => [data, ...prev].slice(0, 5));
    });

    return () => {
      socket.off('port-update');
    };
  }, []);

  if (!scanData) return (
    <div className="glass-card p-6 flex flex-col items-center justify-center min-h-[200px]">
      <Spinner size="lg" />
      <p className="text-cyber-muted mt-4 font-mono animate-pulse">Initializing real-time port monitor...</p>
    </div>
  );

  const riskyPorts = [21, 22, 23, 3306, 5432];
  const foundRisky = scanData.openPorts.filter(p => riskyPorts.includes(p.port));

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="glass-card p-5 border-l-4" style={{ borderLeftColor: foundRisky.length > 0 ? '#FF3366' : '#00FF88' }}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-bold text-cyber-text flex items-center gap-2">
              <span className="animate-pulse">📡</span> Real-Time Port Monitor
            </h3>
            <p className="text-xs text-cyber-muted font-mono">{scanData.target} • {new Date(scanData.timestamp).toLocaleTimeString()}</p>
          </div>
          <RiskBadge level={foundRisky.length > 2 ? 'high' : foundRisky.length > 0 ? 'medium' : 'low'} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {scanData.openPorts.length > 0 ? (
            scanData.openPorts.map((p, i) => (
              <div key={i} className={`p-3 rounded-lg border flex flex-col transition-all duration-500 ${riskyPorts.includes(p.port) ? 'bg-cyber-red/10 border-cyber-red/30' : 'bg-cyber-bg border-cyber-border/40'}`}>
                <span className="text-xs font-mono text-cyber-muted uppercase tracking-tighter">{p.service}</span>
                <span className={`text-lg font-bold font-mono ${riskyPorts.includes(p.port) ? 'text-cyber-red' : 'text-cyber-accent'}`}>
                  {p.port}
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyber-green animate-pulse"></span>
                  <span className="text-[10px] text-cyber-green font-bold uppercase">Open</span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-8 text-center text-cyber-muted italic">
              No open ports detected in the last scan.
            </div>
          )}
        </div>

        {foundRisky.length > 0 && (
          <div className="mt-4 p-3 bg-cyber-red/5 border border-cyber-red/20 rounded-lg">
            <p className="text-xs font-bold text-cyber-red uppercase mb-1">Security Warning</p>
            <p className="text-xs text-cyber-text">
              Potentially risky services ({foundRisky.map(p => p.port).join(', ')}) are exposed. 
              Ensure these are protected by a firewall or moved to a private network.
            </p>
          </div>
        )}
      </div>

      <div className="glass-card p-4">
        <h4 className="text-xs font-bold text-cyber-muted uppercase tracking-widest mb-3">Live Feed Status</h4>
        <div className="space-y-2">
          {history.map((h, i) => (
            <div key={i} className="flex justify-between items-center text-[10px] py-1 border-b border-cyber-border/20 last:border-0">
              <span className="text-cyber-muted">{new Date(h.timestamp).toLocaleTimeString()}</span>
              <span className="text-cyber-text font-mono">Scan complete: {h.count} ports found</span>
              <span className={`font-bold ${h.count > 0 ? 'text-cyber-yellow' : 'text-cyber-green'}`}>
                {h.count > 3 ? 'ALERT' : 'OK'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PortScanner;
