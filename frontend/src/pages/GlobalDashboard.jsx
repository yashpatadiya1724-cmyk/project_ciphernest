import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { simulationAPI } from '../services/api';

const COLORS = ['#0ea5e9', '#6366f1', '#a855f7', '#ec4899', '#f43f5e'];

const GlobalDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await simulationAPI.threats.getGlobal();
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch global threat data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-slate-700 border-t-sky-500 rounded-full animate-spin mb-4"></div>
          Scanning global intelligence networks...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase">Global Threat Intelligence</h1>
          <p className="text-slate-400 mt-1">Real-time worldwide security observations and malicious activity trends.</p>
        </div>
        <button 
          onClick={fetchData}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold transition-all"
        >
          REFRESH FEED
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Countries Bar Chart */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-2xl">
          <h2 className="text-lg font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-6 bg-sky-500 rounded-full"></span>
            Top Threat Origins (by Volume)
          </h2>
          <div className="h-64 mt-4 text-xs font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.topCountries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                />
                <Bar dataKey="count" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Threat Types Pie Chart */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-2xl">
          <h2 className="text-lg font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-6 bg-purple-500 rounded-full"></span>
            Global Threat Distribution
          </h2>
          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.threatTypes}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data?.threatTypes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-6 bg-rose-500 rounded-full"></span>
            Recent High-Severity Indicators
          </h2>
        </div>
        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left">
            <thead className="bg-slate-950/50 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-tighter">
              <tr>
                <th className="px-6 py-4">Indicator</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Severity</th>
                <th className="px-6 py-4">Country</th>
                <th className="px-6 py-4">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {data?.recentThreats.map((threat, idx) => (
                <tr key={idx} className="hover:bg-slate-800/20 transition-colors group">
                  <td className="px-6 py-4 font-mono text-slate-300 group-hover:text-white transition-colors">{threat.value}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded bg-slate-800 text-[10px] font-bold uppercase border border-slate-700">
                      {threat.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400">{threat.category}</td>
                  <td className="px-6 py-4">
                    <span className={`font-black uppercase tracking-tighter ${
                      threat.severity === 'critical' ? 'text-rose-500' : 
                      threat.severity === 'high' ? 'text-orange-500' : 'text-amber-500'
                    }`}>
                      {threat.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400">{threat.country}</td>
                  <td className="px-6 py-4 text-slate-500">{new Date(threat.lastSeen).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default GlobalDashboard;
