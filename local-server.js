#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 18082);
const ROOT_DIR = process.cwd();
const FEISHU_ROOT = 'https://open.feishu.cn/open-apis/';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function send(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function handleFeishuProxy(req, res, parsedUrl) {
  const pathName = parsedUrl.pathname.replace(/^\/api\/feishu\/?/, '');
  if (!pathName) {
    send(res, 400, JSON.stringify({ code: 400, msg: 'missing feishu api path' }), {
      'Content-Type': 'application/json; charset=utf-8'
    });
    return;
  }

  const targetUrl = `${FEISHU_ROOT}${pathName}${parsedUrl.search || ''}`;

  const headers = {
    'Content-Type': req.headers['content-type'] || 'application/json'
  };

  if (req.headers['authorization']) {
    headers.Authorization = req.headers['authorization'];
  }

  const method = req.method || 'GET';
  const bodyBuffer = await readBody(req);

  const requestInit = {
    method,
    headers
  };

  if (bodyBuffer.length > 0 && method !== 'GET' && method !== 'HEAD') {
    requestInit.body = bodyBuffer;
  }

  try {
    const upstreamRes = await fetch(targetUrl, requestInit);
    const upstreamText = await upstreamRes.text();

    send(res, upstreamRes.status, upstreamText, {
      'Content-Type': upstreamRes.headers.get('content-type') || 'application/json; charset=utf-8'
    });
  } catch (error) {
    send(res, 502, JSON.stringify({ code: 502, msg: `proxy_error: ${error.message}` }), {
      'Content-Type': 'application/json; charset=utf-8'
    });
  }
}

function safeResolvePath(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const cleanPath = decoded === '/' ? '/index.html' : decoded;
  const resolvedPath = path.resolve(ROOT_DIR, `.${cleanPath}`);
  if (!resolvedPath.startsWith(ROOT_DIR)) {
    return null;
  }
  return resolvedPath;
}

function handleStatic(req, res, parsedUrl) {
  let filePath = safeResolvePath(parsedUrl.pathname);
  if (!filePath) {
    send(res, 403, 'Forbidden');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    send(res, 404, 'Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
  const content = fs.readFileSync(filePath);

  send(res, 200, content, {
    'Content-Type': mimeType
  });
}

const server = http.createServer(async (req, res) => {
  const host = req.headers.host || `127.0.0.1:${PORT}`;
  const parsedUrl = new URL(req.url || '/', `http://${host}`);

  if (parsedUrl.pathname.startsWith('/api/feishu/')) {
    await handleFeishuProxy(req, res, parsedUrl);
    return;
  }

  handleStatic(req, res, parsedUrl);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`ClassPet local server running at http://127.0.0.1:${PORT}`);
  console.log('Feishu proxy path: /api/feishu/* -> https://open.feishu.cn/open-apis/*');
});
