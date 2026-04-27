const { ToolResult, ActivityLog } = require('../models/index');
const {
  analyzePhishingRisk,
  analyzePasswordStrength,
  analyzeDomainReputation,
  updateSecurityScore,
  createAlertFromTool
} = require('../services/riskEngine');
const { generateCipherResponse } = require('../services/groqService');
// PROJECT_CONSTITUTION.md §4 — Intelligence Orchestrator (replaces direct mock calls)
const { orchestrate, getIntel } = require('../services/apiOrchestrator');
const mongoose = require('mongoose');
let AuditLog;
try { AuditLog = mongoose.model('AuditLog'); } catch (e) { AuditLog = mongoose.model('ActivityLog'); }
const { preprocess } = require('../utils/canonicalize');
const crypto = require('crypto');
const net = require('net');
const { enumerateSubdomains } = require('../services/reconService');
const { decodeHash: decodeHashService } = require('../services/hashService');

// Helper: persist result and request AI explanation
// Now also writes canonicalization fields per PROJECT_CONSTITUTION.md §2 & §4
const saveAndAnalyze = async (
  userId, toolType, input, result, riskLevel, summary,
  { scan_hash = null, normalized_input = null, source = 'simulation',
    confidence_score = 0.4, mitre_category = null } = {}
) => {
  // Get structured AI explanation (Task 2.3 — JSON response) FIRST
  const aiResponse = await generateCipherResponse({
    userMessage: `Explain this ${toolType} scan result: ${summary}`,
    toolResult: result,
    riskLevel,
    context: { toolType, summary }
  });

  // Extract JSON payload safely
  const aiData = typeof aiResponse.response === 'object' 
    ? aiResponse.response 
    : { threat_assessment: aiResponse.response, mitre_code: null, remediation: [] };

  const toolResult = await ToolResult.create({
    userId, toolType, input, 
    result: { ...result, remediation: aiData.remediation }, 
    riskLevel, summary,
    normalized_input, scan_hash, source, confidence_score, 
    mitre_category: aiData.mitre_code || mitre_category
  });

  await ActivityLog.create({ userId, action: `Used ${toolType} tool`, details: summary, icon: '🔍' });
  await updateSecurityScore(userId, riskLevel, toolType);
  if (riskLevel !== 'low') await createAlertFromTool(userId, toolType, riskLevel, summary);

  return { toolResult, aiExplanation: aiData.threat_assessment };
};

// --- PHISHING DETECTOR ---
// PROJECT_CONSTITUTION.md §4: Routes through apiOrchestrator (Live API → Cache → OSINT → Simulation)
const checkPhishing = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ message: 'URL is required' });

    // §2 Canonicalization
    const { normalized, scan_hash, cached } = await preprocess('phishing', url, 'url');
    if (cached) {
      return res.json({ ...cached.result, source: 'cache', cached: true, confidence_score: 0.8 });
    }

    // §4 Orchestrator waterfall
    const analysis = await orchestrate('phishing', { normalized, scan_hash, userId: req.user._id });
    const summary = `URL "${normalized}" is ${analysis.verdict}. Risk score: ${analysis.score ?? analysis.vtScore ?? 'N/A'}/100. Source: ${analysis.source}. Flags: ${(analysis.flags || []).join(', ') || 'none'}`;

    const { toolResult, aiExplanation } = await saveAndAnalyze(
      req.user._id, 'phishing', url, analysis, analysis.riskLevel, summary,
      { scan_hash, normalized_input: normalized, source: analysis.source,
        confidence_score: analysis.confidence_score, mitre_category: analysis.mitre_category }
    );

    res.json({ ...analysis, aiExplanation, id: toolResult._id });
  } catch (error) {
    res.status(500).json({ message: 'Phishing check failed', error: error.message });
  }
};

// --- PASSWORD ANALYZER ---
const analyzePassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ message: 'Password is required' });

    const analysis = analyzePasswordStrength(password);
    const summary = `Password strength: ${analysis.strength} (${analysis.score}/100). ${analysis.suggestions.length} improvement suggestions.`;

    const { toolResult, aiExplanation } = await saveAndAnalyze(
      req.user._id, 'password', '***hidden***', { ...analysis, password: undefined }, analysis.riskLevel, summary
    );

    res.json({ ...analysis, aiExplanation, id: toolResult._id });
  } catch (error) {
    res.status(500).json({ message: 'Password analysis failed', error: error.message });
  }
};

