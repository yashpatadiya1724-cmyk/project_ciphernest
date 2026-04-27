const { getDeepHealth } = require('../services/heartbeatService');
const { shipError } = require('../services/logExporter');

const getDetailedHealth = async (req, res) => {
  try {
    const healthData = await getDeepHealth();
    res.json(healthData);
  } catch (error) {
    shipError({ context: 'getDetailedHealth', error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Health check failed', error: error.message });
  }
};

module.exports = { getDetailedHealth };
