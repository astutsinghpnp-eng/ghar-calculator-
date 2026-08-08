// Minimal local dev server (no dependencies) that mimics Vercel's routing:
// serves public/ statically and routes POST /api/* to the matching handler.
const http = require('http');
const fs = require('fs');
const path = require('path');

// Tiny dependency-free .env loader (local dev only — on Vercel, set the same
// variable names in the project's Environment Variables dashboard instead).
// Doesn't overwrite a variable already set in the real environment.
(function loadDotEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(function (line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !(key in process.env)) process.env[key] = value;
  });
})();

const estimateHandler = require('./api/estimate.js');
const leadHandler = require('./api/lead.js');
const extractDimensionsHandler = require('./api/extract-dimensions.js');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY_BYTES = 15 * 1024 * 1024; // 15MB — generous for a base64 image/PDF, still a real cap
const API_ROUTES = {
  '/api/estimate': estimateHandler,
  '/api/lead': leadHandler,
  '/api/extract-dimensions': extractDimensionsHandler
};

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json'
};

function serveStatic(req, res) {
  let urlPath = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(PUBLIC_DIR, decodeURIComponent(urlPath.split('?')[0]));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, function (err, data) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(function (req, res) {
  const handler = API_ROUTES[req.url];
  if (handler) {
    let body = '';
    let bytes = 0;
    let tooLarge = false;
    req.on('data', function (chunk) {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        tooLarge = true;
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', function () {
      if (tooLarge) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File too large.' }));
        return;
      }
      let parsed = {};
      try { parsed = body ? JSON.parse(body) : {}; } catch (e) { /* leave empty, handler validates */ }
      req.body = parsed;
      const fakeRes = {
        status: function (code) { res.statusCode = code; return this; },
        json: function (obj) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(obj));
        }
      };
      handler(req, fakeRes);
    });
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, function () {
  console.log('Ghar Calculator running at http://localhost:' + PORT);
});
