const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireRole, ROLES } = require('../middleware/rbac');
const { getTrends } = require('../controllers/analyticsController');

router.get('/trends', protect, requireRole([ROLES.CISO, ROLES.ADMIN]), getTrends);

module.exports = router;
