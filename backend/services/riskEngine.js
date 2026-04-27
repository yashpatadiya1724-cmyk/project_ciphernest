const User = require('../models/User');
const { Alert, ActivityLog, ToolResult, Recommendation } = require('../models/index');

/**
 * Determine risk level from score
 */
const getRiskLevel = (score) => {
  if (score >= 70) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
};

/**
 * Get alert type from risk level
 */
const getAlertType = (riskLevel) => {
  const map = { low: 'info', medium: 'warning', high: 'critical' };
  return map[riskLevel] || 'info';
};

/**
 * Analyze phishing URL risk
 */
const analyzePhishingRisk = (url) => {
  let score = 0;
  const flags = [];

  const suspiciousKeywords = ['login', 'verify', 'account', 'secure', 'update', 'confirm', 'banking', 'paypal', 'amazon'];
  const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top'];
  const ipPattern = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/;

  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    const hostname = urlObj.hostname.toLowerCase();

    if (ipPattern.test(hostname)) { score += 40; flags.push('IP address used instead of domain'); }
    if (hostname.split('.').length > 4) { score += 20; flags.push('Too many subdomains'); }
    suspiciousTLDs.forEach(tld => {
      if (hostname.endsWith(tld)) { score += 30; flags.push(`Suspicious TLD: ${tld}`); }
    });
    suspiciousKeywords.forEach(kw => {
      if (hostname.includes(kw)) { score += 15; flags.push(`Suspicious keyword in domain: ${kw}`); }
    });
    if (!url.startsWith('https')) { score += 20; flags.push('No HTTPS encryption'); }
    if (url.length > 100) { score += 10; flags.push('Unusually long URL'); }
  } catch {
    score += 50;
    flags.push('Invalid or malformed URL');
  }

  score = Math.min(score, 100);
  return {
    score,
    riskLevel: getRiskLevel(score),
    flags,
    verdict: score >= 70 ? 'Dangerous' : score >= 35 ? 'Suspicious' : 'Safe'
  };
};

/**
 * Analyze password strength
 */
const analyzePasswordStrength = (password) => {
  let score = 0;
  const suggestions = [];

  if (password.length >= 8) score += 20; else suggestions.push('Use at least 8 characters');
  if (password.length >= 12) score += 10; else suggestions.push('12+ characters is much stronger');
  if (password.length >= 16) score += 10;
  if (/[A-Z]/.test(password)) score += 15; else suggestions.push('Add uppercase letters');
  if (/[a-z]/.test(password)) score += 15; else suggestions.push('Add lowercase letters');
  if (/[0-9]/.test(password)) score += 15; else suggestions.push('Add numbers');
  if (/[^A-Za-z0-9]/.test(password)) score += 15; else suggestions.push('Add special characters (!@#$%)');

  const commonPasswords = ['password', '123456', 'qwerty', 'abc123', 'password1', '111111'];
  if (commonPasswords.includes(password.toLowerCase())) {
    score = Math.min(score, 10);
    suggestions.unshift('This is a very common password — change it immediately!');
  }

  const strength = score >= 80 ? 'Strong' : score >= 50 ? 'Moderate' : score >= 25 ? 'Weak' : 'Very Weak';
  const riskLevel = score >= 80 ? 'low' : score >= 50 ? 'medium' : 'high';

  return { score, strength, suggestions, riskLevel };
};

/**
 * Analyze domain reputation
 */
const analyzeDomainReputation = (domain) => {
  let trustScore = 70;
  const flags = [];
  const suspicious = ['free', 'win', 'prize', 'click', 'earn', 'cheap', 'best'];
  const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.top', '.xyz'];

  const d = domain.toLowerCase();
  suspicious.forEach(kw => {
    if (d.includes(kw)) { trustScore -= 15; flags.push(`Suspicious keyword: ${kw}`); }
  });
  suspiciousTLDs.forEach(tld => {
    if (d.endsWith(tld)) { trustScore -= 25; flags.push(`Low-trust TLD: ${tld}`); }
  });
  if (d.split('.').length > 3) { trustScore -= 10; flags.push('Multiple subdomains'); }
  if (/\d{4,}/.test(d)) { trustScore -= 10; flags.push('Many consecutive digits'); }

  trustScore = Math.max(0, Math.min(100, trustScore));
  const riskLevel = trustScore < 40 ? 'high' : trustScore < 65 ? 'medium' : 'low';

  return { trustScore, riskLevel, flags, verdict: trustScore >= 65 ? 'Trustworthy' : trustScore >= 40 ? 'Questionable' : 'Risky' };
};

