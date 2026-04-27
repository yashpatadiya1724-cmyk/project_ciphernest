const https = require('https');
const fs = require('fs');

// Read .env manually
const env = fs.readFileSync('backend/.env', 'utf8');
const GROQ_API_KEY = env.match(/GROQ_API_KEY=(.*)/)?.[1]?.trim();
const GROQ_MODEL = env.match(/GROQ_MODEL=(.*)/)?.[1]?.trim() || 'llama3-8b-8192';

console.log('Using Key:', GROQ_API_KEY ? GROQ_API_KEY.substring(0, 10) + '...' : 'MISSING');
console.log('Using Model:', GROQ_MODEL);

const payload = {
  model: GROQ_MODEL,
  messages: [{ role: 'user', content: 'Say hello' }],
  stream: false
};

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
  console.log('Status Code:', res.statusCode);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Response:', data);
  });
});

req.on('error', (e) => console.error('Error:', e));
req.write(body);
req.end();
