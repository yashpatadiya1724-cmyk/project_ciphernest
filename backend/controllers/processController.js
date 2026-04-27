const si = require('systeminformation');
const { ActivityLog } = require('../models/index');

/**
 * @desc Get and analyze running processes
 */
const analyzeProcesses = async (req, res) => {
  try {
    const userId = req.user._id;
    const processData = await si.processes();
    
    // Process analysis logic
    const analyzed = processData.list
      .map(p => {
        let score = 10;
        let flags = [];
        
        const name = p.name.toLowerCase();
        
        // High resource usage
        if (p.cpu > 10) { score += 30; flags.push('High CPU Usage'); }
        if (p.mem > 10) { score += 20; flags.push('High Memory Usage'); }
        
        // Suspicious keywords
        const suspicious = ['miner', 'crack', 'bypass', 'hack', 'spoof', 'vnc', 'remote', 'script', 'powershell', 'cmd', 'keygen'];
        if (suspicious.some(s => name.includes(s))) {
          score += 50;
          flags.push('Suspicious Process Name');
        }
        
        // Known system/safe processes (simplified)
        const safe = ['system', 'svchost', 'chrome', 'node', 'explorer', 'taskmgr', 'window', 'microsoft', 'google'];
        if (safe.some(s => name.includes(s))) {
          score = Math.max(0, score - 20);
        }

        const risk = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';

        return {
          pid: p.pid,
          name: p.name,
          cpu: p.cpu.toFixed(1),
          mem: p.mem.toFixed(1),
          user: p.user,
          state: p.state,
          score,
          risk,
          flags
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);

    res.json({
      total: processData.all,
      running: processData.running,
      analyzed
    });
  } catch (error) {
    res.status(500).json({ message: 'Process analysis failed', error: error.message });
  }
};

module.exports = { analyzeProcesses };
