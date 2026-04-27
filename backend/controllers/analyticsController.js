const { getThreatHeatmap } = require('../services/analyticsEngine');
const mongoose = require('mongoose');

let AuditLog;
try { AuditLog = mongoose.model('AuditLog'); } catch(e) { AuditLog = mongoose.model('ActivityLog'); }

const getTrends = async (req, res) => {
  try {
    const analytics = await getThreatHeatmap();

    // Required CISO_TRENDS_ACCESSED audit
    try {
      await AuditLog.create({
        userId: req.user._id,
        action: 'CISO_TRENDS_ACCESSED',
        details: 'Accessed 30-day threat heatmap and analytics',
        type: 'info'
      });
    } catch (e) {}

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve analytics', error: error.message });
  }
};

module.exports = { getTrends };
