const http = require('http');
const fs = require('fs');
const path = require('path');

const cartHandler = require('./api/cart');
const checkoutHandler = require('./api/checkout');
const purchaseHandler = require('./api/purchase');
const eventsHandler = require('./api/events');
const testScenariosHandler = require('./api/test-scenarios');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8'
};

function createVercelCompatibleRes(res) {
  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.json = function (obj) {
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    res.end(JSON.stringify(obj));
    return res;
  };
  return res;
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  const pathname = parsedUrl.pathname;

  // API routing
  if (pathname.startsWith('/api/')) {
    const vRes = createVercelCompatibleRes(res);
    if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT') {
      req.body = await readJsonBody(req);
    }

    if (pathname === '/api/cart') return cartHandler(req, vRes);
    if (pathname === '/api/checkout') return checkoutHandler(req, vRes);
    if (pathname === '/api/purchase') return purchaseHandler(req, vRes);
    if (pathname === '/api/events') return eventsHandler(req, vRes);
    if (pathname === '/api/test-scenarios') return testScenariosHandler(req, vRes);

    return vRes.status(404).json({ error: 'API endpoint not found' });
  }

  // Static file serving (with cleanUrls support matching vercel.json)
  let safePath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  if (safePath === '/' || safePath === '') {
    safePath = '/index.html';
  }

  let filePath = path.join(ROOT, safePath);
  if (!fs.existsSync(filePath) && !path.extname(filePath)) {
    const htmlCandidate = `${filePath}.html`;
    if (fs.existsSync(htmlCandidate)) {
      filePath = htmlCandidate;
    }
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404 Not Found</h1><p><a href="/index.html">Return to GlowLab Skincare</a></p>');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`GlowLab Skincare Automation Prototype running at http://0.0.0.0:${PORT}`);
});
