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

export async function onRequestGet(context) {
  const { env } = context;
  const webhook = env.WPS_WEBHOOK;
  const token = env.WPS_TOKEN;

  if (!webhook || !token) {
    return Response.json({
      ok: false,
      error: 'Missing WPS_WEBHOOK or WPS_TOKEN binding'
    }, { status: 500 });
  }

  try {
    const resp = await fetch(webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'AirScript-Token': token
      },
      body: JSON.stringify({ Context: { argv: {} } })
    });

    const raw = await resp.json();

    if (!resp.ok) {
      return Response.json({
        ok: false,
        error: `WPS HTTP ${resp.status}: ${raw?.result || raw?.msg || '请求失败'}`,
        code: raw?.result || raw?.errno || 'WPS_HTTP_ERROR',
        httpStatus: resp.status,
        response: raw
      }, { status: 500 });
    }

    const groups = normalizeDynamicData(raw);
    return Response.json({
      ok: true,
      source: 'wps-webhook',
      groups,
      logs: raw?.data?.logs || [],
      raw,
      summary: {
        groupCount: Array.isArray(groups) ? groups.length : 0,
        itemCount: Array.isArray(groups) ? groups.reduce((sum, g) => sum + (Array.isArray(g.items) ? g.items.length : 0), 0) : 0
      }
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
}
