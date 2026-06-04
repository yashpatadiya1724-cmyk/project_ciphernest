'use strict';
const express = require('express');
const router  = express.Router();
const { protect }       = require('../middleware/auth');
const { requireAdmin }  = require('../middleware/rbac');
const { startSimulation, stopSimulation, isSimulationActive } = require('../services/simulationService');
const { emitSimEvent, emitThreat } = require('../services/socketService');
const { Alert, ActivityLog }       = require('../models/index');
const { GlobalThreat }             = require('../models/index');

// POST /api/simulation/toggle — Start or stop the attack simulation engine
router.post('/toggle', protect, requireAdmin, (req, res) => {
  const { active } = req.body;
  if (active) startSimulation(req.user._id);
  else        stopSimulation();
  res.json({ active: isSimulationActive(), triggeredBy: req.user.username, role: req.user.role });
});

// GET /api/simulation/status
router.get('/status', protect, requireAdmin, (req, res) => {
  res.json({ active: isSimulationActive() });
});

// POST /api/simulate — 4.4 / 4.8: one-shot SOC simulation
// Inserts synthetic Threat + AuditLog records and pushes via WebSocket.
router.post('/simulate', protect, requireAdmin, async (req, res) => {
  try {
    const userId = req.user._id;
    const CITY_NAMES = ['Moscow','Beijing','Frankfurt','Sao Paulo','Singapore','Dubai','Cape Town'];
    const SEVERITIES = ['medium','high','critical'];

    // 1. Create synthetic threat record (no _id — let MongoDB generate it)
    const synThreat = {
      type:     'ip',
      value:    `${Math.floor(Math.random()*220)+1}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`,
      category: 'Simulated Attack',
      severity: SEVERITIES[Math.floor(Math.random() * SEVERITIES.length)],
      country:  CITY_NAMES[Math.floor(Math.random() * CITY_NAMES.length)],
      source:   'simulation',
      lastSeen: new Date(),
    };

    // Upsert into GlobalThreat collection
    const savedThreat = await GlobalThreat.findOneAndUpdate(
      { value: synThreat.value },
      synThreat,
      { upsert: true, new: true }
    );

    // 2. Create alert
    await Alert.create({
      userId,
      type:    synThreat.severity === 'critical' ? 'critical' : 'warning',
      title:   `Simulated ${synThreat.severity.toUpperCase()} Threat`,
      message: `Synthetic attack from ${synThreat.value} (${synThreat.country}) detected.`,
      source:  'simulation',
    });

    // 3. Activity log
    await ActivityLog.create({
      userId,
      action:  'SOC Simulation Triggered',
      details: `Synthetic threat: ${synThreat.value} [${synThreat.severity}]`,
      icon:    '☣️',
    });

    // 4. Push via WebSocket — ThreatMap and Dashboard update in real time
    emitThreat(savedThreat.toObject());
    emitSimEvent({ threats: [savedThreat.toObject()], alert: { title: 'Simulated Threat', severity: savedThreat.severity } });

    res.json({ success: true, threat: savedThreat });
  } catch (err) {
    res.status(500).json({ message: 'Simulation failed', error: err.message });
  }
});

module.exports = router;

