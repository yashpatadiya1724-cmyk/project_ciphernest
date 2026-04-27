const { ActivityLog, Alert, Recommendation } = require('../models/index');

/**
 * Service to detect suspicious behavior patterns over time
 */
const detectPatterns = async (userId) => {
  try {
    const logs = await ActivityLog.find({ userId }).sort({ timestamp: -1 }).limit(100);
    
    const patterns = [];

    // Pattern 1: Brute Force Attempt (Simulated by repeated high-frequency login/access)
    const logins = logs.filter(l => l.action.toLowerCase().includes('login') || l.action.toLowerCase().includes('auth'));
    if (logins.length >= 5) {
      const recentLogins = logins.slice(0, 5);
      const timeDiff = recentLogins[0].timestamp - recentLogins[4].timestamp;
      if (timeDiff < 60000) { // 5 logins in 1 minute
        patterns.push({
          type: 'BRUTE_FORCE_SUSPECT',
          severity: 'high',
          description: 'High-frequency authentication attempts detected.'
        });

        await Recommendation.findOneAndUpdate(
          { userId, title: 'Enable IP Rate Limiting' },
          {
            userId,
            title: 'Enable IP Rate Limiting',
            description: 'Repeated authentication attempts suggest a brute-force attack. Strengthen rate limits and consider 2FA.',
            severity: 'high',
            status: 'pending',
            actionType: 'security_config',
            affectedResource: 'Auth API'
          },
          { upsert: true, new: true }
        );
      }
    }

    // Pattern 2: Persistent Unknown Devices
    const unknownDevices = logs.filter(l => l.details.toLowerCase().includes('unknown device'));
    if (unknownDevices.length >= 3) {
      patterns.push({
        type: 'RECURRING_UNKNOWN_DEVICE',
        severity: 'medium',
        description: 'An unknown device has appeared in multiple scans.'
      });

      await Recommendation.findOneAndUpdate(
        { userId, title: 'Investigate Unknown Device' },
        {
          userId,
          title: 'Investigate Unknown Device',
          description: 'A device with an unrecognised MAC/Vendor is regularly appearing on your network. Check your WiFi clients.',
          severity: 'medium',
          status: 'pending',
          actionType: 'device_audit',
          affectedResource: 'Local Network'
        },
        { upsert: true, new: true }
      );
    }

    // Pattern 3: Repeated Weak Credentials
    const weakPasswords = logs.filter(l => l.details.toLowerCase().includes('weak password') || l.details.toLowerCase().includes('cracked'));
    if (weakPasswords.length >= 3) {
      patterns.push({
        type: 'REPEATED_WEAK_CREDENTIALS',
        severity: 'high',
        description: 'Multiple users or services are using weak passwords.'
      });

      await Recommendation.findOneAndUpdate(
        { userId, title: 'Enforce Strong Password Policy' },
        {
          userId,
          title: 'Enforce Strong Password Policy',
          description: 'System-wide detection of multiple weak passwords. Enforce 12+ character complexity.',
          severity: 'high',
          status: 'pending',
          actionType: 'password_policy',
          affectedResource: 'IAM Settings'
        },
        { upsert: true, new: true }
      );
    }

    return patterns;
  } catch (error) {
    console.error('Pattern Engine Error:', error);
    return [];
  }
};

module.exports = { detectPatterns };
