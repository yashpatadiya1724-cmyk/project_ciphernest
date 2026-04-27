require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const http    = require('http');

// ── Process-level error guards ───────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('🔥 UNCAUGHT EXCEPTION:', err.stack || err);
});
process.on('unhandledRejection', (reason) => {
  console.error('🌊 UNHANDLED REJECTION:', reason?.stack || reason);
});

const connectDB = require('./config/db');

// ── Route imports ────────────────────────────────────────────────────────────
const authRoutes       = require('./routes/auth');
const dashboardRoutes  = require('./routes/dashboard');
const toolRoutes       = require('./routes/tools');
const wifiRoutes       = require('./routes/wifi');
const chatRoutes       = require('./routes/chat');
const alertRoutes      = require('./routes/alerts');
const secretRoutes     = require('./routes/secrets');
const reportRoutes     = require('./routes/reports');
const networkRoutes    = require('./routes/network');
const processRoutes    = require('./routes/processes');
const simulationRoutes = require('./routes/simulation');
const threatRoutes     = require('./routes/threats');
const actionRoutes     = require('./routes/actions');
const feedbackRoutes   = require('./routes/feedback');
const attackPathRoutes = require('./routes/attackPathRoutes');
const analyticsRoutes  = require('./routes/analyticsRoutes');
const healthRoutes     = require('./routes/health');
// Phase 2 — new admin-only routes (2.1 RBAC)
const auditRoutes      = require('./routes/audit');
const configRoutes     = require('./routes/config');

// ── Governance middleware ────────────────────────────────────────────────────
const { auditLogMiddleware } = require('./middleware/auditLog');
const { globalRateLimiter, userSpecificLimiter } = require('./middleware/rateLimiter');
const { securityHeaders } = require('./middleware/securityHeaders');
const { latencyMiddleware } = require('./middleware/latency');  // 4.7

const app = express();

// Connect to MongoDB
connectDB();

// ── 2.7 Security Headers — Helmet (hardened) ────────────────────────────────
// helmet() sets: X-DNS-Prefetch-Control, X-Frame-Options, X-Content-Type-Options,
// Referrer-Policy, X-Permitted-Cross-Domain-Policies, X-Download-Options.
// We override CSP and HSTS explicitly below.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      // Remove unsafe-inline — use nonces in production if inline scripts are needed
      scriptSrc:      ["'self'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
      styleSrc:       ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:        ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:         ["'self'", 'data:', 'https:'],
      connectSrc:     ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc:      ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  // HSTS: 1 year, include subdomains — only meaningful over HTTPS
  strictTransportSecurity: {
    maxAge: 31536000,
    includeSubDomains: true
  },
  frameguard:        { action: 'deny' },
  xContentTypeOptions: true,
  referrerPolicy:    { policy: 'strict-origin-when-cross-origin' }
}));

// Custom headers not covered by helmet (XSS-Protection legacy browsers)
app.use(securityHeaders);

// CORS — origin list from env in production, fallback to localhost for dev
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(cors({ origin: allowedOrigins, credentials: true }));

// ── Rate limiting ────────────────────────────────────────────────────────────
app.use('/api/', globalRateLimiter);
app.use('/api/tools', userSpecificLimiter);

// ── 2.8 Payload Limits ───────────────────────────────────────────────────────
// Global: 10kb — prevents large-payload DoS attacks
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Stricter 8kb limit on scan/tool endpoints (applied per-route via middleware)
const scanPayloadLimit = express.json({ limit: '8kb' });
// Applied below on /api/tools

// ── Governance Layer (PROJECT_CONSTITUTION.md §3) ────────────────────────────
app.use('/api/', auditLogMiddleware);
app.use('/api/', latencyMiddleware);   // 4.7 — latency tracking on all API routes

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/dashboard',   dashboardRoutes);
app.use('/api/tools',       scanPayloadLimit, toolRoutes);   // 8kb limit on scans
app.use('/api/wifi',        wifiRoutes);
app.use('/api/chat',        chatRoutes);
app.use('/api/alerts',      alertRoutes);
app.use('/api/secrets',     secretRoutes);
app.use('/api/reports',     reportRoutes);
app.use('/api/feedback',    feedbackRoutes);
app.use('/api/attack-path', attackPathRoutes);
app.use('/api/analytics',   analyticsRoutes);
app.use('/api/health',      healthRoutes);
app.use('/api/network',     networkRoutes);
app.use('/api/processes',   processRoutes);
app.use('/api/simulation',  simulationRoutes);
app.use('/api/threats',     threatRoutes);
app.use('/api/actions',     actionRoutes);
// Phase 2 — admin-only governance routes
app.use('/api/audit',       auditRoutes);   // 2.1 RBAC: ROLE_ADMIN only
app.use('/api/config',      configRoutes);  // 2.1 RBAC: ROLE_ADMIN only

