'use strict';
/**
 * /api/config — Platform configuration endpoint
 * PROJECT_CONSTITUTION.md §3 — RBAC: ROLE_ADMIN only
 * Exposes non-secret runtime config. Never exposes API keys or secrets.
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');

// GET /api/config — return safe runtime configuration (admin only)
router.get('/', protect, requireAdmin, (req, res) => {
  res.json({
    node_env:    process.env.NODE_ENV || 'development',
    port:        process.env.PORT || 5000,
    groq_model:  process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    jwt_expire:  process.env.JWT_EXPIRE || '7d',
    // Keys are intentionally never exposed — only presence is confirmed
    groq_key_set:         !!(process.env.GROQ_API_KEY),
    virustotal_key_set:   !!(process.env.VIRUSTOTAL_API_KEY),
    abuseipdb_key_set:    !!(process.env.ABUSEIPDB_API_KEY),
  });
});

module.exports = router;
