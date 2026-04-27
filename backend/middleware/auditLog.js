'use strict';

/**
 * CipherNest AuditLog Middleware
 * PROJECT_CONSTITUTION.md §3 — Security, Governance & Compliance
 *
 * Intercepts ALL API requests and writes an immutable record to the
 * AuditLog collection containing:
 *   - req.user (userId, username, role)
 *   - req.originalUrl
 *   - req.body (sanitized — all credential fields stripped)
 *   - req.ip
 *   - User-Agent
 *   - Response status_code
 *   - Request duration_ms
 *   - Timestamp (immutable field on schema level)
 *
 * Design decisions:
 *   - Uses res.on('finish') to capture the final status_code after the
 *     response is fully sent, avoiding race conditions.
 *   - Never throws or blocks the request — any internal logging failure
 *     is swallowed so the API continues to function.
 *   - Strips password, token, secret, key fields from body before storage
 *     to comply with data minimization principles.
 */

const { AuditLog } = require('../models/index');

// ---------------------------------------------------------------------------
// SENSITIVE FIELD SANITIZER
// ---------------------------------------------------------------------------

/**
 * Fields that must never appear in the audit log body.
 * Matched case-insensitively against top-level body keys.
 */
const SENSITIVE_FIELDS = new Set([
  'password', 'confirmpassword', 'newpassword', 'oldpassword',
  'token', 'accesstoken', 'refreshtoken',
  'secret', 'key', 'apikey', 'api_key', 'groq_api_key',
  'authorization', 'twoFactorSecret', 'otp'
]);

/**
 * Returns a shallow copy of the body with sensitive fields replaced by "[REDACTED]".
 * Never mutates the original req.body.
 *
 * @param {object} body - req.body
 * @returns {object}
 */
const sanitizeBody = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const sanitized = {};
  for (const [key, value] of Object.entries(body)) {
    if (SENSITIVE_FIELDS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

// ---------------------------------------------------------------------------
// MIDDLEWARE
// ---------------------------------------------------------------------------

/**
 * auditLogMiddleware
 *
 * Mount globally in server.js AFTER json/urlencoded parsers so req.body is
 * populated, but BEFORE route handlers so timing starts at the right point.
 *
 * Example (server.js):
 *   const { auditLogMiddleware } = require('./middleware/auditLog');
 *   app.use('/api/', auditLogMiddleware);
 */
const auditLogMiddleware = (req, res, next) => {
  const startTime = Date.now();

  // Capture response finish event
  res.on('finish', async () => {
    try {
      const duration_ms = Date.now() - startTime;

      // Extract identity from req.user (populated by protect middleware if authenticated)
      const userId   = req.user?._id   || null;
      const username = req.user?.username || 'anonymous';
      const role     = req.user?.role     || 'unauthenticated';

      await AuditLog.create({
        userId,
        username,
        role,
        method:      req.method,
        route:       req.originalUrl,
        body:        sanitizeBody(req.body),
        ip:          req.ip || req.connection?.remoteAddress || 'unknown',
        user_agent:  req.get('User-Agent') || 'unknown',
        status_code: res.statusCode,
        duration_ms,
        // timestamp is set by schema default (immutable)
      });
    } catch (err) {
      // NEVER block the request pipeline on an audit failure
      console.error('[AuditLog] Failed to write audit record:', err.message);
    }
  });

  next();
};

// ---------------------------------------------------------------------------
// EXPORTS
// ---------------------------------------------------------------------------

module.exports = { auditLogMiddleware, sanitizeBody };
