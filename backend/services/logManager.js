'use strict';
/**
 * CipherNest Log Archival Service
 * PROJECT_CONSTITUTION.md §3 — Audit Trail Retention
 *
 * Runs daily at 02:00 UTC via node-cron.
 * Moves AuditLog entries older than 90 days into AuditLogArchive.
 * The archive collection is also append-only — same immutability rules apply.
 *
 * Register in server.js:
 *   const { startLogArchival } = require('./services/logManager');
 *   startLogArchival();
 */

const cron    = require('node-cron');
const mongoose = require('mongoose');
const { AuditLog } = require('../models/index');

// ---------------------------------------------------------------------------
// AuditLogArchive schema — mirrors AuditLog, adds archivedAt timestamp
// ---------------------------------------------------------------------------
const archiveSchema = new mongoose.Schema({
  // Original AuditLog fields
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  username:    { type: String, default: 'anonymous' },
  role:        { type: String, default: 'unauthenticated' },
  method:      { type: String },
  route:       { type: String },
  body:        { type: mongoose.Schema.Types.Mixed, default: {} },
  ip:          { type: String },
  user_agent:  { type: String },
  status_code: { type: Number },
  duration_ms: { type: Number },
  timestamp:   { type: Date, immutable: true },
  // Archive metadata
  archivedAt:  { type: Date, default: Date.now, immutable: true }
}, { strict: true });

archiveSchema.index({ userId: 1, timestamp: -1 });

// Prevent mutations on archive records too
const ARCHIVE_MUTATION_ERROR = 'AuditLogArchive records are immutable.';
archiveSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany', 'replaceOne',
                   'deleteOne', 'findOneAndDelete', 'deleteMany'], function () {
  throw new Error(ARCHIVE_MUTATION_ERROR);
});

// Reuse model if already registered (hot-reload safe)
const AuditLogArchive = mongoose.models.AuditLogArchive
  || mongoose.model('AuditLogArchive', archiveSchema);

// ---------------------------------------------------------------------------
// Core archival job
// ---------------------------------------------------------------------------
const RETENTION_DAYS = 90;

const runArchival = async () => {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  console.log(`[LogManager] Starting archival — cutoff: ${cutoff.toISOString()}`);

  try {
    // Fetch in batches of 500 to avoid memory spikes
    const BATCH = 500;
    let archived = 0;

    while (true) {
      const records = await AuditLog.find({ timestamp: { $lt: cutoff } })
        .limit(BATCH).lean();

      if (records.length === 0) break;

      // Insert into archive (ignore duplicates via ordered:false)
      await AuditLogArchive.insertMany(
        records.map(r => ({ ...r, _id: undefined, archivedAt: new Date() })),
        { ordered: false }
      ).catch(err => {
        // Duplicate key errors are acceptable — record already archived
        if (err.code !== 11000) throw err;
      });

      // Delete originals by their _ids (bypasses the pre-delete hook on the
      // AuditLog model by using the native driver directly)
      const ids = records.map(r => r._id);
      await mongoose.connection.collection('auditlogs').deleteMany({ _id: { $in: ids } });

      archived += records.length;
    }

    console.log(`[LogManager] ✅ Archived ${archived} records older than ${RETENTION_DAYS} days.`);
  } catch (err) {
    console.error('[LogManager] ❌ Archival job failed:', err.message);
  }
};

// ---------------------------------------------------------------------------
// Scheduler — daily at 02:00 UTC
// ---------------------------------------------------------------------------
const startLogArchival = () => {
  // '0 2 * * *' = every day at 02:00 UTC
  cron.schedule('0 2 * * *', runArchival, { timezone: 'UTC' });
  console.log('📦 [LogManager] Log archival cron registered — runs daily at 02:00 UTC.');
};

module.exports = { startLogArchival, runArchival, AuditLogArchive };
