'use strict';
const express = require('express');
const router  = express.Router();
const { protect }                          = require('../middleware/auth');
const { fetchGlobalThreats, getGlobalDashboardData } = require('../services/globalThreatService');
const { correlateLocalWithGlobal, deduplicateThreats } = require('../services/intelligenceEngine');
const { getLatestFeed }                    = require('../services/intelFeed');
const { GlobalThreat }                     = require('../models/index');

// POST /api/threats/fetch — force-refresh from external feeds (admin utility)
router.post('/fetch', protect, async (req, res) => {
  try {
    const threats = await fetchGlobalThreats();
    res.json({ message: 'Global threats updated', count: threats.length });
  } catch (err) {
    res.status(500).json({ message: 'Fetch failed', error: err.message });
  }
});

// GET /api/threats/global — 4.1: deduplicated threat list for ThreatMap
router.get('/global', protect, async (req, res) => {
  try {
    const raw  = await GlobalThreat.find().sort({ lastSeen: -1 }).limit(200).lean();
    const deduped = deduplicateThreats(raw);          // 4.1 — unique per IP/value
    res.json(deduped);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch global threats' });
  }
});

// GET /api/threats/feed — 4.5: latest 20 deduplicated indicators for Dashboard card
router.get('/feed', protect, async (req, res) => {
  try {
    const feed = await getLatestFeed(20);
    res.json(feed);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch intel feed' });
  }
});

// GET /api/threats/dashboard — full dashboard summary (counts, top countries, etc.)
router.get('/dashboard', protect, async (req, res) => {
  try {
    const data = await getGlobalDashboardData();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch global data' });
  }
});

// GET /api/threats/correlate — run correlation engine for current user
router.get('/correlate', protect, async (req, res) => {
  try {
    const analysis = await correlateLocalWithGlobal(req.user._id);
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ message: 'Correlation analysis failed', error: err.message });
  }
});

module.exports = router;