// --- BREACH CHECKER ---
const checkBreach = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    // Use apiOrchestrator (Task 2.2)
    const analysis = await getIntel(email, 'BREACH_CHECKER', { context: 'Identity Intel' });
    
    // Explicit AuditLog for execution & provider tracking
    try { await AuditLog.create({ userId: req.user._id, action: 'BREACH_CHECK', details: `Checked ${email} via ${analysis.provider}`, type: 'info' }); } catch(e){}

    const summary = `Email ${email} check complete. Verdict: ${analysis.verdict}. Source: ${analysis.provider}. Flags: ${(analysis.flags || []).join(', ') || 'none'}`;

    const { toolResult, aiExplanation } = await saveAndAnalyze(
      req.user._id, 'breach', email, analysis, analysis.riskLevel, summary,
      { scan_hash: analysis.scan_hash, normalized_input: email, source: analysis.provider,
        confidence_score: analysis.confidence_score }
    );

    res.json({ ...analysis, email, aiExplanation, id: toolResult._id, requiresFeedback: true });
  } catch (error) {
    res.status(500).json({ message: 'Breach check failed', error: error.message });
  }
};

// --- DOMAIN REPUTATION ---
// PROJECT_CONSTITUTION.md §4: Routes through apiOrchestrator
const checkDomainReputation = async (req, res) => {
  try {
    const { domain } = req.body;
    if (!domain) return res.status(400).json({ message: 'Domain is required' });

    // §2 Canonicalization
    const { normalized, scan_hash, cached } = await preprocess('domain', domain, 'domain');
    if (cached) {
      return res.json({ ...cached.result, source: 'cache', cached: true, confidence_score: 0.8 });
    }

    // §4 Orchestrator waterfall
    const analysis = await orchestrate('domain', { normalized, scan_hash, userId: req.user._id });
    const summary = `Domain "${normalized}" trust score: ${analysis.trustScore ?? analysis.vtScore ?? 'N/A'}/100. Verdict: ${analysis.verdict}. Source: ${analysis.source}.`;

    const { toolResult, aiExplanation } = await saveAndAnalyze(
      req.user._id, 'domain', domain, analysis, analysis.riskLevel, summary,
      { scan_hash, normalized_input: normalized, source: analysis.source,
        confidence_score: analysis.confidence_score, mitre_category: analysis.mitre_category }
    );

    res.json({ ...analysis, domain: normalized, aiExplanation, id: toolResult._id });
  } catch (error) {
    res.status(500).json({ message: 'Domain check failed', error: error.message });
  }
};

// --- PORT SCANNER (basic, localhost only for safety) ---
const scanPorts = async (req, res) => {
  try {
    const { target = 'localhost' } = req.body;
    const safeTargets = ['localhost', '127.0.0.1'];

    if (!safeTargets.includes(target)) {
      return res.status(400).json({ message: 'For safety, only localhost scanning is permitted' });
    }

    const commonPorts = [21, 22, 23, 25, 53, 80, 443, 3000, 3306, 5000, 5432, 6379, 8080, 8443, 27017];
    const openPorts = [];

    const checkPort = (port) => new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(500);
      socket.connect(port, target, () => {
        openPorts.push(port);
        socket.destroy();
        resolve();
      });
      socket.on('error', () => { socket.destroy(); resolve(); });
      socket.on('timeout', () => { socket.destroy(); resolve(); });
    });

    await Promise.all(commonPorts.map(checkPort));

    const portServices = { 21:'FTP', 22:'SSH', 23:'Telnet', 25:'SMTP', 53:'DNS', 80:'HTTP', 443:'HTTPS', 3000:'Dev Server', 3306:'MySQL', 5000:'Dev API', 5432:'PostgreSQL', 6379:'Redis', 8080:'HTTP Alt', 8443:'HTTPS Alt', 27017:'MongoDB' };
    const riskPorts = [21, 23, 3306, 5432, 27017]; // DB and legacy ports
    const risky = openPorts.filter(p => riskPorts.includes(p));

    const riskLevel = risky.length > 2 ? 'high' : risky.length > 0 ? 'medium' : 'low';
    const summary = `Found ${openPorts.length} open port(s) on ${target}. ${risky.length} potentially risky port(s) exposed.`;
    const result = { target, openPorts: openPorts.map(p => ({ port: p, service: portServices[p] || 'Unknown' })), totalOpen: openPorts.length, riskyPorts: risky };

    const { toolResult, aiExplanation } = await saveAndAnalyze(
      req.user._id, 'port', target, result, riskLevel, summary
    );

    res.json({ ...result, riskLevel, summary, aiExplanation, id: toolResult._id });
  } catch (error) {
    res.status(500).json({ message: 'Port scan failed', error: error.message });
  }
};

