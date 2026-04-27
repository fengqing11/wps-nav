import {
  CACHE_TTL_MS,
  REQUEST_TIMEOUT_MS,
  buildErrorPayload,
  buildSuccessPayload,
  normalizeDynamicData,
  resolveTeamConfig
} from '../../lib/nav-core.mjs';

const cache = new Map();

function getCached(team) {
  const entry = cache.get(team);
  if (!entry) return null;
  if (Date.now() - entry.savedAt > CACHE_TTL_MS) return null;
  return entry;
}

function setCached(team, payload) {
  cache.set(team, {
    payload,
    savedAt: Date.now()
  });
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const team = url.searchParams.get('team') || 'jingyue';
  const cached = getCached(team);

  if (cached) {
    return Response.json({
      ...cached.payload,
      cached: true
    }, {
      headers: {
        'Cache-Control': 'public, max-age=15, stale-while-revalidate=45'
      }
    });
  }

  const resolved = resolveTeamConfig(env, team, { allowFallback: false });
  if (resolved.error) {
    return Response.json(buildErrorPayload(null, {
      error: resolved.error,
      code: resolved.code,
      team: resolved.team || team
    }), { status: 500 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const resp = await fetch(resolved.webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'AirScript-Token': resolved.token
      },
      body: JSON.stringify({ Context: { argv: {} } }),
      signal: controller.signal
    });

    const raw = await resp.json();
    if (!resp.ok) {
      return Response.json(buildErrorPayload(null, {
        error: `WPS HTTP ${resp.status}: ${raw?.result || raw?.msg || '请求失败'}`,
        code: raw?.result || raw?.errno || 'WPS_HTTP_ERROR',
        httpStatus: resp.status,
        team: resolved.team
      }), { status: 500 });
    }

    const groups = normalizeDynamicData(raw);
    const payload = buildSuccessPayload({
      team: resolved.team,
      teamLabel: resolved.label,
      groups,
      fetchedAt: new Date().toISOString()
    });

    setCached(resolved.team, payload);

    return Response.json(payload, {
      headers: {
        'Cache-Control': 'public, max-age=15, stale-while-revalidate=45'
      }
    });
  } catch (error) {
    const fallback = cache.get(resolved.team);
    if (fallback) {
      return Response.json({
        ...fallback.payload,
        cached: true,
        stale: true
      }, {
        headers: {
          'Cache-Control': 'public, max-age=5, stale-while-revalidate=45'
        }
      });
    }

    const isAbort = error?.name === 'AbortError';
    return Response.json(buildErrorPayload({
      message: isAbort ? '请求 WPS webhook 超时，请稍后重试' : error.message,
      code: isAbort ? 'UPSTREAM_TIMEOUT' : 'NETWORK_ERROR',
      team: resolved.team
    }), { status: 500 });
  } finally {
    clearTimeout(timeoutId);
  }
}
