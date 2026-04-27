const net = require('net');
const { Alert, ActivityLog } = require('../models/index');
const { emitEvent } = require('./socketService');

/**
 * Local Honeypot Service
 * Listens on sensitive ports and alerts the user if anyone on the network 
 * tries to connect/scan.
 */
const startHoneypot = (userId) => {
  // Common decoy ports
  const DECOY_PORT = 1024; // A port often scanned by bots or network probes

  const server = net.createServer((socket) => {
    const remoteAddress = socket.remoteAddress;
    console.log(`🚨 HONEYPOT TRIGGERED! Connection attempt from: ${remoteAddress}`);

    // Create a Critical Alert if linked to a user
    if (userId) {
      Alert.create({
        userId,
        type: 'critical',
        title: 'Honeypot Triggered!',
        message: `Unauthorized network probe detected from IP: ${remoteAddress}. Someone may be scanning your machine.`,
        source: 'Internal Monitor'
      }).then(newAlert => emitEvent('new_alert', newAlert)).catch(err => console.error('Failed to create honeypot alert:', err));
    }

    // Log Activity if linked to a user
    if (userId) {
      ActivityLog.create({
        userId,
        action: 'Intrusion Attempt Blocked',
        details: `Honeypot on port ${DECOY_PORT} triggered by ${remoteAddress}`,
        icon: '🪤'
      }).catch(err => console.error('Failed to log honeypot activity:', err));
    }

    socket.end('Unauthorized Access. This attempt has been logged.\n');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`🪤 Honeypot: Port ${DECOY_PORT} already in use. Skipping honeypot.`);
    } else {
      console.error('Honeypot error:', err);
    }
  });

  server.listen(DECOY_PORT, '0.0.0.0', () => {
    console.log(`🪤  Local Honeypot: Listening on port ${DECOY_PORT}`);
  });

  return server;
};

module.exports = { startHoneypot };
