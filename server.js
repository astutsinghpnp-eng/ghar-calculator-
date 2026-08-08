// Minimal local dev server (no dependencies) that mimics Vercel's routing:
// serves public/ statically and routes POST /api/estimate to the handler.
const http = require('http');
const fs = require('fs');
const path = require('path');
const estimateHandler = require('./api/estimate.js');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

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
  if (req.url === '/api/estimate') {
    let body = '';
    req.on('data', function (chunk) { body += chunk; });
    req.on('end', function () {
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
      estimateHandler(req, fakeRes);
    });
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, function () {
  console.log('Ghar Calculator running at http://localhost:' + PORT);
});