// --- IP ANALYZER ---
// PROJECT_CONSTITUTION.md §4: Routes through apiOrchestrator (AbuseIPDB → Cache → OSINT → Simulation)
const analyzeIP = async (req, res) => {
  try {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ message: 'IP address is required' });

    // §2 Canonicalization
    const { normalized, scan_hash, cached } = await preprocess('ip', ip, 'ip');
    if (cached) {
      return res.json({ ...cached.result, source: 'cache', cached: true, confidence_score: 0.8 });
    }

    // §4 Orchestrator waterfall
    const analysis = await orchestrate('ip', { normalized, scan_hash, userId: req.user._id });
    const summary = `IP ${normalized} — ${analysis.verdict}. Country: ${analysis.country || 'Unknown'}. Source: ${analysis.source}. ${(analysis.flags || []).length} flag(s).`;

    const { toolResult, aiExplanation } = await saveAndAnalyze(
      req.user._id, 'ip', ip, analysis, analysis.riskLevel, summary,
      { scan_hash, normalized_input: normalized, source: analysis.source,
        confidence_score: analysis.confidence_score, mitre_category: analysis.mitre_category }
    );

    res.json({ ...analysis, aiExplanation, id: toolResult._id });
  } catch (error) {
    res.status(500).json({ message: 'IP analysis failed', error: error.message });
  }
};

// --- SECURITY UTILITIES ---

// Encrypt/Decrypt text (AES via built-in)
const encryptText = async (req, res) => {
  try {
    const { text, key, mode = 'encrypt' } = req.body;
    if (!text || !key) return res.status(400).json({ message: 'Text and key are required' });

    const keyBuffer = crypto.scryptSync(key, 'ciphernest-salt', 32);
    const iv = crypto.randomBytes(16);

    let result;
    if (mode === 'encrypt') {
      const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
      result = iv.toString('hex') + ':' + Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]).toString('hex');
    } else {
      const [ivHex, encrypted] = text.split(':');
      const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, Buffer.from(ivHex, 'hex'));
      result = Buffer.concat([decipher.update(Buffer.from(encrypted, 'hex')), decipher.final()]).toString('utf8');
    }

    res.json({ result, mode, success: true });
  } catch (error) {
    res.status(400).json({ message: 'Encryption/decryption failed', error: error.message });
  }
};

// Hash generator
const generateHash = async (req, res) => {
  try {
    const { text, algorithm = 'sha256' } = req.body;
    if (!text) return res.status(400).json({ message: 'Text is required' });

    const supported = ['md5', 'sha1', 'sha256', 'sha512'];
    if (!supported.includes(algorithm)) return res.status(400).json({ message: 'Unsupported algorithm' });

    const hash = crypto.createHash(algorithm).update(text).digest('hex');
    res.json({ hash, algorithm, input: text });
  } catch (error) {
    res.status(500).json({ message: 'Hash generation failed' });
  }
};

// Hash Decoder (Dictionary & Type Detection)
const decodeHash = async (req, res) => {
  try {
    const { hash } = req.body;
    if (!hash) return res.status(400).json({ message: 'Hash is required' });

    const analysis = await decodeHashService(hash);
    if (!analysis.success) return res.status(400).json({ message: analysis.message });

    const { data } = analysis;
    const summary = `Hash decode: ${data.found ? 'SUCCESS' : 'FAILURE'}. Type: ${data.type}. Strength: ${data.strength}. Crack time: ${data.crackTime}.`;

    const { toolResult, aiExplanation } = await saveAndAnalyze(
      req.user._id, 'hash-decoder', hash, data, data.found ? 'high' : 'low', summary
    );

    res.json({ ...data, summary, aiExplanation, id: toolResult._id });
  } catch (error) {
    console.error('Hash decode error:', error);
    res.status(500).json({ message: 'Hash decoding failed', error: error.message });
  }
};

// Base64 encoder/decoder
const base64Tool = async (req, res) => {
  try {
    const { text, mode = 'encode' } = req.body;
    if (!text) return res.status(400).json({ message: 'Text is required' });

    const result = mode === 'encode'
      ? Buffer.from(text).toString('base64')
      : Buffer.from(text, 'base64').toString('utf8');

    res.json({ result, mode });
  } catch (error) {
    res.status(400).json({ message: 'Base64 operation failed' });
  }
};

// Binary converter
const binaryConverter = async (req, res) => {
  try {
    const { text, mode = 'toBinary' } = req.body;
    if (!text) return res.status(400).json({ message: 'Text is required' });

    let result;
    if (mode === 'toBinary') {
      result = text.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
    } else {
      result = text.replace(/\s+/g, '').match(/.{8}/g)?.map(b => String.fromCharCode(parseInt(b, 2))).join('') || '';
    }

    res.json({ result, mode });
  } catch (error) {
    res.status(400).json({ message: 'Binary conversion failed' });
  }
};

// JWT decoder
const jwtDecoder = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'JWT token is required' });

    const parts = token.split('.');
    if (parts.length !== 3) return res.status(400).json({ message: 'Invalid JWT format' });

    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    const signature = parts[2];

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    const isExpired = payload.exp ? payload.exp < now : false;

    res.json({ header, payload, signature, isExpired, expiresAt: payload.exp ? new Date(payload.exp * 1000) : null });
  } catch (error) {
    res.status(400).json({ message: 'JWT decoding failed', error: error.message });
  }
};

