'use strict';
/**
 * Latency Middleware — Phase 4.7
 * Records request duration and emits latency:update via Socket.IO.
 * Uses a response-local variable to avoid ERR_HTTP_HEADERS_SENT —
 * we store the start time on req and read it in a response wrapper,
 * never calling setHeader after the response has finished.
 */
const { emitLatency } = require('../services/socketService');

// Rolling window — last 100 request durations (ms)
const latencyWindow = [];
const WINDOW_SIZE = 100;

const getStats = () => {
  if (!latencyWindow.length) return { avg: 0, p95: 0, count: 0 };
  const sorted = [...latencyWindow].sort((a, b) => a - b);
  const avg    = Math.round(latencyWindow.reduce((s, v) => s + v, 0) / latencyWindow.length);
  const p95    = sorted[Math.floor(sorted.length * 0.95)] || 0;
  return { avg, p95, count: latencyWindow.length };
};

let emitCounter = 0;

const latencyMiddleware = (req, res, next) => {
  const start = Date.now();

  // Intercept res.end() — fires before headers are locked, unlike 'finish' event
  const originalEnd = res.end.bind(res);
  res.end = function (...args) {
    const ms = Date.now() - start;

    // Only set header if headers haven't been sent yet
    if (!res.headersSent) {
      try { res.setHeader('X-Latency', `${ms}ms`); } catch (_) { /* ignore */ }
    }

    // Maintain rolling window
    latencyWindow.push(ms);
    if (latencyWindow.length > WINDOW_SIZE) latencyWindow.shift();

    // Emit stats every 10 requests
    emitCounter++;
    if (emitCounter % 10 === 0) {
      emitLatency(getStats());
    }

    return originalEnd(...args);
  };

  next();
};

module.exports = { latencyMiddleware, getLatencyStats: getStats };
