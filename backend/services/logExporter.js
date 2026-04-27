const shipError = (errorData) => {
  const payload = {
    timestamp: new Date().toISOString(),
    level: errorData.level || 'CRITICAL',
    context: errorData.context || 'Unknown',
    message: errorData.error || errorData.message || 'No error message provided',
    stack: errorData.stack
  };

  // Currently configured to log locally with explicit tag for log aggregators to pick up.
  console.error(`[LOG_EXPORT] === CRITICAL INFRASTRUCTURE ERROR ===\n${JSON.stringify(payload, null, 2)}`);
  
  // Future: axios.post('https://splunk-or-datadog-endpoint', payload)
};

module.exports = { shipError };
