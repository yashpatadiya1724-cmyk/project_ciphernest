'use strict';
/**
 * CipherNest Heartbeat Service
 * Provides getDeepHealth() — used by /api/health/detailed
 * Pings MongoDB, Groq, AbuseIPDB, and VirusTotal concurrently.
 * Results are cached for 30 seconds to avoid hammering external APIs.
 */
const mongoose = require('mongoose');
const axios    = require('axios');

let cache = { data: null, timestamp: 0, ttl: 30 * 1000 };

const pingGroq = async () => {
  try {
    const start = Date.now();
    await axios.get('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      timeout: 3000
    });
    return { status: 'healthy', latency_ms: Date.now() - start };
  } catch (err) {
    return { status: 'degraded', error: err.message };
  }
};

const pingAbuseIPDB = async () => {
  if (!process.env.ABUSEIPDB_API_KEY) return { status: 'not_configured' };
  try {
    const start = Date.now();
    await axios.get('https://api.abuseipdb.com/api/v2/check', {
      params: { ipAddress: '8.8.8.8' },
      headers: { Key: process.env.ABUSEIPDB_API_KEY, Accept: 'application/json' },
      timeout: 3000
    });
    return { status: 'healthy', latency_ms: Date.now() - start };
  } catch (err) {
    return { status: 'degraded', error: err.message };
  }
};

const pingVirusTotal = async () => {
  if (!process.env.VIRUSTOTAL_API_KEY) return { status: 'not_configured' };
  try {
    const start = Date.now();
    await axios.get('https://www.virustotal.com/api/v3/ip_addresses/8.8.8.8', {
      headers: { 'x-apikey': process.env.VIRUSTOTAL_API_KEY },
      timeout: 3000
    });
    return { status: 'healthy', latency_ms: Date.now() - start };
  } catch (err) {
    return { status: 'degraded', error: err.message };
  }
};

const getDeepHealth = async () => {
  if (Date.now() - cache.timestamp < cache.ttl && cache.data) {
    return cache.data;
  }

  const dbState = mongoose.connection.readyState;
  const dbStatusMap = {
    0: 'disconnected', 1: 'connected',
    2: 'connecting',   3: 'disconnecting', 99: 'uninitialized'
  };

  // Concurrent pings — never let one failure block the others
  const [groqStatus, abuseIPStatus, vtStatus] = await Promise.all([
    pingGroq(), pingAbuseIPDB(), pingVirusTotal()
  ]);

  const dbHealthy   = dbState === 1;
  const groqHealthy = groqStatus.status === 'healthy';

  const health = {
    timestamp:      new Date(),
    overall_status: (dbHealthy && groqHealthy) ? 'healthy' : 'degraded',
    mongo_status:   dbHealthy ? 'healthy' : 'degraded',
    database: {
      status: dbHealthy ? 'healthy' : 'degraded',
      state:  dbStatusMap[dbState] || 'unknown'
    },
    groq_status: groqStatus.status,
    ai_engine:   groqStatus,
    external_intel_status: (
      abuseIPStatus.status === 'healthy' || vtStatus.status === 'healthy'
    ) ? 'healthy' : 'degraded',
    external_apis: {
      abuseIPDB:   abuseIPStatus,
      virusTotal:  vtStatus
    }
  };

  cache.data      = health;
  cache.timestamp = Date.now();
  return health;
};

module.exports = { getDeepHealth };
