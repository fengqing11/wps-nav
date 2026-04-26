import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const WPS_WEBHOOK = process.env.WPS_WEBHOOK || 'https://www.kdocs.cn/api/v3/ide/file/corH6Pn7C9vm/script/V2-3VpBguvVTfZKpjuTNO5VE3/sync_task';
const WPS_TOKEN = process.env.WPS_TOKEN || '';

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

function extractItemsFromFields(fields = {}) {
  const links = [];
  for (const [key, value] of Object.entries(fields)) {
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      if (item && typeof item === 'object' && item.address) {
        links.push({
          field: key,
          title: item.displayText || item.address,
          url: item.address
        });
      }
    }
  }
  return links;
}

function normalizeDynamicData(raw) {
  const result = raw?.data?.result ?? raw?.result ?? raw;

  if (Array.isArray(result) && result.length && result[0]?.fields) {
    return result.map((record, index) => {
      const fields = record.fields || {};
      const group = String(fields['标题'] || fields['title'] || fields['名称'] || `未命名分组-${index + 1}`).trim();
      const items = extractItemsFromFields(fields);
      const modules = Array.isArray(fields['模块']) ? fields['模块'] : [];
      const cover = Array.isArray(fields['封面']) ? fields['封面'][0] : null;

      return {
        id: record.id || String(index + 1),
        group,
        modules,
        cover,
        items
      };
    }).filter(group => group.items.length);
  }

  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.groups)) return result.groups;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.items)) return [{ group: result.group || result.name || '默认分组', items: result.items }];
  return null;
}

function createWpsError(message, extras = {}) {
  const error = new Error(message);
  Object.assign(error, extras);
  return error;
}

function fetchWpsData() {
  return new Promise((resolve, reject) => {
    if (!WPS_TOKEN) {
      reject(createWpsError('Missing WPS_TOKEN environment variable', { code: 'MISSING_TOKEN' }));
      return;
    }

    const payload = JSON.stringify({ Context: { argv: {} } });
    const url = new URL(WPS_WEBHOOK);
    const req = https.request({
      protocol: url.protocol,
      hostname: url.hostname,
      path: `${url.pathname}${url.search}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'AirScript-Token': WPS_TOKEN,
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (resp) => {
      let body = '';
      resp.setEncoding('utf8');
      resp.on('data', chunk => body += chunk);
      resp.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(body || '{}');
        } catch (e) {
          reject(createWpsError(`WPS 返回非 JSON: ${body.slice(0, 300)}`, {
            code: 'NON_JSON_RESPONSE',
            httpStatus: resp.statusCode,
            rawBody: body.slice(0, 1000)
          }));
          return;
        }

        if (resp.statusCode && resp.statusCode >= 400) {
          reject(createWpsError(`WPS HTTP ${resp.statusCode}: ${parsed?.result || parsed?.msg || '请求失败'}`, {
            code: parsed?.result || parsed?.errno || 'WPS_HTTP_ERROR',
            httpStatus: resp.statusCode,
            response: parsed,
            responseHeaders: resp.headers
          }));
          return;
        }

        resolve({
          raw: parsed,
          logs: parsed?.data?.logs || [],
          result: parsed?.data?.result
        });
      });
    });

    req.on('error', (err) => reject(createWpsError(err.message, { code: 'NETWORK_ERROR' })));
    req.write(payload);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  if (!req.url) return sendJson(res, 400, { error: 'Bad request' });

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
    try {
      const fetched = await fetchWpsData();
      const groups = normalizeDynamicData(fetched.raw);
      sendJson(res, 200, {
        ok: true,
        source: 'wps-webhook',
        groups,
        logs: fetched.logs,
        raw: fetched.raw,
        summary: {
          groupCount: Array.isArray(groups) ? groups.length : 0,
          itemCount: Array.isArray(groups) ? groups.reduce((sum, g) => sum + (Array.isArray(g.items) ? g.items.length : 0), 0) : 0
        }
      });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error.message,
        code: error.code || 'UNKNOWN_ERROR',
        httpStatus: error.httpStatus || null,
        response: error.response || null,
        responseHeaders: error.responseHeaders || null
      });
    }
    return;
  }

  let filePath = path.join(__dirname, url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
  if (!filePath.startsWith(__dirname)) {
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
