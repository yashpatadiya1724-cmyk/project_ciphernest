const mongoose = require('mongoose');

const analystFeedbackSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toolResultId: { type: mongoose.Schema.Types.ObjectId, ref: 'ToolResult', required: true },
  toolType: { type: String, required: true },
  input: { type: String },
  normalized_input: { type: String },
  scan_hash: { type: String },
  reportedStatus: { type: String, enum: ['Safe', 'Dangerous'], required: true },
  analystReasoning: { type: String },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AnalystFeedback', analystFeedbackSchema);
