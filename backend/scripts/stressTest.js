#!/usr/bin/env node
/**
 * CipherNest Stress Test — Phase 5.5
 * Sends N concurrent requests to the health and simulation endpoints.
 * Reports: avg latency, max latency, p95 latency, error rate.
 *
 * Usage:
 *   node scripts/stressTest.js [--requests=1000] [--concurrency=50] [--host=http://localhost:5000]
 *
 * Requires the backend to be running. No auth token needed for /api/health.
 */

const http  = require('http');
const https = require('https');

// ── Config ────────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v]; })
);

const TOTAL_REQUESTS = parseInt(args.requests   || '1000', 10);
const CONCURRENCY    = parseInt(args.concurrency || '50',   10);
const HOST           = args.host || 'http://localhost:5000';
const TARGET_PATH    = '/api/health';

// ── HTTP request helper ───────────────────────────────────────────────────────
const request = (url) => new Promise((resolve) => {
  const start   = Date.now();
  const lib     = url.startsWith('https') ? https : http;
  const req     = lib.get(url, (res) => {
    res.resume(); // drain body
    res.on('end', () => resolve({ ok: res.statusCode < 500, ms: Date.now() - start, status: res.statusCode }));
  });
  req.setTimeout(10000, () => { req.destroy(); resolve({ ok: false, ms: Date.now() - start, status: 0 }); });
  req.on('error', () => resolve({ ok: false, ms: Date.now() - start, status: 0 }));
});

// ── Runner ────────────────────────────────────────────────────────────────────
const run = async () => {
  console.log(`\n🔥 CipherNest Stress Test`);
  console.log(`   Target      : ${HOST}${TARGET_PATH}`);
  console.log(`   Requests    : ${TOTAL_REQUESTS}`);
  console.log(`   Concurrency : ${CONCURRENCY}`);
  console.log(`   ─────────────────────────────────`);

  const results  = [];
  let completed  = 0;
  let errors     = 0;
  const startAll = Date.now();

  // Process in batches of CONCURRENCY
  for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENCY) {
    const batch = Math.min(CONCURRENCY, TOTAL_REQUESTS - i);
    const promises = Array.from({ length: batch }, () => request(`${HOST}${TARGET_PATH}`));
    const batchResults = await Promise.all(promises);

    for (const r of batchResults) {
      results.push(r.ms);
      completed++;
      if (!r.ok) errors++;
    }

    // Progress indicator every 100 requests
    if (completed % 100 === 0 || completed === TOTAL_REQUESTS) {
      process.stdout.write(`\r   Progress: ${completed}/${TOTAL_REQUESTS} (${errors} errors)`);
    }
  }

  const totalMs = Date.now() - startAll;
  console.log('\n');

  // ── Statistics ──────────────────────────────────────────────────────────────
  const sorted  = [...results].sort((a, b) => a - b);
  const avg     = Math.round(results.reduce((s, v) => s + v, 0) / results.length);
  const max     = sorted[sorted.length - 1];
  const min     = sorted[0];
  const p50     = sorted[Math.floor(sorted.length * 0.50)];
  const p95     = sorted[Math.floor(sorted.length * 0.95)];
  const p99     = sorted[Math.floor(sorted.length * 0.99)];
  const errRate = ((errors / TOTAL_REQUESTS) * 100).toFixed(2);
  const rps     = Math.round(TOTAL_REQUESTS / (totalMs / 1000));

  const latencyStatus = avg <= 100 ? '✅ EXCELLENT' : avg <= 500 ? '⚠️  ACCEPTABLE' : '❌ DEGRADED';
  const errorStatus   = errors === 0 ? '✅ ZERO ERRORS' : errors < 5 ? '⚠️  MINOR' : '❌ CRITICAL';

  console.log(`   ── Results ──────────────────────────────────`);
  console.log(`   Total time   : ${totalMs}ms`);
  console.log(`   Throughput   : ${rps} req/s`);
  console.log(`   ─────────────────────────────────────────────`);
  console.log(`   Avg latency  : ${avg}ms    ${latencyStatus}`);
  console.log(`   Min latency  : ${min}ms`);
  console.log(`   P50 latency  : ${p50}ms`);
  console.log(`   P95 latency  : ${p95}ms`);
  console.log(`   P99 latency  : ${p99}ms`);
  console.log(`   Max latency  : ${max}ms`);
  console.log(`   ─────────────────────────────────────────────`);
  console.log(`   Errors       : ${errors}/${TOTAL_REQUESTS} (${errRate}%)  ${errorStatus}`);
  console.log(`   ─────────────────────────────────────────────\n`);

  // ── Pass/Fail ───────────────────────────────────────────────────────────────
  const passed = p95 <= 500 && errors === 0;
  if (passed) {
    console.log('   🚀 STRESS TEST PASSED — Platform is production-ready.\n');
    process.exit(0);
  } else {
    console.error('   ❌ STRESS TEST FAILED — Review latency or error rate before go-live.\n');
    process.exit(1);
  }
};

run().catch(err => { console.error('Stress test error:', err); process.exit(1); });
