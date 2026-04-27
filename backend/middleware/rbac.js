'use strict';

/**
 * CipherNest RBAC Middleware
 * PROJECT_CONSTITUTION.md §3 — Role-Based Access Control
 *
 * Enforces route-level authorization based on the role embedded in the
 * authenticated user's JWT payload (populated by the `protect` middleware).
 *
 * Three roles are defined by the Constitution:
 *
 *   ROLE_ADMIN — Full access: configuration, simulation, user management.
 *                Inherits all SOC and CISO permissions.
 *
 *   ROLE_SOC   — Threat triage: active alerts, honeypot, network scan,
 *                remediation actions. The default analyst role.
 *
 *   ROLE_CISO  — Executive view: reports, risk trends, compliance metrics.
 *                Read-only access to operational tools.
 *
 * Usage (in any route file):
 *   const { protect } = require('../middleware/auth');
 *   const { requireRole, ROLES } = require('../middleware/rbac');
 *
 *   // Single role
 *   router.post('/simulate', protect, requireRole(ROLES.ADMIN), controller);
 *
 *   // Multiple allowed roles
 *   router.get('/reports', protect, requireRole([ROLES.CISO, ROLES.ADMIN]), controller);
 *
 * IMPORTANT: requireRole() MUST always be placed AFTER protect() in the
 * middleware chain, since it depends on req.user being populated.
 */

// ---------------------------------------------------------------------------
// ROLE REGISTRY
// Must remain in sync with User.js VALID_ROLES and PROJECT_CONSTITUTION.md §3
// ---------------------------------------------------------------------------

const ROLES = Object.freeze({
  ADMIN: 'ROLE_ADMIN',
  SOC:   'ROLE_SOC',
  CISO:  'ROLE_CISO'
});

// ---------------------------------------------------------------------------
// PERMISSION MATRIX
// Defines which roles have access to which route categories.
// Routes listed here are descriptive; enforcement happens per-route via
// requireRole(). This matrix serves as the canonical reference.
// ---------------------------------------------------------------------------

const PERMISSION_MATRIX = Object.freeze({
  // ROLE_ADMIN has global access — checked first in requireRole()
  [ROLES.ADMIN]: [
    '/api/simulation',    // Start/stop attack simulation
    '/api/auth/users',    // User management (future)
    '/api/reports',       // All reporting exports
    '/api/tools',         // All security tools
    '/api/dashboard',     // Dashboard data
    '/api/alerts',        // Alert management
    '/api/threats',       // Global threat intelligence
    '/api/actions',       // Action center
    '/api/wifi',          // Wi-Fi guard
    '/api/network',       // Network map
    '/api/processes',     // Process watcher
    '/api/chat',          // AI assistant
    '/api/secrets',       // Vault
  ],
  [ROLES.SOC]: [
    '/api/tools',         // Security toolkit
    '/api/dashboard',     // Live dashboard
    '/api/alerts',        // Alert triage
    '/api/threats',       // Threat feeds
    '/api/actions',       // Remediation actions
    '/api/wifi',          // Wi-Fi guard
    '/api/network',       // Network map
    '/api/processes',     // Process watcher
    '/api/chat',          // AI assistant
    '/api/secrets',       // Vault
  ],
  [ROLES.CISO]: [
    '/api/reports',       // PDF/JSON export
    '/api/dashboard',     // Read-only dashboard
    '/api/threats',       // Global threat intelligence (read)
    '/api/alerts',        // Read-only alerts
    '/api/chat',          // AI assistant for strategic queries
  ]
});

// ---------------------------------------------------------------------------
// requireRole() — The enforcement factory
// ---------------------------------------------------------------------------

/**
 * Returns an Express middleware that allows access only when the authenticated
 * user's role matches one of the permitted roles.
 *
 * @param {string|string[]} allowedRoles - A single role or array of roles from ROLES.
 * @returns {Function} Express middleware (req, res, next)
 */
const requireRole = (allowedRoles) => {
  // Normalise to array for uniform processing
  const permitted = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  // Validate at startup — catch misconfigured roles early
  const invalid = permitted.filter(r => !Object.values(ROLES).includes(r));
  if (invalid.length > 0) {
    throw new Error(
      `[RBAC] Invalid role(s) in requireRole(): ${invalid.join(', ')}. ` +
      `Valid roles: ${Object.values(ROLES).join(', ')}`
    );
  }

  return (req, res, next) => {
    // Guard: protect() must run first
    if (!req.user) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Authentication required. No user context found.'
      });
    }

    const userRole = req.user.role;

    // ROLE_ADMIN bypasses all role checks — full platform access
    if (userRole === ROLES.ADMIN) {
      return next();
    }

    // Check if user's role is in the permitted list
    if (permitted.includes(userRole)) {
      return next();
    }

    // Access denied — return structured 403 with role context for debugging
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN',
      message: `Access denied. Required role(s): [${permitted.join(', ')}]. Your role: ${userRole}.`,
      required: permitted,
      assigned: userRole
    });
  };
};

// ---------------------------------------------------------------------------
// requireAdmin — Shorthand for admin-only routes
// ---------------------------------------------------------------------------

/**
 * Shorthand middleware for routes restricted to ROLE_ADMIN only.
 * Equivalent to requireRole(ROLES.ADMIN).
 */
const requireAdmin = requireRole(ROLES.ADMIN);

// ---------------------------------------------------------------------------
// requireAnyAuth — Allows any authenticated role (SOC | CISO | ADMIN)
// ---------------------------------------------------------------------------

/**
 * Allows access to any authenticated user regardless of role.
 * Use this instead of leaving routes unguarded.
 */
const requireAnyAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Authentication required.'
    });
  }
  next();
};

// ---------------------------------------------------------------------------
// EXPORTS
// ---------------------------------------------------------------------------

module.exports = { requireRole, requireAdmin, requireAnyAuth, ROLES, PERMISSION_MATRIX };
