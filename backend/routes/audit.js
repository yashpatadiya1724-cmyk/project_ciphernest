'use strict';
/**
 * /api/audit — Immutable audit log query endpoint
 * PROJECT_CONSTITUTION.md §3 — RBAC: ROLE_ADMIN only
 * Read-only. No DELETE or PUT routes exist here by design.
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');
const { AuditLog } = require('../models/index');

// GET /api/audit — paginated audit log (admin only)
router.get('/', protect, requireAdmin, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip  = (page - 1) * limit;

    const [records, total] = await Promise.all([
      AuditLog.find().sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments()
    ]);

    res.json({ total, page, limit, records });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch audit log' });
  }
});

// GET /api/audit/:userId — audit log filtered by user (admin only)
router.get('/user/:userId', protect, requireAdmin, async (req, res) => {
  try {
    const records = await AuditLog.find({ userId: req.params.userId })
      .sort({ timestamp: -1 }).limit(100).lean();
    res.json({ records });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch user audit log' });
  }
});

module.exports = router;
