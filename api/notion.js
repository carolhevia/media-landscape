const https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const NOTION_VERSION = '2022-06-28';
  const { method, path, body } = req.body;
  const data = body ? JSON.stringify(body) : null;

  const options = {
    hostname: 'api.notion.com',
    path: `/v1/${path}`,
    method: method || 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...(data && { 'Content-Length': Buffer.byteLength(data) })
    }
  };

  return new Promise((resolve) => {
    const request = https.request(options, (response) => {
      let body = '';
      response.on('data', chunk => body += chunk);
      response.on('end', () => {
        try {
          res.status(200).json(JSON.parse(body));
        } catch(e) {
          res.status(500).json({ error: 'Parse error', raw: body.slice(0, 200) });
        }
        resolve();
      });
    });
    request.on('error', (e) => {
      res.status(500).json({ error: e.message });
      resolve();
    });
    if (data) request.write(data);
    request.end();
  });
};
