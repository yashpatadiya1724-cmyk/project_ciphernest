const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireRole, ROLES } = require('../middleware/rbac');
const { getAttackPath } = require('../controllers/attackPathController');

router.get('/', protect, requireRole([ROLES.SOC, ROLES.ADMIN]), getAttackPath);

module.exports = router;
