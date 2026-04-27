const AnalystFeedback = require('../models/AnalystFeedback');
const mongoose = require('mongoose');
const { preprocess } = require('../utils/canonicalize');
const { logFeedback } = require('../services/riskEngine');

let AuditLog;
try { AuditLog = mongoose.model('AuditLog'); } catch (e) { AuditLog = mongoose.model('ActivityLog'); }

const reportInaccuracy = async (req, res) => {
  try {
    const { toolResultId, toolType, input, reportedStatus, analystReasoning } = req.body;
    
    if (!toolResultId || !reportedStatus) {
      return res.status(400).json({ message: 'toolResultId and reportedStatus are required' });
    }

    // Canonicalization enforcement
    let normalized_input = input;
    let scan_hash = null;
    if (input) {
      const prep = await preprocess(toolType, input, 'generic');
      normalized_input = prep.normalized;
      scan_hash = prep.scan_hash;
    }

    const feedback = await AnalystFeedback.create({
      userId: req.user._id,
      toolResultId,
      toolType,
      input,
      normalized_input,
      scan_hash,
      reportedStatus,
      analystReasoning
    });

    // Immutable Audit Trail
    try {
      await AuditLog.create({
        userId: req.user._id,
        action: 'ANALYST_CORRECTION',
        details: `Reported ${reportedStatus} for ${toolType} scan ${toolResultId}`,
        type: 'warning'
      });
    } catch (e) { console.error('Audit log failed', e); }

    // Trigger Heuristic Tuning Hook
    await logFeedback(feedback._id);

    res.status(201).json({ message: 'Feedback logged successfully', feedback });
  } catch (error) {
    res.status(500).json({ message: 'Failed to submit feedback', error: error.message });
  }
};

module.exports = { reportInaccuracy };
