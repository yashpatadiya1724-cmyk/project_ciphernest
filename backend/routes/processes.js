const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { analyzeProcesses } = require('../controllers/processController');

router.get('/analyze', protect, analyzeProcesses);

module.exports = router;
