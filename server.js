const express = require('express');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const path = require('path');

const app = express();

const QUOTES_TARGET = process.env.QUOTES_URL || 'http://localhost:8000';
const EQUIPMENT_TARGET = process.env.EQUIPMENT_URL || 'http://localhost:3000';
const USERS_TARGET = process.env.USERS_URL || 'http://localhost:3001';
const BOOKING_TARGET = process.env.BOOKING_URL || 'http://localhost:8081';
const AUTH_SECRET = process.env.AUTH_JWT_SECRET || 'equipments-prod-dev-secret-change-me-2026';
const AUTH_ISSUER = process.env.AUTH_JWT_ISSUER || 'platform-auth';
const AUTH_AUDIENCE = process.env.AUTH_JWT_AUDIENCE || 'equipments-service';
const AUTH_QUOTES_AUDIENCE = process.env.AUTH_QUOTES_JWT_AUDIENCE || 'quotes-service';
const PORT = parseInt(process.env.PORT || '4000', 10);

const EQUIPMENT_DEFAULT_SCOPES = ['equipments:read', 'equipments:modify'];
const QUOTES_DEFAULT_SCOPES = ['quotes:admin', 'quotes:approve'];

function generateDevToken(subject, audience, scopes, expiresInMinutes) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    sub: subject,
    iss: AUTH_ISSUER,
    aud: audience,
    exp: now + expiresInMinutes * 60,
    scope: scopes.join(' '),
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function buildTokenResponse(body, audience, defaultScopes) {
  const subject = (body?.subject || '').trim() || 'frontend-user';
  const scopes = Array.isArray(body?.scopes) ? body.scopes : defaultScopes;
  const expiresInMinutes = Math.min(Math.max(Number(body?.expiresInMinutes) || 60, 1), 1440);
  const token = generateDevToken(subject, audience, scopes, expiresInMinutes);

  return { token, issuer: AUTH_ISSUER, audience, subject, scopes, expiresInMinutes };
}

app.post('/api/auth/token', express.json(), (req, res) => {
  res.json(buildTokenResponse(req.body, AUTH_AUDIENCE, EQUIPMENT_DEFAULT_SCOPES));
});

app.post('/api/auth/quotes-token', express.json(), (req, res) => {
  res.json(buildTokenResponse(req.body, AUTH_QUOTES_AUDIENCE, QUOTES_DEFAULT_SCOPES));
});

async function proxyToUsers(method, path, body) {
  return new Promise((resolve, reject) => {
    const target = USERS;
    const opts = {
      hostname: target.hostname,
      port: target.port,
      path,
      method,
      headers: { 'content-type': 'application/json' },
    };
    delete opts.headers['host'];
    const req = (target.protocol === 'https:' ? https : http).request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

app.post('/api/auth/login', express.json(), async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'USER_VALIDATION', message: 'email and password are required' });
  }

  try {
    const usersResp = await proxyToUsers('GET', `/users?email=${encodeURIComponent(email)}`);
    const users = Array.isArray(usersResp.body) ? usersResp.body : usersResp.body?.users;
    if (!users || users.length === 0) {
      return res.status(401).json({ error: 'USER_NOT_FOUND', message: 'Invalid email or password' });
    }

    const user = users[0];
    const authResp = await proxyToUsers('POST', `/users/${user.id}/authenticate`, { password });

    if (!authResp.body?.authenticated) {
      return res.status(401).json({ error: 'AUTH_FAILED', message: 'Invalid email or password' });
    }

    const token = generateDevToken(user.id, AUTH_AUDIENCE, ['equipments:read', 'equipments:modify'], 480);
    res.json({ token, user: { id: user.id, displayName: user.displayName, email: user.email } });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(502).json({ error: 'UPSTREAM_UNAVAILABLE', message: 'Users service unavailable' });
  }
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
  return {
    hostname: parsed.hostname,
    port: parseInt(parsed.port, 10) || (parsed.protocol === 'https:' ? 443 : 80),
    protocol: parsed.protocol,
  };
}

const QUOTES = parseTarget(QUOTES_TARGET);
const EQUIPMENT = parseTarget(EQUIPMENT_TARGET);
const USERS = parseTarget(USERS_TARGET);
const BOOKING = parseTarget(BOOKING_TARGET);

const TARGET_ROUTES = [
  { prefix: '/quotes', target: QUOTES, rewrite: (suffix) => '/quotes' + suffix },
  { prefix: '/equipment', target: EQUIPMENT, rewrite: (suffix) => suffix || '/' },
  { prefix: '/users', target: USERS, rewrite: (suffix) => suffix || '/' },
  { prefix: '/bookings', target: BOOKING, rewrite: (suffix) => '/api/v1/bookings' + suffix },
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

  const proxyReq = (target.protocol === 'https:' ? https : http).request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err.message);
    res.status(502).json({ error: 'Upstream service unavailable' });
  });
  req.pipe(proxyReq);
});

app.use(express.static(path.join(__dirname), {
    setHeaders: (res, path) => {
        if (path.endsWith('.json')) res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
}));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Gateway running on http://localhost:${PORT}`);
  console.log(`  /api/quotes   -> ${QUOTES_TARGET}/quotes`);
  console.log(`  /api/equipment -> ${EQUIPMENT_TARGET}`);
  console.log(`  /api/users     -> ${USERS_TARGET}`);
  console.log(`  /api/bookings  -> ${BOOKING_TARGET}/api/v1/bookings`);
  console.log(`  /api/auth/token -> local Equipments JWT generator`);
  console.log(`  /api/auth/quotes-token -> local Quotes JWT generator`);
  console.log(`  /api/auth/login -> email+password → users service → JWT`);
});
