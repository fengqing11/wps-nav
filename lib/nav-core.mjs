export const TEAM_CONFIG = {
  jingyue: {
    label: '景越',
    envKey: 'WPS_WEBHOOK_JINGYUE',
    fallbackWebhook: 'https://www.kdocs.cn/api/v3/ide/file/corH6Pn7C9vm/script/V2-3VpBguvVTfZKpjuTNO5VE3/sync_task'
  },
  yuyan: {
    label: '钰衍',
    envKey: 'WPS_WEBHOOK_YUYAN',
    fallbackWebhook: ''
  }
};

export const DEFAULT_TEAM = 'jingyue';
export const CACHE_TTL_MS = 30_000;
export const REQUEST_TIMEOUT_MS = 10_000;

export function extractItemsFromFields(fields = {}) {
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

export function normalizeDynamicData(raw) {
  const result = raw?.data?.result ?? raw?.result ?? raw;

  if (Array.isArray(result) && result.length && result[0]?.fields) {
    return result.map((record, index) => {
      const fields = record.fields || {};
      const group = String(fields['标题'] || fields.title || fields['名称'] || `未命名分组-${index + 1}`).trim();
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
  if (Array.isArray(result?.items)) {
    return [{ group: result.group || result.name || '默认分组', items: result.items }];
  }
  return null;
}

export function resolveTeamConfig(source, team = DEFAULT_TEAM, options = {}) {
  const teamKey = String(team || DEFAULT_TEAM).trim().toLowerCase();
  const config = TEAM_CONFIG[teamKey];
  if (!config) {
    return { error: `Unsupported team: ${teamKey}`, code: 'UNSUPPORTED_TEAM' };
  }

  const configuredWebhook = source?.[config.envKey] || '';
  const webhook = options.allowFallback ? (configuredWebhook || config.fallbackWebhook) : configuredWebhook;
  const token = source?.WPS_TOKEN || '';

  if (!webhook || !token) {
    return {
      error: `Missing ${config.envKey} or WPS_TOKEN for team ${teamKey}`,
      code: 'MISSING_TEAM_CONFIG',
      team: teamKey,
      label: config.label
    };
  }

  return {
    team: teamKey,
    label: config.label,
    webhook,
    token
  };
}

export function buildSuccessPayload({ team, teamLabel, groups, cached = false, stale = false, fetchedAt = new Date().toISOString() }) {
  const safeGroups = Array.isArray(groups) ? groups : [];
  return {
    ok: true,
    source: 'wps-webhook',
    team,
    teamLabel,
    groups: safeGroups,
    cached,
    stale,
    fetchedAt,
    summary: {
      groupCount: safeGroups.length,
      itemCount: safeGroups.reduce((sum, group) => sum + (Array.isArray(group.items) ? group.items.length : 0), 0)
    }
  };
}

export function buildErrorPayload(error, extras = {}) {
  return {
    ok: false,
    error: error?.message || extras.error || 'Unknown error',
    code: error?.code || extras.code || 'UNKNOWN_ERROR',
    httpStatus: error?.httpStatus || extras.httpStatus || null,
    team: extras.team || error?.team || null,
    cached: Boolean(extras.cached),
    stale: Boolean(extras.stale)
  };
}
