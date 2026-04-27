const axios = require('axios');
const { ToolResult, ActivityLog } = require('../models/index');
const { updateSecurityScore, createAlertFromTool } = require('../services/riskEngine');
const { generateCipherResponse } = require('../services/groqService');

/**
 * @desc Scan a website URL for common vulnerabilities/misconfigurations
 */
const scanWebsite = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ message: 'URL is required' });

    let targetUrl = url;
    if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;

    const startTime = Date.now();
    const response = await axios.get(targetUrl, { 
      timeout: 10000, 
      validateStatus: false,
      maxRedirects: 5,
      headers: { 'User-Agent': 'CipherNest-Security-Scanner/1.0' }
    });

    const headers = response.headers;
    const checks = [
      {
        name: 'Content-Security-Policy (CSP)',
        status: headers['content-security-policy'] ? 'Good' : 'Missing',
        impact: headers['content-security-policy'] ? 'low' : 'high',
        desc: 'Prevents XSS and other injection attacks by limiting resource sources.'
      },
      {
        name: 'Strict-Transport-Security (HSTS)',
        status: headers['strict-transport-security'] ? 'Good' : 'Missing',
        impact: headers['strict-transport-security'] ? 'low' : 'medium',
        desc: 'Enforces secure HTTPS connections and prevents SSL stripping.'
      },
      {
        name: 'X-Frame-Options',
        status: headers['x-frame-options'] ? 'Good' : 'Missing',
        impact: headers['x-frame-options'] ? 'low' : 'medium',
        desc: 'Protects visitors against clickjacking attacks.'
      },
      {
        name: 'Server Header Disclosure',
        status: headers['server'] ? 'Warning' : 'Good',
        impact: headers['server'] ? 'medium' : 'low',
        desc: 'Exposing server version info can help hackers find specific exploits.',
        detail: headers['server'] || 'Not disclosed'
      },
      {
        name: 'X-Powered-By Disclosure',
        status: headers['x-powered-by'] ? 'Warning' : 'Good',
        impact: headers['x-powered-by'] ? 'medium' : 'low',
        desc: 'Exposing backend technology stack (e.g. PHP/Express) simplifies profiling.',
        detail: headers['x-powered-by'] || 'Not disclosed'
      }
    ];

    // Calculate Grade
    const missingHigh = checks.filter(c => c.status !== 'Good' && c.impact === 'high').length;
    const missingMed = checks.filter(c => c.status !== 'Good' && c.impact === 'medium').length;
    
    let grade = 'A';
    if (missingHigh > 0) grade = 'D';
    else if (missingMed > 2) grade = 'C';
    else if (missingMed > 0) grade = 'B';

    if (!targetUrl.startsWith('https://')) grade = 'F';

    const riskLevel = grade === 'A' ? 'low' : (grade === 'F' || grade === 'D' ? 'high' : 'medium');
    const summary = `Scanned ${targetUrl} - Grade: ${grade}. ${missingHigh + missingMed} vulnerabilities found.`;

    const result = {
      url: targetUrl,
      grade,
      checks,
      responseTime: Date.now() - startTime,
      status: response.status,
      timestamp: new Date()
    };

    // Save to history
    const toolResult = await ToolResult.create({
      userId: req.user._id,
      toolType: 'web-scan',
      input: url,
      result,
      riskLevel
    });

    await ActivityLog.create({
      userId: req.user._id,
      action: 'Website Scan',
      details: summary,
      icon: '🔍'
    });

    // Update security score and create alerts if needed
    await updateSecurityScore(req.user._id, riskLevel, 'web-scan');
    if (riskLevel !== 'low') {
      await createAlertFromTool(req.user._id, 'web-scan', riskLevel, summary);
    }

    // Get AI explanation
    const aiResponse = await generateCipherResponse({
      userMessage: `Explain this website security scan result to me. The grade is ${grade} and the target is ${targetUrl}. Header checks: ${checks.map(c => `${c.name}: ${c.status}`).join(', ')}`,
      toolResult: result,
      riskLevel,
      context: { toolType: 'web-scan', summary }
    });

    res.json({ ...result, aiExplanation: aiResponse.response, id: toolResult._id });
  } catch (error) {
    console.error('Web scan failed:', error);
    res.status(500).json({ message: 'Web scan failed', error: error.message });
  }
};

module.exports = { scanWebsite };
