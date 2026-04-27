const { ToolResult } = require('../models/index');
const AnalystFeedback = require('../models/AnalystFeedback');
const mongoose = require('mongoose');

let AuditLog;
try { AuditLog = mongoose.model('AuditLog'); } catch (e) { AuditLog = mongoose.model('ActivityLog'); }

const generateIncidentReport = async (toolResultId) => {
  const toolResult = await ToolResult.findById(toolResultId).populate('userId', 'username email');
  if (!toolResult) throw new Error('ToolResult not found');

  // Fetch associated AnalystFeedback (Human-in-the-loop)
  const feedbacks = await AnalystFeedback.find({ toolResultId }).sort({ timestamp: -1 });

  // Fetch Audit Trail roughly associated with this scan
  const auditLogs = await AuditLog.find({
    userId: toolResult.userId._id,
    action: { $regex: new RegExp(toolResult.toolType, 'i') },
    timestamp: { 
      $gte: new Date(toolResult.timestamp.getTime() - 60000), 
      $lte: new Date(toolResult.timestamp.getTime() + 86400000) 
    }
  }).sort({ timestamp: 1 });

  // Construct structured JSON report
  const report = {
    report_id: `INC-${toolResultId}-${Date.now().toString().slice(-6)}`,
    incident_timestamp: toolResult.timestamp,
    generated_at: new Date(),
    target_user: toolResult.userId.username,
    vulnerability_details: {
      tool_type: toolResult.toolType,
      target_input: toolResult.input,
      risk_level: toolResult.riskLevel,
      confidence_score: toolResult.confidence_score,
      mitre_code: toolResult.mitre_category || 'N/A',
      summary: toolResult.summary,
      raw_result: toolResult.result
    },
    ai_remediation_plan: toolResult.result?.remediation || ["No automated remediation available."],
    analyst_audit_trail: {
      feedbacks: feedbacks.map(f => ({
        status_reported: f.reportedStatus,
        reasoning: f.analystReasoning,
        timestamp: f.timestamp
      })),
      system_logs: auditLogs.map(a => ({
        action: a.action,
        details: a.details,
        timestamp: a.timestamp
      }))
    }
  };

  return report;
};

const getComplianceAuditData = async () => {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  
  // Lean query for large scale log aggregation
  const logs = await AuditLog.find({ timestamp: { $gte: ninetyDaysAgo } })
    .select('userId action details type timestamp')
    .populate('userId', 'username role')
    .sort({ timestamp: -1 })
    .lean();

  return logs.map(log => ({
    Timestamp: log.timestamp,
    User: log.userId ? log.userId.username : 'System',
    Role: log.userId ? log.userId.role : 'N/A',
    Action: log.action,
    Details: log.details,
    Severity: log.type || 'info'
  }));
};

module.exports = { generateIncidentReport, getComplianceAuditData };
