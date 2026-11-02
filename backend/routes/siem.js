/**
 * CipherNest & BreachBarrier — SIEM Kafka Stream & Time-Series Controller Routes
 */

const express = require('express');
const router = express.Router();
const { siemStream } = require('../services/siemKafkaStream');

/**
 * POST /api/siem/ingest
 * Ingest single or batch logs into Kafka stream broker
 */
router.post('/ingest', (req, res) => {
  try {
    const { topic = 'firewall.traffic', events } = req.body;
    
    if (!events || !Array.isArray(events)) {
      return res.status(400).json({ success: false, message: 'Invalid payload: events array required' });
    }

    const produced = siemStream.produceBatch(topic, events);

    return res.status(202).json({
      success: true,
      ingestedCount: produced.length,
      topic,
      sampleOffset: produced[0]?.offset ?? 0,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/siem/metrics
 * Returns real-time throughput, partition offsets and stream health
 */
router.get('/metrics', (req, res) => {
  try {
    const metrics = siemStream.getMetrics();
    return res.json({ success: true, metrics });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/siem/anomalies
 * Returns all real-time detected security anomalies
 */
router.get('/anomalies', (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const anomalies = siemStream.anomalies.slice(-limit).reverse();
    return res.json({
      success: true,
      totalCount: siemStream.anomalies.length,
      anomalies
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
