const rateLimit = require('express-rate-limit');

// 1. IP-Based Rate Limiter (200 requests / 15 mins)
const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, 
  message: { 
    message: 'Too many requests from this IP. Please try again after 15 minutes.',
    status: 429
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 2. Circuit Breaker State Management
const circuitState = new Map();
const FAILURE_THRESHOLD = 3;
const COOLDOWN_PERIOD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Wraps an external API call with Circuit Breaker logic.
 * If an external API (like VirusTotal) fails 3 times, trips and throws a specific error
 * so the ApiOrchestrator can fallback to OSINT/Cache.
 */
const withCircuitBreaker = async (serviceName, apiCall) => {
  const state = circuitState.get(serviceName) || { failures: 0, trippedUntil: null };

  // Check if circuit is currently tripped
  if (state.trippedUntil && Date.now() < state.trippedUntil) {
    throw new Error(`CIRCUIT_TRIPPED:${serviceName}`); // Orchestrator must catch this to fallback
  }

  try {
    const result = await apiCall();
    
    // Reset circuit on successful call
    if (state.failures > 0 || state.trippedUntil) {
      circuitState.set(serviceName, { failures: 0, trippedUntil: null });
    }
    
    return result;
  } catch (error) {
    state.failures += 1;
    
    if (state.failures >= FAILURE_THRESHOLD) {
      console.warn(`[CIRCUIT BREAKER] Tripped for ${serviceName}. Fallback mode active for 5 minutes.`);
      state.trippedUntil = Date.now() + COOLDOWN_PERIOD_MS;
    }
    
    circuitState.set(serviceName, state);
    
    // If it just tripped on this fail, we throw the CIRCUIT_TRIPPED error directly
    if (state.failures === FAILURE_THRESHOLD) {
      throw new Error(`CIRCUIT_TRIPPED:${serviceName}`);
    }
    throw error;
  }
};

// 3. User-Specific Aggressive Throttler (50 requests / 60 seconds)
const userCooldowns = new Map();

const enforceCooldown = (req, res, next) => {
  const key = req.user ? req.user._id.toString() : req.ip;
  const cooldownUntil = userCooldowns.get(key);
  
  if (cooldownUntil && Date.now() < cooldownUntil) {
    return res.status(429).json({ message: 'You are currently on a 5-minute cooldown due to excessive requests.' });
  }
  
  if (cooldownUntil && Date.now() >= cooldownUntil) {
    userCooldowns.delete(key);
  }
  
  next();
};

const baseUserLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  // express-rate-limit v8: custom keyGenerator must NOT reference req.ip directly
  // to avoid ERR_ERL_KEY_GEN_IPV6. For authenticated users we key by userId;
  // for unauthenticated requests we skip per-user limiting (global limiter covers them).
  skip: (req) => !req.user,
  keyGenerator: (req) => req.user._id.toString(),
  handler: async (req, res, next, options) => {
    const key = req.user ? req.user._id.toString() : req.ip;
    
    // Set 5-minute cooldown
    userCooldowns.set(key, Date.now() + 5 * 60 * 1000);
    
    if (req.user) {
      // Use ActivityLog (not AuditLog) for throttle events — AuditLog schema
      // requires method/route fields that aren't available in this context
      const { ActivityLog } = require('../models/index');
      try {
        await ActivityLog.create({
          userId:  req.user._id,
          action:  'THROTTLED_USER_EVENT',
          details: 'User exceeded 50 tool requests in 60 seconds. 5-minute cooldown activated.',
          icon:    '⚠️'
        });
      } catch (e) { console.error('Activity log failed for throttle event', e); }
    }
    
    res.status(429).json({ message: 'Rate limit exceeded. 5-minute cooldown activated.' });
  }
});

const userSpecificLimiter = [enforceCooldown, baseUserLimiter];

module.exports = {
  globalRateLimiter,
  withCircuitBreaker,
  userSpecificLimiter
};
