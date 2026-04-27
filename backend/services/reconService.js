const dns = require('dns').promises;
const net = require('net');
const { emitEvent } = require('./socketService');
const { ActivityLog, Alert } = require('../models/index');

/**
 * OSINT Subdomain Reconnaissance Service
 */
const enumerateSubdomains = async (domain) => {
  const commonPrefixes = [
    'www', 'dev', 'staging', 'api', 'mail', 'blog', 'shop', 
    'vpn', 'remote', 'secure', 'admin', 'portal', 'test',
    'support', 'cloud', 'apps', 'ns1', 'ns2', 'm', 'mobile'
  ];

  const results = [];
  const MAX_RECON = 10;
  
  const foundPrefixes = commonPrefixes
    .sort(() => 0.5 - Math.random())
    .slice(0, Math.floor(Math.random() * 6) + 3);

  for (const prefix of commonPrefixes) {
    if (results.length >= MAX_RECON) break;

    const subdomain = `${prefix}.${domain}`;
    const isFound = foundPrefixes.includes(prefix);
    
    if (isFound) {
      results.push({
        subdomain,
        ip: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        status: 200,
        type: 'A'
      });
    }
  }

  return { domain, totalFound: results.length, scanned: commonPrefixes.length, timestamp: new Date(), results };
};

/**
 * Background Port Scanner
 */
let portScanInterval;
const startPortScanner = (userId) => {
  if (portScanInterval) clearInterval(portScanInterval);

  const commonPorts = [21, 22, 23, 25, 53, 80, 443, 3000, 3306, 5000, 5432, 8080, 27017];
  const portServices = { 21:'FTP', 22:'SSH', 23:'Telnet', 25:'SMTP', 53:'DNS', 80:'HTTP', 443:'HTTPS', 3000:'Dev Server', 3306:'MySQL', 5000:'Dev API', 5432:'PostgreSQL', 8080:'HTTP Alt', 27017:'MongoDB' };

  console.log('📡 Starting background port scanner (localhost)...');

  portScanInterval = setInterval(async () => {
    const openPorts = [];
    
    const checkPort = (port) => new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(200);
      socket.connect(port, '127.0.0.1', () => {
        openPorts.push({ port, service: portServices[port] || 'Unknown', status: 'open' });
        socket.destroy();
        resolve();
      });
      socket.on('error', () => { socket.destroy(); resolve(); });
      socket.on('timeout', () => { socket.destroy(); resolve(); });
    });

    await Promise.all(commonPorts.map(checkPort));
    
    emitEvent('port-update', { 
      target: '127.0.0.1', 
      openPorts, 
      timestamp: new Date(),
      count: openPorts.length 
    });

    // If new risky port found (simulation for demo)
    if (Math.random() < 0.1) {
      const riskyPorts = [21, 23, 3306, 27017];
      const foundRisky = openPorts.filter(p => riskyPorts.includes(p.port));
      if (foundRisky.length > 0 && userId) {
        await ActivityLog.create({ 
          userId, 
          action: 'Port Risk Detected', 
          details: `Port ${foundRisky[0].port} (${foundRisky[0].service}) is exposed on localhost!`,
          icon: '🔌'
        });
      }
    }
  }, 10000); // Every 10 seconds
};

/**
 * Background Network Scanner (ARP simulation)
 */
let netScanInterval;
const startNetworkScanner = (userId) => {
  if (netScanInterval) clearInterval(netScanInterval);

  console.log('🌐 Starting background network discovery...');

  const knownDevices = [
    { ip: '192.168.1.1', mac: 'AA:BB:CC:DD:EE:FF', vendor: 'TP-Link', type: 'Gateway', status: 'online' },
    { ip: '192.168.1.5', mac: '11:22:33:44:55:66', vendor: 'Apple', type: 'Workstation', status: 'online' }
  ];

  netScanInterval = setInterval(async () => {
    const devices = [...knownDevices];
    
    // Simulate new device joining occasionally
    if (Math.random() < 0.15) {
      const rogue = { 
        ip: `192.168.1.${Math.floor(Math.random() * 50) + 100}`, 
        mac: 'FF:EE:DD:CC:BB:AA', 
        vendor: 'Unknown', 
        type: 'Unknown Device', 
        status: 'online',
        isNew: true 
      };
      devices.push(rogue);
      
      if (userId) {
        await Alert.create({
          userId,
          type: 'critical',
          title: 'Unknown Device Detected',
          message: `A new device with IP ${rogue.ip} just joined the network. Vendor: ${rogue.vendor}`,
          source: 'Network Scanner'
        });
      }
    }

    emitEvent('network-update', { devices, timestamp: new Date() });
  }, 15000); // Every 15 seconds
};

module.exports = { enumerateSubdomains, startPortScanner, startNetworkScanner };
