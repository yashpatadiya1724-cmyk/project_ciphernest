const crypto = require('crypto');

/**
 * Common passwords dictionary
 * In a real production app, this would be a large text file or database.
 * For this version, we use a curated list of common weak passwords.
 */
const COMMON_PASSWORDS = [
  'password', '123456', '123456789', 'qwerty', 'password123', 'admin', 'welcome', 'login', 'security',
  '12345', '1234567', 'p@ssword', 'guest', 'root', 'user123', 'iloveyou', 'sunshine', 'princess'
];

/**
 * Detect hash type based on length and characters
 */
const detectHashType = (hash) => {
  const h = hash.trim();
  if (/^[a-f0-9]{32}$/i.test(h)) return 'MD5';
  if (/^[a-f0-9]{40}$/i.test(h)) return 'SHA-1';
  if (/^[a-f0-9]{64}$/i.test(h)) return 'SHA-256';
  return 'Unknown';
};

/**
 * Perform dictionary attack (simulated lookup)
 */
const dictionaryAttack = (hash, type) => {
  for (const pwd of COMMON_PASSWORDS) {
    const computed = crypto.createHash(type.toLowerCase().replace('-', '')).update(pwd).digest('hex');
    if (computed === hash.toLowerCase()) {
      return pwd;
    }
  }
  return null;
};

/**
 * Estimate crack time (simulated based on complexity)
 */
const estimateCrackTime = (type, isFound) => {
  if (isFound) return 'Instant';
  const times = {
    'MD5': 'Hours to Days (on modern hardware)',
    'SHA-1': 'Days to Weeks',
    'SHA-256': 'Years (unless weak password used)'
  };
  return times[type] || 'Unknown';
};

/**
 * Classify strength of the underlying password
 */
const classifyStrength = (password) => {
  if (!password) return 'Strong / Secure';
  if (password.length < 8) return 'Weak';
  if (COMMON_PASSWORDS.includes(password.toLowerCase())) return 'Weak (Commonly used)';
  return 'Moderate';
};

/**
 * Get security insight for the hash
 */
const getInsight = (type, decodedValue) => {
  if (decodedValue) {
    return `Common password found in breaches. Using ${type} for security is vulnerable to rainbow table attacks. Use Argon2 or bcrypt instead.`;
  }
  return `${type} is a fast hashing algorithm. Even if not in this dictionary, it remains susceptible to high-speed brute-force attacks.`;
};

/**
 * Main decoder logic
 */
const decodeHash = async (hash) => {
  const type = detectHashType(hash);
  if (type === 'Unknown') {
    return {
      success: false,
      message: 'Unsupported or invalid hash format. Please provide MD5, SHA-1, or SHA-256.'
    };
  }

  const decodedValue = dictionaryAttack(hash, type);
  const strength = classifyStrength(decodedValue);
  const crackTime = estimateCrackTime(type, !!decodedValue);
  const insight = getInsight(type, decodedValue);

  return {
    success: true,
    data: {
      hash,
      type,
      decodedValue: decodedValue || 'Not found in dictionary',
      strength,
      crackTime,
      insight,
      found: !!decodedValue
    }
  };
};

module.exports = { decodeHash, detectHashType };
