const si = require('systeminformation');
const { Alert, ActivityLog, ToolResult } = require('../models/index');
const User = require('../models/User');

// Get system stats
const getSystemStats = async (req, res) => {
  try {
    const [cpu, mem, disk, defaultIface] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.networkInterfaceDefault()
    ]);

    const networkStats = await si.networkStats(defaultIface);
    const activeStats = networkStats.find(s => s.iface === defaultIface) || networkStats[0];

    const cpuUsage = Math.round(cpu.currentLoad);
    const ramUsage = Math.round((mem.used / mem.total) * 100);
    const diskUsage = disk.length > 0 ? Math.round((disk[0].used / disk[0].size) * 100) : 0;
    const netRx = activeStats ? Math.round(activeStats.rx_sec / 1024) : 0; // KB/s
    const netTx = activeStats ? Math.round(activeStats.tx_sec / 1024) : 0; // KB/s

    const getStatus = (pct) => pct >= 80 ? 'High' : pct >= 50 ? 'Moderate' : 'Normal';

    res.json({
      cpu: { usage: cpuUsage, status: getStatus(cpuUsage) },
      ram: { usage: ramUsage, total: Math.round(mem.total / (1024 ** 3)), used: Math.round(mem.used / (1024 ** 3)), status: getStatus(ramUsage) },
      disk: { usage: diskUsage, total: disk[0] ? Math.round(disk[0].size / (1024 ** 3)) : 0, status: getStatus(diskUsage) },
      network: { rxKBs: netRx, txKBs: netTx },
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch system stats', error: error.message });
  }
};

// Get dashboard overview
const getDashboardOverview = async (req, res) => {
  try {
    const userId = req.user._id;

    const [user, alerts, recentTools, recentActivity] = await Promise.all([
      User.findById(userId),
      Alert.find({ userId, dismissed: false }).sort({ timestamp: -1 }).limit(5),
      ToolResult.find({ userId }).sort({ timestamp: -1 }).limit(5),
      ActivityLog.find({ userId }).sort({ timestamp: -1 }).limit(10)
    ]);

    const criticalCount = alerts.filter(a => a.type === 'critical').length;
    const warningCount = alerts.filter(a => a.type === 'warning').length;

    let statusMessage = 'You are secure';
    if (criticalCount > 0) statusMessage = `${criticalCount} critical issue(s) need attention!`;
    else if (warningCount > 0) statusMessage = `${warningCount} warning(s) to review`;
    else if (user.securityScore < 50) statusMessage = 'Your security could be improved';
    else if (user.securityScore >= 80) statusMessage = 'Great job — you are well protected!';
    else statusMessage = 'You are mostly safe';

    res.json({
      securityScore: user.securityScore,
      statusMessage,
      alertSummary: { critical: criticalCount, warning: warningCount, total: alerts.length },
      recentAlerts: alerts,
      recentTools,
      activityTimeline: recentActivity
    });
  } catch (error) {
    res.status(500).json({ message: 'Dashboard data fetch failed', error: error.message });
  }
};

// Get unified timeline
const getTimeline = async (req, res) => {
  try {
    const userId = req.user._id;
    const { limit = 30 } = req.query;

    const [activity, alerts, tools] = await Promise.all([
      ActivityLog.find({ userId }).sort({ timestamp: -1 }).limit(limit),
      Alert.find({ userId }).sort({ timestamp: -1 }).limit(limit),
      ToolResult.find({ userId }).sort({ timestamp: -1 }).limit(limit)
    ]);

    // Format and merge
    const merged = [
      ...activity.map(a => ({ type: 'activity', id: a._id, title: a.action, desc: a.details, icon: a.icon || '📝', time: a.timestamp, severity: 'info' })),
      ...alerts.map(a => ({ type: 'alert', id: a._id, title: a.title, desc: a.message, icon: a.type === 'critical' ? '🚫' : '⚠️', time: a.timestamp, severity: a.type })),
      ...tools.map(t => ({ type: 'tool', id: t._id, title: `Tool: ${t.toolType}`, desc: t.summary, icon: '🔍', time: t.timestamp, severity: t.riskLevel }))
    ];

    merged.sort((a, b) => new Date(b.time) - new Date(a.time));

    res.json(merged.slice(0, limit));
  } catch (error) {
    res.status(500).json({ message: 'Timeline fetch failed', error: error.message });
  }
};

module.exports = { getSystemStats, getDashboardOverview, getTimeline };
