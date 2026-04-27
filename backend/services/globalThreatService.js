const axios = require('axios');
const { GlobalThreat } = require('../models/index');

/**
 * Fetch and normalize global threat indicators.
 * PROJECT_CONSTITUTION.md §4 — Fallback Protocol:
 *   Tier 1: VirusTotal hunting feed (if VIRUSTOTAL_API_KEY present)
 *   Tier 2: AbuseIPDB recent reports (if ABUSEIPDB_API_KEY present)
 *   Tier 3: Weighted mock data (simulation fallback)
 */
const fetchGlobalThreats = async () => {
  try {
    const hasVT       = !!process.env.VIRUSTOTAL_API_KEY;
    const hasAbuseIPDB = !!process.env.ABUSEIPDB_API_KEY;

    let indicators = [];

    // ── TIER 1: VirusTotal ──────────────────────────────────────────────
    if (hasVT) {
      try {
        console.log('🌐 [GlobalThreat] Fetching from VirusTotal hunting feed...');
        const vtRes = await axios.get('https://www.virustotal.com/api/v3/intelligence/hunting_rulesets', {
          headers: { 'x-apikey': process.env.VIRUSTOTAL_API_KEY },
          params: { limit: 40 },
          timeout: 10000
        });
        const vtItems = vtRes.data?.data || [];
        indicators = vtItems.map(item => ({
          value:    item.id || `vt-${Date.now()}-${Math.random()}`,
          type:     'hash',
          category: 'VirusTotal Intelligence',
          severity: 'high',
          source:   'live_api',
          country:  item.attributes?.origin_country || 'Unknown',
          countryCode: item.attributes?.origin_country || 'UN'
        }));
        console.log(`✅ [GlobalThreat] VirusTotal: ${indicators.length} indicators loaded.`);
      } catch (err) {
        console.warn(`⚠️  [GlobalThreat] VirusTotal call failed: ${err.message}`);
      }
    }

    // ── TIER 2: AbuseIPDB ────────────────────────────────────────────
    if (hasAbuseIPDB && indicators.length === 0) {
      try {
        console.log('🌐 [GlobalThreat] Fetching from AbuseIPDB blacklist...');
        const abuseRes = await axios.get('https://api.abuseipdb.com/api/v2/blacklist', {
          headers: { Key: process.env.ABUSEIPDB_API_KEY, Accept: 'application/json' },
          params: { limit: 85, confidenceMinimum: 90 },
          timeout: 10000
        });
        const abuseItems = abuseRes.data?.data || [];
        indicators = abuseItems.map(item => ({
          value:    item.ipAddress,
          type:     'ip',
          category: 'Abuse/Spam/Botnet',
          severity: item.abuseConfidenceScore >= 95 ? 'critical' : 'high',
          source:   'live_api',
          country:  item.countryCode || 'Unknown',
          countryCode: item.countryCode || 'UN'
        }));
        console.log(`✅ [GlobalThreat] AbuseIPDB: ${indicators.length} indicators loaded.`);
      } catch (err) {
        console.warn(`⚠️  [GlobalThreat] AbuseIPDB call failed: ${err.message}`);
      }
    }

    // ── TIER 4: SIMULATION (weighted mock) ────────────────────────────
    if (indicators.length === 0) {
      console.log('🧬 [GlobalThreat] No API keys configured — using weighted simulation data.');
      indicators = getMockThreats();
    }

    // Upsert into DB as EventStore cache
    for (const data of indicators) {
      await GlobalThreat.findOneAndUpdate(
        { value: data.value },
        data,
        { upsert: true, new: true }
      );
    }

    return indicators;
  } catch (error) {
    console.error('Global Threat Fetch Error:', error);
    return [];
  }
};

const getGlobalDashboardData = async () => {
  const threats = await GlobalThreat.find().sort({ lastSeen: -1 }).limit(100);
  
  // Aggregate stats for dashboard
  const topCountries = {};
  const threatTypes = { malware: 0, phishing: 0, botnet: 0, exploit: 0 };

  threats.forEach(t => {
    if (t.country) topCountries[t.country] = (topCountries[t.country] || 0) + 1;
    const cat = t.category.toLowerCase();
    if (cat.includes('malware')) threatTypes.malware++;
    else if (cat.includes('phish')) threatTypes.phishing++;
    else if (cat.includes('bot')) threatTypes.botnet++;
    else threatTypes.exploit++;
  });

  return {
    totalThreats: threats.length,
    topCountries: Object.entries(topCountries).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count).slice(0, 5),
    threatTypes: Object.entries(threatTypes).map(([name, value]) => ({ name, value })),
    recentThreats: threats.slice(0, 10)
  };
};

const getMockThreats = () => {
  const categories = [
    { cat: 'Botnet/Brute Force', type: 'ip' },
    { cat: 'Phishing', type: 'domain' },
    { cat: 'SSH Brute Force', type: 'ip' },
    { cat: 'Malware Host', type: 'url' },
    { cat: 'Spam/Phishing', type: 'ip' },
    { cat: 'Ransomware (LockBit)', type: 'hash' },
    { cat: 'C2 Server', type: 'ip' },
    { cat: 'Credential Harvester', type: 'url' },
    { cat: 'DDoS Reflector', type: 'ip' }
  ];
  
  const countries = [
    { name: 'China', code: 'CN', weight: 15 },
    { name: 'Russia', code: 'RU', weight: 12 },
    { name: 'United States', code: 'US', weight: 10 },
    { name: 'Brazil', code: 'BR', weight: 8 },
    { name: 'Netherlands', code: 'NL', weight: 6 },
    { name: 'Romania', code: 'RO', weight: 5 },
    { name: 'Unknown', code: 'UN', weight: 4 },
    { name: 'North Korea', code: 'KP', weight: 3 },
    { name: 'Iran', code: 'IR', weight: 4 }
  ];

  const severities = ['low', 'medium', 'high', 'critical'];

  const generated = [];
  
  const pickCountry = () => {
    const totalWeight = countries.reduce((acc, c) => acc + c.weight, 0);
    let r = Math.random() * totalWeight;
    for (let c of countries) {
      if (r < c.weight) return c;
      r -= c.weight;
    }
    return countries[0];
  };

  const generateValue = (type) => {
    const rInt = (max) => Math.floor(Math.random() * max);
    if (type === 'ip') return `${rInt(220)+1}.${rInt(255)}.${rInt(255)}.${rInt(255)}`;
    if (type === 'domain') return `malicious-actor-${rInt(10000)}.xyz`;
    if (type === 'url') return `http://bad-domain-${rInt(5000)}.com/payload_${rInt(100)}.exe`;
    if (type === 'hash') return Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
  };

  for (let i = 0; i < 85; i++) {
    const c = pickCountry();
    const cat = categories[Math.floor(Math.random() * categories.length)];
    const sev = severities[Math.floor(Math.random() * severities.length)];
    
    generated.push({
      value: generateValue(cat.type),
      type: cat.type,
      category: cat.cat,
      severity: sev,
      country: c.name,
      countryCode: c.code
    });
  }

  return generated;
};

module.exports = { fetchGlobalThreats, getGlobalDashboardData };