/**
 * Update user security score based on tool results
 */
const updateSecurityScore = async (userId, riskLevel, toolType) => {
  const user = await User.findById(userId);
  if (!user) return;

  let delta = 0;
  if (riskLevel === 'high') delta = -10;
  else if (riskLevel === 'medium') delta = -5;
  else delta = 2; // safe results slightly improve score

  user.securityScore = Math.max(0, Math.min(100, user.securityScore + delta));
  await user.save();
  return user.securityScore;
};

/**
 * Create alert from tool result
 */
const createAlertFromTool = async (userId, toolType, riskLevel, message) => {
  if (riskLevel === 'low') return;

  const titles = {
    phishing: 'Phishing URL Detected',
    password: 'Weak Password Found',
    breach: 'Data Breach Detected',
    domain: 'Suspicious Domain',
    port: 'Open Ports Detected',
    ip: 'Risky IP Address',
    'hash-decoder': 'Weak Credential Found',
    'dark-web': 'Dark Web Exposure',
    'network': 'Unknown Device on Network',
    'sandbox': 'Malicious File Detected'
  };

  await Alert.create({
    userId,
    type: getAlertType(riskLevel),
    title: titles[toolType] || 'Security Alert',
    message,
    source: toolType
  });

  // Also create a recommendation if high risk
  if (riskLevel === 'high') {
    await Recommendation.findOneAndUpdate(
      { userId, title: `Secure ${toolType} vulnerability` },
      {
        userId,
        title: `Secure ${toolType} vulnerability`,
        description: `Critical issue detected in ${toolType}: ${message}. Immediate action required.`,
        severity: 'high',
        status: 'pending',
        actionType: toolType,
        timestamp: new Date()
      },
      { upsert: true, new: true }
    );
  }
};

/**
 * Get detailed score breakdown
 */
const getScoreBreakdown = async (userId) => {
  const user = await User.findById(userId);
  const results = await ToolResult.find({ userId }).sort({ timestamp: -1 }).limit(20);
  
  const breakdown = {
    passwords: 0,
    ports: 0,
    devices: 0,
    globalIntel: 0,
    patterns: 0
  };

  results.forEach(r => {
    if (r.riskLevel === 'high') {
      if (r.toolType === 'password' || r.toolType === 'hash-decoder') breakdown.passwords -= 15;
      if (r.toolType === 'port') breakdown.ports -= 10;
      if (r.toolType === 'network') breakdown.devices -= 10;
    }
  });

  // Calculate current score components
  const baseScore = 100;
  const currentScore = user ? user.securityScore : 80;

  return {
    total: currentScore,
    deductions: breakdown,
    potential: baseScore,
    status: currentScore >= 80 ? 'Good' : currentScore >= 50 ? 'Fair' : 'Critical'
  };
};

/**
 * Calculate aggregate risk based on all signals
 */
const calculateAggregateRisk = (signals) => {
  let totalRisk = 0;
  
  if (signals.openPorts > 5) totalRisk += 50;
  else if (signals.openPorts > 0) totalRisk += 20;
  
  if (signals.weakPasswords > 0) totalRisk += 35;
  if (signals.unknownDevices > 0) totalRisk += 30;
  if (signals.recentBreaches > 0) totalRisk += 60;
  if (signals.patternAlerts > 0) totalRisk += 40;
  if (signals.globalThreatMatches > 0) totalRisk += 55;

  totalRisk = Math.min(100, totalRisk);
  return {
    score: totalRisk,
    level: getRiskLevel(totalRisk),
    status: totalRisk >= 75 ? 'Critical' : totalRisk >= 40 ? 'High' : totalRisk >= 20 ? 'Moderate' : 'Low'
  };
};

