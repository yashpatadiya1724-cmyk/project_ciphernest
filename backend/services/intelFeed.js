'use strict';
/**
 * Intel Feed Service — Phase 4.5
 * Background poller that fetches from external threat-intel sources,
 * normalises records into the GlobalThreat schema, upserts to DB,
 * and pushes new indicators to the frontend via Socket.IO (intel:feed).
 *
 * Schedule: every 15 minutes (configurable via INTEL_FEED_INTERVAL_MS).
 * Deduplication: uses deduplicateThreats from intelligenceEngine.
 */
const { fetchGlobalThreats }    = require('./globalThreatService');
const { deduplicateThreats }    = require('./intelligenceEngine');
const { emitFeedFetch }         = require('./socketService');
const { GlobalThreat }          = require('../models/index');

const INTERVAL_MS = parseInt(process.env.INTEL_FEED_INTERVAL_MS || '900000', 10); // 15 min

let feedTimer = null;

const runFeedCycle = async () => {
  try {
    console.log('[IntelFeed] Running threat-intel fetch cycle…');
    const raw      = await fetchGlobalThreats();
    const deduped  = deduplicateThreats(raw);

    // Emit the latest batch to all connected clients
    if (deduped.length > 0) {
      emitFeedFetch(deduped.slice(0, 20));
      console.log(`[IntelFeed] ✅ Pushed ${deduped.length} deduplicated indicators.`);
    }
    return deduped;
  } catch (err) {
    console.error('[IntelFeed] ❌ Feed cycle failed:', err.message);
    return [];
  }
};

const startIntelFeed = () => {
  if (feedTimer) return; // idempotent
  feedTimer = setInterval(runFeedCycle, INTERVAL_MS);
  console.log(`🌐 [IntelFeed] Background feed started — interval: ${INTERVAL_MS / 60000} min.`);
};

const stopIntelFeed = () => {
  if (feedTimer) { clearInterval(feedTimer); feedTimer = null; }
};

// GET /api/threats/feed — latest 20 deduplicated indicators for the Dashboard card
const getLatestFeed = async (limit = 20) => {
  const raw    = await GlobalThreat.find().sort({ lastSeen: -1 }).limit(limit * 3).lean();
  return deduplicateThreats(raw).slice(0, limit);
};

module.exports = { startIntelFeed, stopIntelFeed, runFeedCycle, getLatestFeed };
