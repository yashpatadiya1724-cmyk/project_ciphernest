const { generateAttackPath } = require('../services/attackPathEngine');
const mongoose = require('mongoose');

let AuditLog;
try { AuditLog = mongoose.model('AuditLog'); } catch (e) { AuditLog = mongoose.model('ActivityLog'); }

const getAttackPath = async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const graphData = await generateAttackPath(req.user._id, forceRefresh);

    // Audit integration (Task 3.2 Requirement)
    try {
      await AuditLog.create({
        userId: req.user._id,
        action: 'ATTACK_PATH_GENERATED',
        details: `Generated attack path with ${graphData.nodes.length} nodes and ${graphData.links.length} links`,
        type: 'info'
      });
    } catch (e) { console.error('AuditLog error:', e); }

    // Returning standard Recharts/Cytoscape.js compatible object
    res.json({ success: true, data: graphData });
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate attack path', error: error.message });
  }
};

module.exports = { getAttackPath };
