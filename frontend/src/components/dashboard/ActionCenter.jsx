import React from 'react';

const ActionCenter = ({ actions, onResolve, onIgnore }) => {
  if (!actions || actions.length === 0) {
    return (
      <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-xl p-6 text-center">
        <p className="text-slate-400">No pending actions. Your system is looking good!</p>
      </div>
    );
  }

  const getSeverityColor = (sev) => {
    switch (sev) {
      case 'critical': return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
      case 'high': return 'text-orange-400 border-orange-500/30 bg-orange-500/10';
      case 'medium': return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
      default: return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
    }
  };

  return (
    <div className="space-y-4">
      {actions.map((action) => (
        <div 
          key={action._id} 
          className={`flex items-start justify-between p-4 rounded-lg border backdrop-blur-sm transition-all hover:shadow-lg ${getSeverityColor(action.severity)}`}
        >
          <div className="flex-1 mr-4">
            <h4 className="font-bold text-sm uppercase tracking-wider mb-1">{action.title}</h4>
            <p className="text-sm opacity-90">{action.description}</p>
            {action.affectedResource && (
              <span className="inline-block mt-2 px-2 py-0.5 text-xs font-mono bg-black/20 rounded border border-white/10">
                Resource: {action.affectedResource}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2 mt-1">
            <button 
              onClick={() => onResolve(action._id)}
              className="px-3 py-1 text-xs font-bold bg-white/20 hover:bg-white/30 border border-white/20 rounded-md transition-colors"
            >
              RESOLVE
            </button>
            <button 
              onClick={() => onIgnore(action._id)}
              className="px-3 py-1 text-xs font-bold bg-black/20 hover:bg-black/30 border border-white/10 rounded-md transition-colors opacity-60 hover:opacity-100"
            >
              IGNORE
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ActionCenter;
