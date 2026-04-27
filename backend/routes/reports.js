const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
// PROJECT_CONSTITUTION.md §3: Reports are ROLE_CISO + ROLE_ADMIN
const { requireRole, ROLES } = require('../middleware/rbac');
const { generateReport, generateIncidentReportHandler, generateComplianceAudit } = require('../controllers/reportController');

// GET /api/reports/generate — Generate PDF/JSON compliance report
// Restricted: ROLE_CISO (executive reporting) and ROLE_ADMIN
router.get('/generate', protect, requireRole([ROLES.CISO, ROLES.ADMIN]), generateReport);

// POST /api/reports/generate — Generate specific Incident Report
router.post('/generate', protect, requireRole([ROLES.CISO, ROLES.ADMIN]), generateIncidentReportHandler);

// GET /api/reports/compliance-audit — Generate 90-day compliance export
router.get('/compliance-audit', protect, requireRole([ROLES.CISO, ROLES.ADMIN]), generateComplianceAudit);

module.exports = router;

