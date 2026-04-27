const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { Recommendation } = require('../models/index');
const { getScoreBreakdown } = require('../services/riskEngine');

// Get all recommendations
router.get('/', protect, async (req, res) => {
  try {
    const actions = await Recommendation.find({ userId: req.user._id, status: 'pending' })
      .sort({ severity: -1, timestamp: -1 });
    
    const breakdown = await getScoreBreakdown(req.user._id);
    res.json({ actions, breakdown });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch action center data' });
  }
});

// Update recommendation status (Resolve/Ignore)
router.patch('/:id', protect, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['resolved', 'ignored', 'pending'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const action = await Recommendation.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { status, timestamp: new Date() },
      { new: true }
    );

    if (!action) return res.status(404).json({ message: 'Action not found' });

    res.json(action);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update action' });
  }
});

module.exports = router;
