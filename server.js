const express = require('express');
const http = require('http');
const crypto = require('crypto');
const path = require('path');

const app = express();

const QUOTES_TARGET = process.env.QUOTES_URL || 'http://localhost:8000';
const EQUIPMENT_TARGET = process.env.EQUIPMENT_URL || 'http://localhost:3000';
const AUTH_SECRET = process.env.AUTH_JWT_SECRET || 'equipments-dev-secret';
const AUTH_ISSUER = process.env.AUTH_JWT_ISSUER || 'platform-auth';
const AUTH_AUDIENCE = process.env.AUTH_JWT_AUDIENCE || 'equipments-service';
const PORT = parseInt(process.env.PORT || '4000', 10);

function generateEquipmentToken(subject, scopes, expiresInMinutes) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    sub: subject,
    iss: AUTH_ISSUER,
    aud: AUTH_AUDIENCE,
    exp: now + expiresInMinutes * 60,
    scope: scopes.join(' '),
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

app.post('/api/auth/token', express.json(), (req, res) => {
  const subject = (req.body?.subject || '').trim() || 'frontend-user';
  const scopes = Array.isArray(req.body?.scopes) ? req.body.scopes : ['equipments:read', 'equipments:modify'];
  const expiresInMinutes = Math.min(Math.max(Number(req.body?.expiresInMinutes) || 60, 1), 1440);
  const token = generateEquipmentToken(subject, scopes, expiresInMinutes);
  res.json({ token, issuer: AUTH_ISSUER, audience: AUTH_AUDIENCE, subject, scopes, expiresInMinutes });
});

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

function parseTarget(url) {
  const parsed = new URL(url);
  return { hostname: parsed.hostname, port: parseInt(parsed.port, 10) };
}

const QUOTES = parseTarget(QUOTES_TARGET);
const EQUIPMENT = parseTarget(EQUIPMENT_TARGET);

const TARGET_ROUTES = [
  { prefix: '/quotes', target: QUOTES, rewrite: (suffix) => '/quotes' + suffix },
  { prefix: '/equipment', target: EQUIPMENT, rewrite: (suffix) => suffix || '/' },
];

app.use('/api', (req, res) => {
  const route = TARGET_ROUTES.find((r) => req.path.startsWith(r.prefix));
  if (!route) {
    console.error('No route for:', req.method, req.path, req.url);
    return res.status(404).json({ error: 'Unknown API route' });
  }

  const pathSuffix = req.path.slice(route.prefix.length) || '';
  const targetPath = route.rewrite(pathSuffix);
  const target = route.target;

  const options = {
    hostname: target.hostname,
    port: target.port,
    path: targetPath + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''),
    method: req.method,
    headers: { ...req.headers },
  };
  delete options.headers['host'];

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err.message);
    res.status(502).json({ error: 'Upstream service unavailable' });
  });
  req.pipe(proxyReq);
});

app.use(express.static(path.join(__dirname)));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Gateway running on http://localhost:${PORT}`);
  console.log(`  /api/quotes   -> ${QUOTES_TARGET}/quotes`);
  console.log(`  /api/equipment -> ${EQUIPMENT_TARGET}`);
  console.log(`  /api/auth/token -> local JWT generator`);
});
