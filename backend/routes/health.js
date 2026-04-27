'use strict';
/**
 * /api/health — Health check routes
 * GET /api/health          — public liveness probe (no auth)
 * GET /api/health/detailed — full dependency status (any authenticated role)
 */
const express    = require('express');
const router     = express.Router();
const { protect }      = require('../middleware/auth');
const { requireAnyAuth } = require('../middleware/rbac');
const { getDetailedHealth } = require('../controllers/healthController');

// Public liveness probe — used by load balancers / Docker healthcheck
router.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'CipherNest API', timestamp: new Date() });
});

// Detailed health — requires any valid authenticated session
// Returns mongo_status, groq_status, external_intel_status
router.get('/detailed', protect, requireAnyAuth, getDetailedHealth);

module.exports = router;
