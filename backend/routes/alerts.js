// routes/alerts.js
const express = require('express');
const router = express.Router();
const { getAlerts, dismissAlert, dismissAllAlerts } = require('../controllers/wifiAlertsController');
const { protect } = require('../middleware/auth');

router.get('/', protect, getAlerts);
router.patch('/:id/dismiss', protect, dismissAlert);
router.patch('/dismiss-all', protect, dismissAllAlerts);

module.exports = router;
