const assert = require('assert');
const { spawn } = require('child_process');
const http = require('http');
const net = require('net');

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function waitForGateway(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('gateway did not start')), 5000);

    child.stdout.on('data', (chunk) => {
      if (String(chunk).includes('Gateway running')) {
        clearTimeout(timeout);
        resolve();
      }
    });

    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`gateway exited before startup with code ${code}`));
    });
  });
}

function postJson(port, path, body) {
  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let responseBody = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            body: responseBody ? JSON.parse(responseBody) : null,
          });
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function decodePayload(token) {
  const [, payload] = token.split('.');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

(async () => {
  const port = await getFreePort();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: __dirname + '/..',
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForGateway(child);

    const equipment = await postJson(port, '/api/auth/token', { subject: 'equipment-smoke' });
    assert.strictEqual(equipment.statusCode, 200);
    assert.strictEqual(equipment.body.audience, 'equipments-service');
    assert.deepStrictEqual(equipment.body.scopes, ['equipments:read', 'equipments:modify']);
    assert.strictEqual(decodePayload(equipment.body.token).aud, 'equipments-service');

    const quotes = await postJson(port, '/api/auth/quotes-token', { subject: 'quotes-smoke' });
    assert.strictEqual(quotes.statusCode, 200);
    assert.strictEqual(quotes.body.audience, 'quotes-service');
    assert.deepStrictEqual(quotes.body.scopes, ['quotes:admin', 'quotes:approve']);
    assert.strictEqual(decodePayload(quotes.body.token).aud, 'quotes-service');
  } finally {
    child.kill();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