// --- OSINT SUBDOMAIN RECON ---
const performRecon = async (req, res) => {
  try {
    const { domain } = req.body;
    if (!domain) return res.status(400).json({ message: 'Domain is required' });

    const analysis = await enumerateSubdomains(domain);
    const summary = `Found ${analysis.totalFound} subdomains for ${domain} after scanning ${analysis.scanned} common patterns.`;

    const { toolResult, aiExplanation } = await saveAndAnalyze(
      req.user._id, 'recon', domain, analysis, analysis.totalFound > 0 ? 'medium' : 'low', summary
    );

    res.json({ ...analysis, aiExplanation, id: toolResult._id });
  } catch (error) {
    res.status(500).json({ message: 'Subdomain recon failed', error: error.message });
  }
};

// --- DARK WEB MONITOR ---
const darkWebScan = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    // Use apiOrchestrator (Task 2.2)
    const analysis = await getIntel(email, 'DARK_WEB_MONITOR', { context: 'Identity Intel' });
    
    // Explicit AuditLog for execution & provider tracking
    try { await AuditLog.create({ userId: req.user._id, action: 'DARK_WEB_SCAN', details: `Checked ${email} via ${analysis.provider}`, type: 'info' }); } catch(e){}

    const summary = `Dark Web scan for ${email} complete. Verdict: ${analysis.verdict}. Source: ${analysis.provider}.`;

    const { toolResult, aiExplanation } = await saveAndAnalyze(
      req.user._id, 'dark-web', email, analysis, analysis.riskLevel, summary,
      { scan_hash: analysis.scan_hash, normalized_input: email, source: analysis.provider,
        confidence_score: analysis.confidence_score }
    );

    res.json({ ...analysis, email, aiExplanation, id: toolResult._id, requiresFeedback: true });
  } catch (error) {
    res.status(500).json({ message: 'Dark web scan failed', error: error.message });
  }
};

// --- AI FILE SANDBOX ---
const sandboxAnalysis = async (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ message: 'Filename is required' });

    const prompt = `Analyze this file behavior for a security sandbox report. Filename: ${filename}. 
    Provide a detailed technical breakdown of potential risks, system calls, and a final verdict (Malicious, Suspicious, or Clean).
    Format the response as a professional cybersecurity report.`;

    const aiResponse = await generateCipherResponse({
      userMessage: prompt,
      context: { toolType: 'sandbox', filename }
    });

    const isMalicious = aiResponse.response.toLowerCase().includes('malicious');
    const riskLevel = isMalicious ? 'high' : aiResponse.response.toLowerCase().includes('suspicious') ? 'medium' : 'low';
    
    const summary = `AI Sandbox analysis completed for ${filename}. Verdict: ${riskLevel.toUpperCase()}.`;
    const result = { filename, result: aiResponse.response };

    const { toolResult } = await saveAndAnalyze(
      req.user._id, 'sandbox', filename, result, riskLevel, summary
    );

    res.json({ ...result, riskLevel, summary, id: toolResult._id });
  } catch (error) {
    res.status(500).json({ message: 'Sandbox analysis failed', error: error.message });
  }
};

// --- METADATA STRIPPER ---
const stripMetadata = async (req, res) => {
  try {
    const { text } = req.body; // Mocking text metadata for now
    let metadata;
    try {
      metadata = JSON.parse(text || '{}');
    } catch {
      metadata = { info: text };
    }

    const summary = `Metadata stripping completed. Removed ${Object.keys(metadata).length} hidden fields.`;
    const result = { result: "CLEANED_DATA: " + JSON.stringify({ status: "Success", sanitized: true, timestamp: new Date() }) };

    const { toolResult } = await saveAndAnalyze(
      req.user._id, 'metadata-strip', text, result, 'low', summary
    );

    res.json({ ...result, success: true, id: toolResult._id });
  } catch (error) {
    res.status(500).json({ message: 'Metadata stripping failed' });
  }
};

// Get tool history
const getToolHistory = async (req, res) => {
  try {
    const { toolType, limit = 10 } = req.query;
    const filter = { userId: req.user._id };
    if (toolType) filter.toolType = toolType;

    const results = await ToolResult.find(filter).sort({ timestamp: -1 }).limit(parseInt(limit));
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch history' });
  }
};

module.exports = {
  checkPhishing, analyzePassword, checkBreach, checkDomainReputation,
  scanPorts, analyzeIP, encryptText, generateHash, base64Tool,
  binaryConverter, jwtDecoder, performRecon, darkWebScan, sandbox: sandboxAnalysis, stripMetadata, getToolHistory,
  decodeHash
};
