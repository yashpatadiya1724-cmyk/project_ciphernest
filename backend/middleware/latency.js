'use strict';
/**
 * Latency Middleware — Phase 4.7
 * Records request duration, appends X-Latency header, and emits
 * latency:update via Socket.IO every 10 requests for the UI gauge.
 * Also stores a rolling window of the last 100 durations in memory.
 */
const { emitLatency } = require('../services/socketService');

// Rolling window — last 100 request durations (ms)
const window = [];
const WINDOW_SIZE = 100;

const getStats = () => {
  if (!window.length) return { avg: 0, p95: 0, count: 0 };
  const sorted = [...window].sort((a, b) => a - b);
  const avg    = Math.round(window.reduce((s, v) => s + v, 0) / window.length);
  const p95    = sorted[Math.floor(sorted.length * 0.95)] || 0;
  return { avg, p95, count: window.length };
};

let emitCounter = 0;

const latencyMiddleware = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const ms = Date.now() - start;

    // Append X-Latency header for DevTools inspection
    res.setHeader('X-Latency', `${ms}ms`);

    // Maintain rolling window
    window.push(ms);
    if (window.length > WINDOW_SIZE) window.shift();

    // Emit stats every 10 requests to avoid flooding the socket
    emitCounter++;
    if (emitCounter % 10 === 0) {
      emitLatency(getStats());
    }
  });

  next();
};

module.exports = { latencyMiddleware, getLatencyStats: getStats };
