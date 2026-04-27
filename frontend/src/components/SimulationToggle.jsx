import React, { useState, useEffect } from 'react';
import { simulationAPI } from '../services/api';

const SimulationToggle = () => {
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    simulationAPI.status().then(res => {
      setActive(res.data.active);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const toggle = async () => {
    setLoading(true);
    try {
      const res = await simulationAPI.toggle(!active);
      setActive(res.data.active);
    } catch (err) {
      console.error('Failed to toggle simulation:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="h-4 w-12 bg-cyber-border/20 rounded animate-pulse"></div>;

  return (
    <div className="flex items-center gap-3">
      <span className={`text-[10px] font-bold font-mono tracking-widest ${active ? 'text-cyber-red animate-pulse' : 'text-cyber-muted'}`}>
        {active ? '☢️ SIMULATION ACTIVE' : '🧬 SIMULATION MODE'}
      </span>
      <button 
        onClick={toggle}
        className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${active ? 'bg-cyber-red' : 'bg-cyber-border'}`}
      >
        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${active ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
};

export default SimulationToggle;
