const { fetchGlobalThreats } = require('./globalThreatService');
const { correlateLocalWithGlobal } = require('./intelligenceEngine');
const { detectPatterns } = require('./patternEngine');
const { emitEvent } = require('./socketService');
const { Alert, ActivityLog } = require('../models/index');

let simulationActive = false;
let simulationInterval = null;


const startSimulation = (userId) => {
  if (simulationActive) return;
  simulationActive = true;

  console.log('☣️  Simulation Mode: ON');

  const scenarios = [
    async () => {
      await Alert.create({
        userId,
        type: 'critical',
        title: 'Unauthorized Login Attempt',
        message: 'Suspicious login attempt from known malicious IP: 45.122.3.44 (Russia)',
        source: 'Security Monitor'
      });
      emitEvent('alert-new', { title: 'Unauthorized Login' });
    },
    async () => {
      await ActivityLog.create({
        userId,
        action: 'Brute Force Detected',
        details: 'Multiple failed SSH login attempts on port 22',
        icon: '🛡️'
      });
      emitEvent('activity-new', { action: 'Brute Force Detected' });
    },
    async () => {
      const rogue = { ip: '192.168.1.109', mac: 'DE:AD:BE:EF:CA:FE', vendor: 'Unknown', type: 'Rogue Device', isNew: true };
      await Alert.create({
        userId,
        type: 'warning',
        title: 'Rogue Device Detected',
        message: `An unidentified device (${rogue.ip}) has joined your subnet.`,
        source: 'Network Scanner'
      });
      emitEvent('network-update', { devices: [rogue], timestamp: new Date() });
    },
    async () => {
      // Global Threat Spike Simulation
      console.log('📈 Simulating Global Threat Spike...');
      await fetchGlobalThreats();
      await correlateLocalWithGlobal(userId);
      await detectPatterns(userId);
      emitEvent('alert-new', { title: 'Global Threat Spike Correlation' });
    }
  ];

  simulationInterval = setInterval(() => {
    if (Math.random() < 0.4) {
      const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
      scenario(userId).catch(err => console.error('Simulation error:', err));
    }
  }, 10000); 
};

const stopSimulation = () => {
  simulationActive = false;
  if (simulationInterval) clearInterval(simulationInterval);
  console.log('🧬 Simulation Mode: OFF');
};

const isSimulationActive = () => simulationActive;

module.exports = { startSimulation, stopSimulation, isSimulationActive };
