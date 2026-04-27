'use strict';
/**
 * /api/feedback — Analyst feedback routes
 * Phase 4.6: POST /api/feedback/report accepts threatId, toolType, decision.
 * Phase 4.3: also accepts ai_response feedback from AskCipher thumbs.
 */
const express = require('express');
const router  = express.Router();
const { protect }                    = require('../middleware/auth');
const { requireRole, ROLES }         = require('../middleware/rbac');
const { reportInaccuracy }           = require('../controllers/feedbackController');
const AnalystFeedback                = require('../models/AnalystFeedback');
const { runHeuristicTuning }         = require('../services/riskEngine');

// POST /api/feedback/report — existing inaccuracy report (SOC/ADMIN)
router.post('/report', protect, requireRole([ROLES.SOC, ROLES.ADMIN]), reportInaccuracy);

// POST /api/feedback/analyst — 4.6: structured analyst decision per threat card
// Accepts: { threatId, toolType, decision: 'false_positive'|'true_positive'|'unclear' }
router.post('/analyst', protect, requireRole([ROLES.SOC, ROLES.ADMIN]), async (req, res) => {
  try {
    const { threatId, toolType, decision, notes } = req.body;
    if (!threatId || !decision) {
      return res.status(400).json({ message: 'threatId and decision are required' });
    }

    const VALID_DECISIONS = ['false_positive', 'true_positive', 'unclear'];
    if (!VALID_DECISIONS.includes(decision)) {
      return res.status(400).json({ message: `decision must be one of: ${VALID_DECISIONS.join(', ')}` });
    }

    // Map decision to AnalystFeedback.reportedStatus schema
    const reportedStatus = decision === 'false_positive' ? 'Safe' : 'Dangerous';

    const feedback = await AnalystFeedback.create({
      userId:          req.user._id,
      toolResultId:    threatId,
      toolType:        toolType || 'threat_card',
      reportedStatus,
      analystReasoning: notes || decision,
    });

    // Trigger heuristic re-tuning immediately after new feedback
    await runHeuristicTuning();

    res.status(201).json({ message: 'Analyst feedback recorded', feedback });
  } catch (err) {
    res.status(500).json({ message: 'Failed to record feedback', error: err.message });
  }
});

// GET /api/feedback/summary — returns feedback counts per toolType (ADMIN only)
router.get('/summary', protect, requireRole([ROLES.ADMIN]), async (req, res) => {
  try {
    const summary = await AnalystFeedback.aggregate([
      { $group: { _id: { toolType: '$toolType', status: '$reportedStatus' }, count: { $sum: 1 } } },
      { $sort: { '_id.toolType': 1 } }
    ]);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch feedback summary' });
  }
});

module.exports = router;
