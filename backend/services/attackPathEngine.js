const { ToolResult } = require('../models/index');

// In-memory cache to prevent DB hammering
let cache = {
  data: null,
  timestamp: null,
  ttl: 5 * 60 * 1000 // 5 minutes
};

const generateAttackPath = async (userId, forceRefresh = false) => {
  // Return cached graph if valid
  if (!forceRefresh && cache.data && cache.timestamp && (Date.now() - cache.timestamp < cache.ttl)) {
    return cache.data;
  }

  // Aggregate active medium/high findings
  const results = await ToolResult.find({ 
    userId, 
    riskLevel: { $in: ['medium', 'high'] } 
  }).sort({ timestamp: -1 }).limit(50);

  const nodes = [];
  const links = [];
  
  // Generic target node representing the organization
  const mainTargetId = 'perimeter-main';
  nodes.push({ id: mainTargetId, label: 'Organization Perimeter', type: 'target_asset' });

  const nodeMap = new Set([mainTargetId]);
  const addNode = (id, label, type) => {
    if (!nodeMap.has(id)) {
      nodes.push({ id, label, type });
      nodeMap.add(id);
    }
  };

  // Correlation Logic
  results.forEach(res => {
    if (res.toolType === 'port' || res.toolType === 'network' || res.toolType === 'ip') {
      const vulnId = `vuln-${res._id}`;
      addNode(vulnId, `Exposed Asset: ${res.input || 'Unknown'}`, 'vulnerability');
      links.push({ source: vulnId, target: mainTargetId, reason: 'Network Exposure' });
    }
    else if (res.toolType === 'password' || res.toolType === 'breach' || res.toolType === 'hash-decoder') {
      const vulnId = `vuln-${res._id}`;
      const vectorId = `vec-${res._id}`;
      addNode(vulnId, `Compromised Creds: ${res.input || 'Account'}`, 'vulnerability');
      addNode(vectorId, 'Credential Stuffing', 'exploit_vector');
      
      // Link Vuln -> Vector -> Target
      links.push({ source: vulnId, target: vectorId, reason: 'Enables' });
      links.push({ source: vectorId, target: mainTargetId, reason: 'Entry Point' });
    }
    else if (res.toolType === 'phishing' || res.toolType === 'domain') {
      const vectorId = `vec-${res._id}`;
      addNode(vectorId, `Malicious Domain: ${res.input || 'URL'}`, 'exploit_vector');
      links.push({ source: vectorId, target: mainTargetId, reason: 'Social Engineering' });
    }
  });

  const graphData = { nodes, links };
  
  // Update cache
  cache.data = graphData;
  cache.timestamp = Date.now();

  return graphData;
};

module.exports = { generateAttackPath };
