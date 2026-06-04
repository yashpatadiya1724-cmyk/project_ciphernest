'use strict';
const { Alert, GlobalThreat, Recommendation } = require('../models/index');
const { generateCipherResponse } = require('./groqService');

// ---------------------------------------------------------------------------
// 4.1 — deduplicateThreats
// Groups by ip/value, keeps the highest-severity record per unique indicator.
// Severity order: critical > high > medium > low
// ---------------------------------------------------------------------------
const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 };

const deduplicateThreats = (threats) => {
  const map = new Map();
  for (const t of threats) {
    const key = (t.value || t.ip || t.srcIp || '').toLowerCase().trim();
    if (!key) continue;
    const existing = map.get(key);
    const incomingRank = SEVERITY_RANK[t.severity] || 0;
    const existingRank = existing ? (SEVERITY_RANK[existing.severity] || 0) : -1;
    if (!existing || incomingRank > existingRank) {
      map.set(key, t);
    }
  }
  return Array.from(map.values());
};

/**
 * Service to correlate local signals with global threat intelligence
 */
const correlateLocalWithGlobal = async (userId) => {
  try {
    const localAlerts = await Alert.find({ userId, dismissed: false }).sort({ timestamp: -1 }).limit(50);
    const globalThreats = await GlobalThreat.find().sort({ lastSeen: -1 }).limit(100);

    const matches = [];

    // Analyze correlations
    for (const alert of localAlerts) {
      // 1. IP Match Correlation
      const ipMatch = alert.message.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/);
      if (ipMatch) {
        const found = globalThreats.find(t => t.value === ipMatch[0]);
        if (found) {
          matches.push({
            type: 'IP_REPUTATION_MATCH',
            localAlert: alert,
            globalThreat: found
          });

          // Create High-Priority recommendation
          await Recommendation.findOneAndUpdate(
            { userId, title: `Block Malicious IP: ${found.value}` },
            {
              userId,
              title: `Block Malicious IP: ${found.value}`,
              description: `This IP has been detected locally and matches global threat databases for ${found.category}. Immediate blockade recommended.`,
              severity: found.severity || 'high',
              status: 'pending',
              actionType: 'firewall',
              affectedResource: found.value
            },
            { upsert: true, new: true }
          );
        }
      }
    }

    if (matches.length > 0) {
      // Use AI to generate a "So What?" insight for the correlations
      const insightPrompt = `I have found ${matches.length} correlations between local activity and global threat intelligence.
      MATCHES: ${JSON.stringify(matches.map(m => ({ local: m.localAlert.title, global: m.globalThreat.category })))}
      Provide a concise 2-3 sentence technical summary of this correlation and the immediate danger to the user.`;

      const aiResponse = await generateCipherResponse({
        userMessage: insightPrompt,
        context: { toolType: 'correlation_engine', matches }
      });

      return {
        count: matches.length,
        summary: typeof aiResponse.response === 'string'
          ? aiResponse.response
          : aiResponse.response?.threat_assessment || JSON.stringify(aiResponse.response),
        matches
      };
    }

    return { count: 0, summary: 'No global threat correlations detected.' };
  } catch (error) {
    console.error('Correlation Engine Error:', error);
    return { count: 0, summary: 'Engine analysis failed.' };
  }
};

module.exports = { correlateLocalWithGlobal, deduplicateThreats };
