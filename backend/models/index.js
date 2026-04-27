const mongoose = require('mongoose');

// ToolResult model
// scan_hash: MD5 fingerprint of toolId+normalizedInput — used as EventStore cache key
// (PROJECT_CONSTITUTION.md §2 — Canonicalization Layer)
const toolResultSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toolType: { type: String, required: true }, // phishing, password, breach, domain, port, ip
  input: { type: String },
  normalized_input: { type: String },          // canonical form of the input
  scan_hash: { type: String, index: true },    // MD5(toolId + normalized_input) — cache key
  result: { type: mongoose.Schema.Types.Mixed },
  riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  riskScore: { type: Number, default: 0 },
  confidence_score: { type: Number, default: 0.5, min: 0, max: 1 }, // §4 Confidence Scoring
  mitre_category: { type: String },            // §4 Kill Chain Mapping (e.g. T1071)
  summary: { type: String },
  source: { type: String, default: 'simulation' }, // 'live_api' | 'cache' | 'osint' | 'simulation'
  timestamp: { type: Date, default: Date.now }
});

// Alert model
const alertSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
  title: { type: String, required: true },
  message: { type: String, required: true },
  source: { type: String }, // which tool triggered it
  dismissed: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});

// ChatHistory model
const chatHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  context: { type: mongoose.Schema.Types.Mixed }, // tool result context if any
  timestamp: { type: Date, default: Date.now }
});

// ThreatLog model
const threatLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true },
  description: { type: String },
  riskLevel: { type: String, enum: ['low', 'medium', 'high'] },
  resolved: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});

// ActivityLog model
const activityLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  details: { type: String },
  icon: { type: String },
  timestamp: { type: Date, default: Date.now }
});

// GlobalThreat model
const globalThreatSchema = new mongoose.Schema({
  type: { type: String, enum: ['ip', 'domain', 'url', 'hash'], required: true },
  value: { type: String, required: true, unique: true },
  category: { type: String, default: 'General Malware' },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  source: { type: String, default: 'Global Intel' },
  country: { type: String },
  countryCode: { type: String },
  lastSeen: { type: Date, default: Date.now },
  metadata: { type: mongoose.Schema.Types.Mixed }
});

// Recommendation (Action Center) model
const recommendationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  status: { type: String, enum: ['pending', 'resolved', 'ignored'], default: 'pending' },
  actionType: { type: String }, // e.g., 'firewall', 'password', 'device'
  affectedResource: { type: String }, // e.g., 'Port 80', 'User Account'
  timestamp: { type: Date, default: Date.now }
});

// RiskTrend model
const riskTrendSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  score: { type: Number, required: true },
  breakdown: {
    passwords: { type: Number, default: 0 },
    ports: { type: Number, default: 0 },
    devices: { type: Number, default: 0 },
    globalIntel: { type: Number, default: 0 },
    patterns: { type: Number, default: 0 }
  },
  timestamp: { type: Date, default: Date.now }
});

// ---------------------------------------------------------------------------
// AuditLog model — PROJECT_CONSTITUTION.md §3 (Immutable Audit Logging)
// Append-only. No update or delete operations should ever target this collection.
// ---------------------------------------------------------------------------
const auditLogSchema = new mongoose.Schema({
  // Who made the request
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  username:    { type: String, default: 'anonymous' },
  role:        { type: String, default: 'unauthenticated' },         // ADMIN | SOC | CISO

  // What was requested
  method:      { type: String, required: true },                      // GET | POST | ...
  route:       { type: String, required: true },                      // req.originalUrl
  body:        { type: mongoose.Schema.Types.Mixed, default: {} },   // sanitized — passwords stripped

  // Where it came from
  ip:          { type: String },
  user_agent:  { type: String },

  // Outcome
  status_code: { type: Number },
  duration_ms: { type: Number },                                      // response time in ms

  // Immutability marker
  timestamp:   { type: Date, default: Date.now, immutable: true }    // cannot be updated
}, {
  // Prevent accidental updates to any audit record
  strict: true
});

// Compound index for efficient analyst queries: by user over time
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ route:  1, timestamp: -1 });

// ---------------------------------------------------------------------------
// IMMUTABILITY GUARDS — PROJECT_CONSTITUTION.md §3
// Block any attempt to update or delete audit records at the ODM layer.
// These hooks fire before findOneAndUpdate, updateOne, deleteOne, etc.
// ---------------------------------------------------------------------------
const AUDIT_MUTATION_ERROR = 'AuditLog records are immutable. UPDATE and DELETE operations are forbidden.';

auditLogSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany', 'replaceOne'], function () {
  throw new Error(AUDIT_MUTATION_ERROR);
});

auditLogSchema.pre(['deleteOne', 'findOneAndDelete', 'deleteMany'], function () {
  throw new Error(AUDIT_MUTATION_ERROR);
});

// Guard on document-level save: only allow insert (isNew), never update
auditLogSchema.pre('save', function (next) {
  if (!this.isNew) {
    return next(new Error(AUDIT_MUTATION_ERROR));
  }
  next();
});

const ToolResult     = mongoose.model('ToolResult',     toolResultSchema);
const Alert          = mongoose.model('Alert',          alertSchema);
const ChatHistory    = mongoose.model('ChatHistory',    chatHistorySchema);
const ThreatLog      = mongoose.model('ThreatLog',      threatLogSchema);
const ActivityLog    = mongoose.model('ActivityLog',    activityLogSchema);
const GlobalThreat   = mongoose.model('GlobalThreat',   globalThreatSchema);
const Recommendation = mongoose.model('Recommendation', recommendationSchema);
const RiskTrend      = mongoose.model('RiskTrend',      riskTrendSchema);
const AuditLog       = mongoose.model('AuditLog',       auditLogSchema);

module.exports = { 
  ToolResult, Alert, ChatHistory, ThreatLog, ActivityLog, 
  GlobalThreat, Recommendation, RiskTrend, AuditLog
};
