const express = require('express')
const router = express.Router()
const { getWifiNetworks, analyzeNetworkEndpoint } = require('../controllers/wifiController')
const { protect } = require('../middleware/auth')

router.get('/scan', protect, getWifiNetworks)
router.post('/analyze', protect, analyzeNetworkEndpoint)

module.exports = router
