const { ChatHistory } = require('../models/index');
const { generateCipherResponse, checkGroqHealth } = require('../services/groqService');

// Send message to Cipher (Streaming)
const sendMessage = async (req, res) => {
  try {
    const { message, toolContext } = req.body;
    if (!message?.trim()) return res.status(400).json({ message: 'Message is required' });

    const userId = req.user._id;

    // Save user message
    await ChatHistory.create({ userId, role: 'user', content: message, context: toolContext });

    // Fetch recent history for context
    const history = await ChatHistory.find({ userId }).sort({ timestamp: -1 }).limit(10);
    const reversedHistory = history.reverse().map(h => ({ role: h.role, content: h.content }));

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Generate AI response stream
    const stream = await generateCipherResponse({
      userMessage: message,
      toolResult: toolContext?.result,
      riskLevel: toolContext?.riskLevel,
      context: toolContext,
      history: reversedHistory,
      stream: true
    });

    let fullResponse = '';
    let buffer = '';
    let saved = false;

    const finalizeChat = async () => {
      if (saved) return;
      saved = true;
      try {
        const assistantMsg = await ChatHistory.create({
          userId,
          role: 'assistant',
          content: fullResponse,
          context: toolContext
        });
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ done: true, id: assistantMsg._id })}\n\n`);
          res.end();
        }
      } catch (err) {
        console.error('Failed to save message:', err);
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          res.end();
        }
      }
    };

    stream.data.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const payload = JSON.parse(line);
          const content = payload.response || '';
          
          if (content) {
            fullResponse += content;
            if (!res.writableEnded) {
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
          }

          if (payload.done) {
            finalizeChat();
          }
        } catch (err) {
          console.error('JSON parse error in stream:', err.message, 'Line:', line);
        }
      }
    });

    stream.data.on('end', () => {
      // If the stream ended but we haven't saved (e.g. 'done' flag missing but stream closed)
      if (!saved) finalizeChat();
    });

    stream.data.on('error', (err) => {
      console.error('Stream error:', err);
      res.write(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`);
      res.end();
    });

  } catch (error) {
    console.error('Chat failed:', error);
    res.status(500).json({ message: 'Chat failed', error: error.message });
  }
};

// Get chat history
const getChatHistory = async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const history = await ChatHistory.find({ userId: req.user._id })
      .sort({ timestamp: 1 })
      .limit(parseInt(limit));

    res.json(history);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch chat history' });
  }
};

// Clear chat history
const clearChatHistory = async (req, res) => {
  try {
    await ChatHistory.deleteMany({ userId: req.user._id });
    res.json({ message: 'Chat history cleared' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to clear chat history' });
  }
};

// Groq health check
const checkAIStatus = async (req, res) => {
  const isOnline = await checkGroqHealth();
  res.json({ online: isOnline, provider: 'Groq', model: process.env.GROQ_MODEL || 'llama3-8b-8192' });
};

module.exports = { sendMessage, getChatHistory, clearChatHistory, checkAIStatus };
