const { ToolResult, RiskTrend } = require('../models/index');

const getThreatHeatmap = async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // MongoDB Aggregation Pipeline
  const pipeline = [
    {
      $match: {
        timestamp: { $gte: thirtyDaysAgo },
        source: { $ne: 'simulation' }, // Explicitly filter out simulations
        riskLevel: { $in: ['medium', 'high'] }
      }
    },
    {
      $facet: {
        threatDistribution: [
          { $group: { _id: '$mitre_category', count: { $sum: 1 }, avgConfidence: { $avg: '$confidence_score' } } },
          { $sort: { count: -1 } },
          { $project: { mitre_category: { $ifNull: ['$_id', 'Uncategorized'] }, count: 1, avgConfidence: 1, _id: 0 } }
        ],
        topThreatVectors: [
          { $group: { _id: '$toolType', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 },
          { $project: { toolType: '$_id', count: 1, _id: 0 } }
        ]
      }
    }
  ];

  const result = await ToolResult.aggregate(pipeline);

  // Cross-reference daily security score averages
  const scoreTrends = await RiskTrend.aggregate([
    { $match: { timestamp: { $gte: thirtyDaysAgo } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } }, avgScore: { $avg: "$score" } } },
    { $sort: { _id: 1 } }
  ]);

  return {
    timeframe: '30d',
    threatDistribution: result[0].threatDistribution,
    topThreatVectors: result[0].topThreatVectors,
    securityScoreTrend: scoreTrends
  };
};

module.exports = { getThreatHeatmap };
