// routes/chat.js
const express = require('express');
const router = express.Router();
const { sendMessage, getChatHistory, clearChatHistory, checkAIStatus } = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

router.post('/message', protect, sendMessage);
router.get('/history', protect, getChatHistory);
router.delete('/history', protect, clearChatHistory);
router.get('/status', protect, checkAIStatus);

module.exports = router;
