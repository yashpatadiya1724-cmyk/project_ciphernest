const si = require('systeminformation');
const { Alert, ActivityLog } = require('../models/index');
const User = require('../models/User');
const { emitEvent } = require('./socketService');

let isGuardRunning = false;
let checkInterval = null;
let statsInterval = null;
let cpuHistory = [];

/**
 * Monitor system resources and create alerts if thresholds are exceeded
 */
const startResourceGuard = async () => {
  if (isGuardRunning) return;
  isGuardRunning = true;
  cpuHistory = [];

  console.log('🛡️  Autonomous Resource Guard: Active');

  // Push live stats to frontend every 2 seconds
  statsInterval = setInterval(async () => {
    try {
      const [cpu, mem, disk, defaultIface] = await Promise.all([
        si.currentLoad(), si.mem(), si.fsSize(), si.networkInterfaceDefault()
      ]);
      const networkStats = await si.networkStats(defaultIface);
      const activeStats = networkStats.find(s => s.iface === defaultIface) || networkStats[0];

      const currentCpu = Math.round(cpu.currentLoad);
      cpuHistory.push(currentCpu);
      if (cpuHistory.length > 30) cpuHistory.shift(); // Keep last 60 seconds of polls

      const getStatus = (pct) => pct >= 80 ? 'High' : pct >= 50 ? 'Moderate' : 'Normal';

      const sysStats = {
        cpu: { usage: currentCpu, status: getStatus(currentCpu) },
        ram: { usage: Math.round((mem.used / mem.total) * 100), total: Math.round(mem.total / (1024 ** 3)), used: Math.round(mem.used / (1024 ** 3)), status: getStatus(Math.round((mem.used / mem.total) * 100)) },
        disk: { usage: disk.length > 0 ? Math.round((disk[0].used / disk[0].size) * 100) : 0, total: disk[0] ? Math.round(disk[0].size / (1024 ** 3)) : 0, status: getStatus(disk.length > 0 ? Math.round((disk[0].used / disk[0].size) * 100) : 0) },
        network: { rxKBs: activeStats ? Math.round(activeStats.rx_sec / 1024) : 0, txKBs: activeStats ? Math.round(activeStats.tx_sec / 1024) : 0 },
        timestamp: new Date()
      };
      
      emitEvent('system_stats', sysStats);
    } catch {}
  }, 2000);

  // Run check every 60 seconds
  checkInterval = setInterval(async () => {
    try {
      const mem = await si.mem();
      
      // Calculate sustained average CPU instead of instantaneous to prevent false spikes
      const avgCpu = cpuHistory.length > 0 
        ? Math.round(cpuHistory.reduce((a, b) => a + b, 0) / cpuHistory.length) 
        : 0;

      const ramUsage = Math.round((mem.used / mem.total) * 100);

      const thresholds = { cpu: 90, ram: 90, disk: 95 };
      const users = await User.find({});

      for (const user of users) {
        if (avgCpu > thresholds.cpu) {
          await createUniqueAlert(user._id, 'critical', 'High CPU Usage Detected', `System CPU usage has been sustained at ${avgCpu}% over the last minute. This may indicate a resource-intensive process or potential cryptojacking attempt.`);
        }
        if (ramUsage > thresholds.ram) {
          await createUniqueAlert(user._id, 'warning', 'Memory Exhaustion Warning', `System RAM usage is at ${ramUsage}%. System performance may be degraded.`);
        }
      }
    } catch (error) {
      console.error('Resource Guard Error:', error.message);
    }
  }, 60000);
};

/**
 * Prevent duplicate alerts for the same issue within a short time
 */
const createUniqueAlert = async (userId, type, title, message) => {
  const existingAlert = await Alert.findOne({
    userId,
    title,
    // Ignore dismissed status - always enforce a 1-hour cooldown
    timestamp: { $gt: new Date(Date.now() - 3600000) } 
  });

  if (!existingAlert) {
    const newAlert = await Alert.create({ userId, type, title, message, source: 'Resource Guard' });
    console.log(`📡 Resource Guard Alert created: ${title} for user ${userId}`);
    emitEvent('new_alert', newAlert);
  }
};

const stopResourceGuard = () => {
  if (checkInterval) clearInterval(checkInterval);
  if (statsInterval) clearInterval(statsInterval);
  isGuardRunning = false;
  cpuHistory = [];
  console.log('🛡️  Autonomous Resource Guard: Stopped');
};

module.exports = { startResourceGuard, stopResourceGuard };
