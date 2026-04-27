const User = require('../models/User');
const { Alert, ActivityLog, ToolResult, Recommendation, GlobalThreat } = require('../models/index');
const Secret = require('../models/Secret');
const { generateCipherResponse } = require('../services/groqService');
const { generateIncidentReport, getComplianceAuditData } = require('../services/reportService');
const mongoose = require('mongoose');

// @desc Generate comprehensive security report
const generateReport = async (req, res) => {
  try {
    const userId = req.user._id;

    const [user, alerts, tools, activity, secretsCount, actions, globalThreats] = await Promise.all([
      User.findById(userId),
      Alert.find({ userId }).sort({ timestamp: -1 }).limit(100),
      ToolResult.find({ userId }).sort({ timestamp: -1 }).limit(50),
      ActivityLog.find({ userId }).sort({ timestamp: -1 }).limit(50),
      Secret.countDocuments({ userId }),
      Recommendation.find({ userId, status: 'pending' }),
      GlobalThreat.find().limit(10)
    ]);

    // Aggregate findings
    const hashFindings = tools.filter(t => t.toolType === 'hash-decoder' && t.result?.found);
    const portFindings = tools.filter(t => t.toolType === 'port' && t.result?.riskyPorts?.length > 0);
    const networkFindings = alerts.filter(a => a.source === 'Network Scanner');

    const report = {
      generatedAt: new Date(),
      user: {
        username: user.username,
        securityScore: user.securityScore,
      },
      summary: {
        activeAlerts: alerts.filter(a => !a.dismissed).length,
        criticalAlerts: alerts.filter(a => a.type === 'critical' && !a.dismissed).length,
        pendingActions: actions.length,
        toolsUsed: tools.length,
        secretsProtected: secretsCount
      },
      vulnerabilities: {
        weakCredentials: hashFindings.map(f => ({ hash: f.input, type: f.result.type, strength: f.result.strength })),
        exposedPorts: portFindings.map(f => ({ target: f.input, ports: f.result.riskyPorts })),
        networkRisks: networkFindings.map(f => ({ title: f.title, message: f.message, time: f.timestamp })),
        pendingActions: actions.map(a => ({ title: a.title, severity: a.severity }))
      },
      recommendations: [
        ...actions.map(a => a.description),
        user.securityScore < 70 ? 'Improve security score by resolving critical alerts.' : null,
      ].filter(Boolean)
    };

    // Generate AI Summary
    const prompt = `Generate a professional security summary report for user ${user.username}. 
    Security Score: ${user.securityScore}/100.
    Critical Issues: ${report.summary.criticalAlerts}.
    Findings: ${JSON.stringify(report.vulnerabilities)}.
    Keep it to 2 paragraphs of high-level overview and next steps.`;

    const aiRes = await generateCipherResponse({ userMessage: prompt });
    report.aiSummary = aiRes.response || "AI Analysis unavailable at this moment.";

    // Text format for "readable text summary" requirement
    const textSummary = `
CIPHERNEST SECURITY REPORT
==========================
Date: ${report.generatedAt.toLocaleString()}
User: ${user.username}
Security Score: ${user.securityScore}/100

SUMMARY
-------
- Active Alerts: ${report.summary.activeAlerts}
- Critical Issues: ${report.summary.criticalAlerts}
- Secrets Protected: ${report.summary.secretsProtected}

VULNERABILITIES DETECTED
------------------------
${report.vulnerabilities.weakCredentials.length > 0 ? '- Weak Credentials: ' + report.vulnerabilities.weakCredentials.length + ' found' : '- No weak credentials found'}
${report.vulnerabilities.exposedPorts.length > 0 ? '- Exposed Ports: ' + report.vulnerabilities.exposedPorts.length + ' risky ports open' : '- No risky ports exposed'}
${report.vulnerabilities.networkRisks.length > 0 ? '- Network Risks: ' + report.vulnerabilities.networkRisks.length + ' unknown devices' : '- Network is clean'}

AI ANALYSIS & RECOMMENDATIONS
-----------------------------
${report.aiSummary}

RECOMMENDED ACTIONS
-------------------
${report.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}
    `;

    res.json({ ...report, textSummary });
  } catch (error) {
    console.error('Report Error:', error);
    res.status(500).json({ message: 'Report generation failed', error: error.message });
  }
};

const generateIncidentReportHandler = async (req, res) => {
  try {
    const { toolResultId } = req.body;
    if (!toolResultId) {
      return res.status(400).json({ message: 'toolResultId is required' });
    }

    const report = await generateIncidentReport(toolResultId);

    // Audit requirement
    try {
      let AuditLog;
      try { AuditLog = mongoose.model('AuditLog'); } catch (e) { AuditLog = mongoose.model('ActivityLog'); }
      await AuditLog.create({
        userId: req.user._id,
        action: 'INCIDENT_REPORT_GENERATED',
        details: `Generated incident report for ToolResult ${toolResultId}`,
        type: 'info'
      });
    } catch (e) { console.error('AuditLog error:', e); }

    // Send as JSON file for download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=incident_report_${report.report_id}.json`);
    res.json(report);

  } catch (error) {
    res.status(500).json({ message: 'Failed to generate report', error: error.message });
  }
};

const generateComplianceAudit = async (req, res) => {
  try {
    const data = await getComplianceAuditData();
    
    // Audit requirement
    try {
      let AuditLog;
      try { AuditLog = mongoose.model('AuditLog'); } catch (e) { AuditLog = mongoose.model('ActivityLog'); }
      await AuditLog.create({
        userId: req.user._id,
        action: 'COMPLIANCE_AUDIT_EXPORTED',
        details: 'Exported 90-day AuditLog history',
        type: 'info'
      });
    } catch (e) {}

    res.setHeader('Content-Disposition', `attachment; filename=compliance_audit_${Date.now()}.json`);
    res.json({ timeframe: '90d', records_count: data.length, data });
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate audit', error: error.message });
  }
};

module.exports = { generateReport, generateIncidentReportHandler, generateComplianceAudit };
