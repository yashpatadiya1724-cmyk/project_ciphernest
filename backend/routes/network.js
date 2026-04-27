const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { scanNetwork, getNetworkStats } = require('../controllers/networkController');

router.get('/scan', protect, scanNetwork);
router.get('/stats', protect, getNetworkStats);


module.exports = router;
