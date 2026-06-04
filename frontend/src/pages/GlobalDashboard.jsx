import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { motion } from 'framer-motion';
import { Globe, RefreshCw, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import BentoCard from '../components/dashboard/BentoCard';

const COLORS = ['#6366F1', '#f43f5e', '#fbbf24', '#10b981', '#fb923c'];

const SEV_COLOR = {
  critical: '#f43f5e',
  high:     '#fb923c',
  medium:   '#fbbf24',
  low:      '#10b981',
};

const GlobalDashboard = () => {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      // Use /api/threats/dashboard which returns the structured object
      // { totalThreats, topCountries, threatTypes, recentThreats }
      const res = await api.get('/threats/dashboard');
      setData(res.data);
    } catch (err) {
      console.error('GlobalDashboard fetch error:', err);
      setError('Failed to load global threat intelligence. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2"
            style={{ borderColor: 'var(--accent)' }} />
          <p className="text-sm animate-pulse" style={{ color: 'var(--text-muted)' }}>
            Scanning global intelligence networks…
          </p>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <AlertTriangle size={40} style={{ color: '#f43f5e' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{error}</p>
          <button onClick={fetchData}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Safe defaults — prevent crashes if any field is missing
  const topCountries  = Array.isArray(data?.topCountries)  ? data.topCountries  : [];
  const threatTypes   = Array.isArray(data?.threatTypes)   ? data.threatTypes   : [];
  const recentThreats = Array.isArray(data?.recentThreats) ? data.recentThreats : [];
  const totalThreats  = data?.totalThreats ?? 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Globe size={24} style={{ color: 'var(--accent)' }} />
          <div>
            <h1 className="text-2xl font-black tracking-tight"
              style={{ color: 'var(--text-primary)' }}>
              Global Threat Intelligence
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Worldwide security observations and malicious activity trends
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs px-3 py-1.5 rounded-full font-semibold"
            style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.25)' }}>
            {totalThreats} indicators
          </span>
          <button onClick={fetchData} aria-label="Refresh feed"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-ui)', color: 'var(--text-muted)' }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </header>

      {/* Charts row */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-5"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Top Countries Bar Chart */}
        <BentoCard>
          <h2 className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2"
            style={{ color: 'var(--text-muted)' }}>
            <span className="w-2 h-4 rounded-full" style={{ background: 'var(--accent)' }} />
            Top Threat Origins
          </h2>
          {topCountries.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs"
              style={{ color: 'var(--text-muted)' }}>No data available</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCountries} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-ui)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border-ui)', borderRadius: '8px', fontSize: '12px' }}
                    labelStyle={{ color: 'var(--text-muted)' }}
                  />
                  <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </BentoCard>

        {/* Threat Types Pie Chart */}
        <BentoCard>
          <h2 className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2"
            style={{ color: 'var(--text-muted)' }}>
            <span className="w-2 h-4 rounded-full" style={{ background: '#8B5CF6' }} />
            Threat Distribution
          </h2>
          {threatTypes.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs"
              style={{ color: 'var(--text-muted)' }}>No data available</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={threatTypes} cx="50%" cy="50%"
                    innerRadius={55} outerRadius={80}
                    paddingAngle={4} dataKey="value">
                    {threatTypes.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border-ui)', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', color: 'var(--text-muted)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </BentoCard>
      </motion.div>

      {/* Recent Threats Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <BentoCard noPadding>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-ui)' }}>
            <h2 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2"
              style={{ color: 'var(--text-muted)' }}>
              <span className="w-2 h-4 rounded-full" style={{ background: '#f43f5e' }} />
              Recent High-Severity Indicators
            </h2>
          </div>

          {recentThreats.length === 0 ? (
            <div className="py-12 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
              No recent threats found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border-ui)' }}>
                  <tr>
                    {['Indicator','Type','Category','Severity','Country','Last Seen'].map(h => (
                      <th key={h} className="px-5 py-3 font-bold uppercase tracking-wider"
                        style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentThreats.map((threat, idx) => (
                    <tr key={threat._id || idx}
                      className="transition-colors"
                      style={{ borderBottom: '1px solid var(--border-ui)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-page)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td className="px-5 py-3 font-mono" style={{ color: 'var(--text-primary)' }}>
                        {threat.value}
                      </td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded text-xs font-bold uppercase"
                          style={{ background: 'var(--bg-page)', border: '1px solid var(--border-ui)', color: 'var(--text-muted)' }}>
                          {threat.type}
                        </span>
                      </td>
                      <td className="px-5 py-3" style={{ color: 'var(--text-muted)' }}>
                        {threat.category}
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-black uppercase text-xs"
                          style={{ color: SEV_COLOR[threat.severity] || 'var(--text-muted)' }}>
                          {threat.severity}
                        </span>
                      </td>
                      <td className="px-5 py-3" style={{ color: 'var(--text-muted)' }}>
                        {threat.country || '—'}
                      </td>
                      <td className="px-5 py-3" style={{ color: 'var(--text-muted)' }}>
                        {threat.lastSeen ? new Date(threat.lastSeen).toLocaleTimeString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </BentoCard>
      </motion.div>
    </div>
  );
};

export default GlobalDashboard;
