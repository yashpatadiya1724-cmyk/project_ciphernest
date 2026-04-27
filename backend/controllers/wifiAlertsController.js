const { Alert, ActivityLog } = require('../models/index');

// WiFi controller (simulated - node-wifi requires OS permissions)
const getWifiNetworks = async (req, res) => {
  try {
    // Simulated WiFi data (real implementation needs system-level access)
    const mockNetworks = [
      { ssid: 'HomeNetwork_5G', security: 'WPA3', signal: -45, channel: 36, frequency: 5, riskLevel: 'low' },
      { ssid: 'OpenWifi_Cafe', security: 'Open', signal: -70, channel: 6, frequency: 2.4, riskLevel: 'high' },
      { ssid: 'OfficeNet', security: 'WPA2', signal: -60, channel: 11, frequency: 2.4, riskLevel: 'low' },
      { ssid: 'NETGEAR_2.4G', security: 'WEP', signal: -75, channel: 1, frequency: 2.4, riskLevel: 'high' },
      { ssid: 'Unknown_5432', security: 'WPA2', signal: -85, channel: 36, frequency: 5, riskLevel: 'medium' }
    ];

    const assessRisk = (network) => {
      if (network.security === 'Open') return 'high';
      if (network.security === 'WEP') return 'high';
      if (network.security === 'WPA') return 'medium';
      if (network.signal < -80) return 'medium';
      return 'low';
    };

    const networks = mockNetworks.map(n => ({ ...n, riskLevel: assessRisk(n) }));
    const highRisk = networks.filter(n => n.riskLevel === 'high');

    // Create alerts for high-risk networks
    if (highRisk.length > 0) {
      for (const net of highRisk) {
        await Alert.findOneAndUpdate(
          { userId: req.user._id, source: 'wifi', title: `Unsafe Network: ${net.ssid}` },
          {
            userId: req.user._id, type: 'critical', title: `Unsafe Network: ${net.ssid}`,
            message: `Network "${net.ssid}" uses ${net.security} security or is open — avoid connecting!`,
            source: 'wifi'
          },
          { upsert: true, new: true }
        );
      }
    }

    await ActivityLog.create({ userId: req.user._id, action: 'WiFi scan', details: `Found ${networks.length} networks, ${highRisk.length} unsafe`, icon: '📡' });

    res.json({ networks, summary: { total: networks.length, safe: networks.filter(n => n.riskLevel === 'low').length, warning: networks.filter(n => n.riskLevel === 'medium').length, danger: highRisk.length } });
  } catch (error) {
    res.status(500).json({ message: 'WiFi scan failed', error: error.message });
  }
};

// Alerts controller
const getAlerts = async (req, res) => {
  try {
    const alerts = await Alert.find({ userId: req.user._id }).sort({ timestamp: -1 }).limit(50);
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch alerts' });
  }
};

const dismissAlert = async (req, res) => {
  try {
    const alert = await Alert.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { dismissed: true },
      { new: true }
    );
    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    res.json({ message: 'Alert dismissed', alert });
  } catch (error) {
    res.status(500).json({ message: 'Failed to dismiss alert' });
  }
};

const dismissAllAlerts = async (req, res) => {
  try {
    await Alert.updateMany({ userId: req.user._id, dismissed: false }, { dismissed: true });
    res.json({ message: 'All alerts dismissed' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to dismiss alerts' });
  }
};

module.exports = { getWifiNetworks, getAlerts, dismissAlert, dismissAllAlerts };