/**
 * Capture a point-in-time risk snapshot for the user
 */
const { RiskTrend } = require('../models/index');
const captureRiskSnapshot = async (userId) => {
  try {
    const breakdown = await getScoreBreakdown(userId);
    
    // Fetch last snapshot to see if score changed
    const lastSnapshot = await RiskTrend.findOne({ userId }).sort({ timestamp: -1 });

    if (!lastSnapshot || lastSnapshot.score !== breakdown.total) {
      await RiskTrend.create({
        userId,
        score: breakdown.total,
        breakdown: breakdown.deductions,
        timestamp: new Date()
      });
      // Only log if we actually created a new snapshot
      console.log(`📊 Risk snapshot captured for user ${userId}: ${breakdown.total}%`);
    }
  } catch (error) {
    console.error('Failed to capture risk snapshot:', error);
  }
};

/**
 * Hook for Heuristic Fine-Tuning — legacy shim kept for backward compat
 */
const logFeedback = async (feedbackId) => {
  const AnalystFeedback = require('../models/AnalystFeedback');
  const feedback = await AnalystFeedback.findById(feedbackId);
  if (!feedback) return;
  console.log(`[Heuristic Tuning] Feedback ${feedbackId} logged for ${feedback.toolType}.`);
};

// ---------------------------------------------------------------------------
// Heuristic Auto-Tuning — PROJECT_CONSTITUTION.md §4 Confidence Scoring
//
// Reads AnalystFeedback. For any toolType with >10 false_positive flags
// (reportedStatus === 'Safe' on a flagged result), reduce that tool's
// confidence_score weight by 0.05 (floor: 0.10).
//
// Idempotent: running twice with the same data produces the same result.
// Scheduled every 24 hours in server.js.
// ---------------------------------------------------------------------------
const confidenceWeights = {};
const FALSE_POSITIVE_THRESHOLD = 10;
const WEIGHT_PENALTY = 0.05;
const WEIGHT_FLOOR   = 0.10;

const runHeuristicTuning = async () => {
  const AnalystFeedback = require('../models/AnalystFeedback');
  try {
    const fpCounts = await AnalystFeedback.aggregate([
      { $match: { reportedStatus: 'Safe' } },
      { $group: { _id: '$toolType', count: { $sum: 1 } } }
    ]);

    let tuned = 0;
    for (const { _id: toolType, count } of fpCounts) {
      if (count > FALSE_POSITIVE_THRESHOLD) {
        const current = confidenceWeights[toolType] ?? 1.0;
        const updated = Math.max(WEIGHT_FLOOR, parseFloat((current - WEIGHT_PENALTY).toFixed(2)));
        if (updated !== current) {
          confidenceWeights[toolType] = updated;
          tuned++;
          console.log(
            `[HeuristicTuning] toolType="${toolType}" fp_count=${count} weight: ${current} → ${updated}`
          );
        }
      }
    }

    if (tuned > 0) {
      console.log(`[HeuristicTuning] ✅ Tuned ${tuned} tool weight(s).`);
    } else {
      console.log('[HeuristicTuning] No tuning required — all tools within threshold.');
    }
    return confidenceWeights;
  } catch (err) {
    console.error('[HeuristicTuning] ❌ Failed:', err.message);
  }
};

/** Returns current confidence weight for a toolType (used by toolsController) */
const getConfidenceWeight = (toolType) => confidenceWeights[toolType] ?? 1.0;

module.exports = {
  getRiskLevel,
  analyzePhishingRisk,
  analyzePasswordStrength,
  analyzeDomainReputation,
  updateSecurityScore,
  createAlertFromTool,
  getScoreBreakdown,
  calculateAggregateRisk,
  captureRiskSnapshot,
  logFeedback,
  runHeuristicTuning,
  getConfidenceWeight
};
