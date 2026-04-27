const https = require('https');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama3-8b-8192';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Build system + user messages for Cipher
 */
const buildMessages = ({ userMessage, toolResult, riskLevel, context, history = [] }) => {
  const systemContent = `You are Cipher, a world-class cybersecurity AI assistant.
Your job is to explain security threats in simple language but always answer the "So What?" for the user.
You MUST reply with a strict JSON object exactly matching this schema:
{
  "threat_assessment": "Short summary explaining the real-world impact",
  "mitre_code": "Relevant MITRE ATT&CK code, e.g., T1059",
  "confidence_score": 0.9,
  "remediation": ["Actionable step 1", "Actionable step 2"],
  "evidence_citations": ["source_name"]
}
Return ONLY raw JSON. Do not wrap in markdown code blocks.
${
    toolResult
      ? `\n\nTool Result Context:
- Tool used: ${context?.toolType || 'security scan'}
- Risk Level: ${riskLevel || 'unknown'}
- Result: ${context?.summary || JSON.stringify(toolResult)}`
      : ''
  }`;

  const messages = [{ role: 'system', content: systemContent }];

  // Add conversation history (last 6 turns)
  history.slice(-6).forEach(msg => {
    messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
  });

  messages.push({ role: 'user', content: userMessage });

  return messages;
};

/**
 * Make a raw HTTPS request to Groq (avoids needing axios)
 */
const groqRequest = (payload, stream = false) => {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      if (stream) {
        resolve(res); // raw Node.js IncomingMessage (readable)
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message || 'Groq API error'));
          resolve(parsed);
        } catch (e) {
          reject(new Error('Failed to parse Groq response'));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Request timed out')); });
    req.write(body);
    req.end();
  });
};

/**
 * Fallback responses when Groq is unavailable
 */
const getFallbackJson = (riskLevel) => {
  const fallbacks = {
    high: '⚠️ High Risk Detected! I\'m having trouble connecting to my AI service right now. Please: 1) Do not interact with the flagged resource, 2) Change any related passwords.',
    medium: '⚡ Moderate risk found. I\'m temporarily offline, but you should review this result carefully.',
    low: '✅ Low risk detected. I\'m temporarily offline but this result doesn\'t require urgent action.'
  };
  return {
    threat_assessment: fallbacks[riskLevel] || fallbacks.low,
    mitre_code: "N/A",
    confidence_score: 0.0,
    remediation: ["Review manually", "Check AI service connectivity"],
    evidence_citations: ["System Fallback"]
  };
};

/**
 * Generate a response from Groq (supports streaming)
 */
const generateCipherResponse = async ({ userMessage, toolResult, riskLevel, context, history = [], stream = false }) => {
  if (!GROQ_API_KEY) {
    const fallbackObj = getFallbackJson(riskLevel);
    if (stream) {
      const { Readable } = require('stream');
      const s = new Readable({ read() {} });
      setTimeout(() => {
        s.push(`data: ${JSON.stringify({ choices: [{ delta: { content: JSON.stringify(fallbackObj) }, finish_reason: 'stop' }] })}\n\n`);
        s.push('data: [DONE]\n\n');
        s.push(null);
      }, 100);
      return { data: convertGroqStreamToOllamaFormat(s) };
    }
    return { success: false, response: fallbackObj, error: 'GROQ_API_KEY not set' };
  }

  const messages = buildMessages({ userMessage, toolResult, riskLevel, context, history });

  const payload = {
    model: GROQ_MODEL,
    messages,
    temperature: 0.2,
    max_tokens: 512,
    stream,
    response_format: { type: "json_object" }
  };

  try {
    if (stream) {
      const rawStream = await groqRequest(payload, true);
      // Wrap the SSE stream from Groq into a format compatible with existing chatController
      return { data: convertGroqStreamToOllamaFormat(rawStream) };
    }

    const result = await groqRequest(payload, false);
    let content = result.choices?.[0]?.message?.content?.trim() || '{}';
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(content);
    } catch (e) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { parsedResponse = JSON.parse(jsonMatch[0]); }
        catch (err) { parsedResponse = getFallbackJson(riskLevel); }
      } else {
        parsedResponse = getFallbackJson(riskLevel);
      }
    }
    return { success: true, response: parsedResponse };

  } catch (error) {
    console.error('Groq error:', error.message);
    const fallbackObj = getFallbackJson(riskLevel);

    if (stream) {
      const { Readable } = require('stream');
      const s = new Readable({ read() {} });
      setTimeout(() => {
        // Emit in Ollama-like format so chatController can parse it
        s.push(JSON.stringify({ response: JSON.stringify(fallbackObj), done: true }) + '\n');
        s.push(null);
      }, 100);
      return { data: s };
    }

    return { success: false, response: fallbackObj, error: error.message };
  }
};

/**
 * Convert Groq's SSE stream (OpenAI format) to Ollama JSON-line format
 * so the existing chatController doesn't need changes in stream parsing logic.
 */
const convertGroqStreamToOllamaFormat = (groqStream) => {
  const { Transform } = require('stream');
  let buffer = '';

  const transformer = new Transform({
    transform(chunk, _enc, callback) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const jsonStr = trimmed.slice(6);
        if (jsonStr === '[DONE]') {
          this.push(JSON.stringify({ response: '', done: true }) + '\n');
          continue;
        }
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content || '';
          const done = parsed.choices?.[0]?.finish_reason === 'stop';
          this.push(JSON.stringify({ response: content, done }) + '\n');
        } catch (_) {
          // skip malformed lines
        }
      }
      callback();
    },
    flush(callback) {
      if (buffer.trim()) {
        // push any trailing data
        this.push(JSON.stringify({ response: '', done: true }) + '\n');
      }
      callback();
    }
  });

  groqStream.pipe(transformer);
  return transformer;
};

/**
 * Check if Groq is configured (key present and valid format)
 */
const checkGroqHealth = async () => {
  return !!(GROQ_API_KEY && GROQ_API_KEY.startsWith('gsk_') && GROQ_API_KEY.length > 20);
};

module.exports = { generateCipherResponse, checkGroqHealth };