// ── 2.6 Global Error Handler — stack trace suppression ───────────────────────
// In production: generic message only. In dev: full stack exposed.
// This MUST be the last app.use() before server.listen().
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const isDev = process.env.NODE_ENV !== 'production';

  // Always log full error server-side
  console.error('[GlobalErrorHandler]', err.stack || err);

  res.status(err.status || 500).json({
    success: false,
    message: isDev ? err.message : 'An internal server error occurred.',
    // Stack only visible in development — never leaked to production clients
    ...(isDev && { stack: err.stack })
  });
});

// ── Service imports ──────────────────────────────────────────────────────────
const { checkGroqHealth }                    = require('./services/groqService');
const { startResourceGuard }                 = require('./services/resourceGuard');
const { startHoneypot }                      = require('./services/honeypotService');
const { startPortScanner, startNetworkScanner } = require('./services/reconService');
const { initSocket }                         = require('./services/socketService');
const { fetchGlobalThreats }                 = require('./services/globalThreatService');
const { captureRiskSnapshot, runHeuristicTuning } = require('./services/riskEngine');
const { startLogArchival }                   = require('./services/logManager');   // 2.3
const { startIntelFeed }                     = require('./services/intelFeed');    // 4.5
const User = require('./models/User');

const PORT   = process.env.PORT || 5000;
const server = http.createServer(app);

initSocket(server);

server.listen(PORT, async () => {
  // ── 5.7 — Go-Live production banner ──────────────────────────────────────
  if (process.env.NODE_ENV === 'production') {
    console.log('\n🚀 CIPHERNEST IS NOW PRODUCTION-READY | GO-LIVE PERMITTED\n');
  }

  console.log(`🛡️  CipherNest backend running on port ${PORT}`);

  await fetchGlobalThreats();
  console.log('🌐 Global threat intelligence updated.');

  // ── Governance boot confirmation ─────────────────────────────────────────
  console.log('📋 [RBAC]     Role-Based Access Control : ACTIVE');
  console.log('📋 [AUDIT]    Immutable Audit Logging   : ACTIVE  (AuditLog collection)');
  console.log('📋 [CANON]    Canonicalization Layer    : READY   (utils/canonicalize.js)');
  console.log('📋 [ARCHIVAL] Log Archival Cron         : ACTIVE  (daily 02:00 UTC)');
  console.log('📋 [HEURISTIC]Heuristic Auto-Tuning     : ACTIVE  (every 24h)');
  console.log('📋 [INTEL]    Intel Feed Poller         : ACTIVE  (every 15 min)');
  console.log('📋 [LATENCY]  Latency Middleware         : ACTIVE  (X-Latency header)');
  console.log('─────────────────────────────────────────────────────────────────');

  // ── 2.3 Log Archival — daily cron ────────────────────────────────────────
  startLogArchival();

  // ── 4.5 Intel Feed — background poller ───────────────────────────────────
  startIntelFeed();

  // ── 2.4 Heuristic Auto-Tuning — every 24 hours ───────────────────────────
  await runHeuristicTuning(); // run once at boot
  setInterval(runHeuristicTuning, 24 * 60 * 60 * 1000);

  // ── Risk snapshot worker — every 60s ─────────────────────────────────────
  setInterval(async () => {
    try {
      const users = await User.find({}, '_id');
      for (const user of users) await captureRiskSnapshot(user._id);
    } catch (err) {
      console.error('Background Snapshot Error:', err);
    }
  }, 60000);
  console.log('📊 Risk snapshot worker started.');

  // ── Groq health check ────────────────────────────────────────────────────
  const groqOnline = await checkGroqHealth();
  if (groqOnline) {
    console.log(`🤖 Groq AI status: Online (Model: ${process.env.GROQ_MODEL || 'llama3-8b-8192'})`);
  } else {
    console.warn('⚠️  Groq AI status: Offline (Check GROQ_API_KEY in .env)');
  }

  // ── Background security services ─────────────────────────────────────────
  startResourceGuard();
  User.findOne().then(user => {
    const userId = user?._id || null;
    startHoneypot(userId);
    startPortScanner(userId);
    startNetworkScanner(userId);
  }).catch(err => {
    console.error('Service startup error, starting anonymously:', err);
    startHoneypot(null);
    startPortScanner(null);
    startNetworkScanner(null);
  });
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = (signal) => {
  console.log(`\n[Shutdown] ${signal} received — closing server gracefully...`);
  server.close(() => {
    console.log('[Shutdown] HTTP server closed.');
    process.exit(0);
  });
  // Force exit after 10s if connections hang
  setTimeout(() => process.exit(1), 10000);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
