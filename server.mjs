import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CACHE_TTL_MS,
  DEFAULT_TEAM,
  REQUEST_TIMEOUT_MS,
  buildErrorPayload,
  buildSuccessPayload,
  normalizeDynamicData,
  resolveTeamConfig
} from './lib/nav-core.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');

function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const PORT = Number(process.env.PORT || 8090);
const cache = new Map();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, code, data) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data, null, 2));
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(buf);
  });
}

function getFreshCache(team) {
  const entry = cache.get(team);
  if (!entry) return null;
  if (Date.now() - entry.savedAt > CACHE_TTL_MS) return null;
  return entry;
}

function getAnyCache(team) {
  return cache.get(team) || null;
}

function setCache(team, payload) {
  cache.set(team, {
    payload,
    savedAt: Date.now()
  });
}

function fetchJsonWithTimeout(url, payload, headers, timeoutMs) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const parsed = new URL(url);
    const req = https.request({
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      path: `${parsed.pathname}${parsed.search}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers
      }
    }, resp => {
      let rawBody = '';
      resp.setEncoding('utf8');
      resp.on('data', chunk => {
        rawBody += chunk;
      });
      resp.on('end', () => {
        let parsedBody;
        try {
          parsedBody = JSON.parse(rawBody || '{}');
        } catch {
          reject({
            message: `WPS 返回非 JSON：${rawBody.slice(0, 200)}`,
            code: 'NON_JSON_RESPONSE',
            httpStatus: resp.statusCode || null
          });
          return;
        }

        if (resp.statusCode && resp.statusCode >= 400) {
          reject({
            message: `WPS HTTP ${resp.statusCode}: ${parsedBody?.result || parsedBody?.msg || '请求失败'}`,
            code: parsedBody?.result || parsedBody?.errno || 'WPS_HTTP_ERROR',
            httpStatus: resp.statusCode
          });
          return;
        }

        resolve(parsedBody);
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(Object.assign(new Error('请求 WPS webhook 超时，请稍后重试'), { code: 'UPSTREAM_TIMEOUT' }));
    });

    req.on('error', err => {
      reject({
        message: err.message,
        code: err.code || 'NETWORK_ERROR'
      });
    });

    req.write(body);
    req.end();
  });
}

async function handleNavData(req, res, url) {
  const team = url.searchParams.get('team') || DEFAULT_TEAM;
  const cached = getFreshCache(team);
  if (cached) {
    sendJson(res, 200, {
      ...cached.payload,
      cached: true
    });
    return;
  }

  const resolved = resolveTeamConfig(process.env, team, { allowFallback: true });
  if (resolved.error) {
    sendJson(res, 500, buildErrorPayload(null, {
      error: resolved.error,
      code: resolved.code,
      team: resolved.team || team
    }));
    return;
  }

  try {
    const raw = await fetchJsonWithTimeout(
      resolved.webhook,
      { Context: { argv: {} } },
      { 'AirScript-Token': resolved.token },
      REQUEST_TIMEOUT_MS
    );

    const groups = normalizeDynamicData(raw);
    const payload = buildSuccessPayload({
      team: resolved.team,
      teamLabel: resolved.label,
      groups,
      fetchedAt: new Date().toISOString()
    });

    setCache(resolved.team, payload);
    sendJson(res, 200, payload);
  } catch (error) {
    const fallback = getAnyCache(resolved.team);
    if (fallback) {
      sendJson(res, 200, {
        ...fallback.payload,
        cached: true,
        stale: true
      });
      return;
    }

    sendJson(res, 500, buildErrorPayload(error, {
      team: resolved.team
    }));
  }
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { ok: false, error: 'Bad request' });
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/nav-data') {
    await handleNavData(req, res, url);
    return;
  }

  let filePath = path.join(publicDir, url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  serveFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Jingyue nav site running at http://127.0.0.1:${PORT}`);
});
