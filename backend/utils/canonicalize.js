const crypto = require('crypto');

/**
 * Standardize and canonicalize inputs for consistent hashing and auditing.
 * Enforces Audit-First Design logic.
 */
const canonicalize = {
  // Extract clean FQDN from complex URLs
  extractFQDN: (url) => {
    try {
      if (!url) return '';
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      return parsed.hostname.toLowerCase();
    } catch {
      return url.toLowerCase().trim();
    }
  },

  // Strip protocol entirely for plain domain matching
  stripProtocol: (url) => {
    if (!url) return '';
    return url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].toLowerCase().trim();
  },

  // Generate an MD5 hash of the payload for canonical caching
  generateScanHash: (payload) => {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto.createHash('md5').update(data).digest('hex');
  },

  // Deterministic caching check key generator
  generateCacheKey: (tool, input) => {
    const fqdn = canonicalize.extractFQDN(input);
    return `${tool}:${canonicalize.generateScanHash(fqdn)}`;
  },

  // Preprocess input for orchestrator
  preprocess: async (toolType, input, inputType) => {
    let normalized = input;
    if (inputType === 'url' || inputType === 'domain') {
      normalized = canonicalize.extractFQDN(input);
    } else if (inputType === 'ip') {
      normalized = input.trim();
    }
    const scan_hash = canonicalize.generateScanHash(normalized);
    return { normalized, scan_hash, cached: null };
  }
};

module.exports = canonicalize;
