const nav = document.getElementById('nav');
const searchInput = document.getElementById('searchInput');
const viewer = document.getElementById('viewer');
const viewerWrap = document.getElementById('viewerWrap');
const docTitle = document.getElementById('docTitle');
const docMeta = document.getElementById('docMeta');
const openLink = document.getElementById('openLink');
const copyLink = document.getElementById('copyLink');
const refreshBtn = document.getElementById('refreshBtn');
const statusBar = document.getElementById('statusBar');
const focusModeBtn = document.getElementById('focusModeBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const siteTitle = document.getElementById('siteTitle');
const siteSubtitle = document.getElementById('siteSubtitle');

let activeUrl = '';
let activeButton = null;
let currentData = [];

const TEAM_LABELS = {
  jingyue: '景越',
  yuyan: '钰衍'
};

const urlParams = new URLSearchParams(window.location.search);
const currentTeam = (urlParams.get('team') || 'jingyue').trim().toLowerCase();
const currentTeamLabel = TEAM_LABELS[currentTeam] || currentTeam;


function safeText(text) {
  return String(text).replace(/[&<>\"]/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[s]));
}

function updateTeamBranding() {
  document.title = `${currentTeamLabel}文档导航`;
  if (siteTitle) siteTitle.textContent = `${currentTeamLabel}文档导航`;
  if (siteSubtitle) siteSubtitle.textContent = `${currentTeamLabel} 团队的 WPS 文档内嵌导航小站`;
}

function normalizeData(groups) {
  if (!Array.isArray(groups)) return null;
  return groups
    .map(group => ({
      group: group.group || group.name || group.title || '未命名分组',
      modules: Array.isArray(group.modules) ? group.modules : [],
      items: Array.isArray(group.items)
        ? group.items.map(item => ({
            title: item.title || item.name || item.text || '未命名文档',
            url: item.url || item.href || '',
            field: item.field || ''
          })).filter(item => item.url)
        : []
    }))
    .filter(group => group.items.length);
}

function render(data, keyword = '') {
  const q = keyword.trim().toLowerCase();
  const groups = data
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (!q) return true;
        return [group.group, (group.modules || []).join(' '), item.title, item.url].join(' ').toLowerCase().includes(q);
      })
    }))
    .filter(group => group.items.length);

  if (!groups.length) {
    nav.innerHTML = '<div class="empty">没搜到匹配项。</div>';
    return;
  }

  nav.innerHTML = groups.map(group => `
    <section class="group">
      <h3 class="group-title">${safeText(group.group)} <span class="group-meta">${group.items.length} 项${group.modules?.length ? ' · ' + safeText(group.modules.join(' / ')) : ''}</span></h3>
      <div class="item-list">
        ${group.items.map(item => `
          <button class="item" data-url="${item.url}" data-title="${safeText(item.title)}" data-group="${safeText(group.group)}">
            <span class="item-title">${safeText(item.title)}</span>
            <span class="item-url">${safeText(item.url)}</span>
          </button>
        `).join('')}
      </div>
    </section>
  `).join('');

  nav.querySelectorAll('.item').forEach(btn => {
    btn.addEventListener('click', () => selectDoc(btn));
  });
}

function selectDoc(btn) {
  const url = btn.dataset.url;
  const title = btn.dataset.title;
  const group = btn.dataset.group;

  activeUrl = url;
  if (activeButton) activeButton.classList.remove('active');
  activeButton = btn;
  activeButton.classList.add('active');

  viewer.src = url;
  docTitle.textContent = title;
  docMeta.textContent = `${group} · ${url}`;
  openLink.href = url;
}

function selectFirst() {
  const first = document.querySelector('.item');
  if (first) {
    selectDoc(first);
    return;
  }
  clearSelection('当前没有可预览的文档');
}

function clearSelection(message = '暂无文档可预览') {
  activeUrl = '';
  if (activeButton) activeButton.classList.remove('active');
  activeButton = null;
  viewer.src = 'about:blank';
  docTitle.textContent = message;
  docMeta.textContent = '请检查当前团队是否已有可用导航数据';
  openLink.href = '#';
}

function updateFocusModeButton() {
  focusModeBtn.textContent = document.body.classList.contains('focus-mode') ? '退出沉浸' : '沉浸预览';
}

function updateFullscreenButton() {
  fullscreenBtn.textContent = document.fullscreenElement ? '退出全屏' : '浏览器全屏';
}

function toggleFocusMode() {
  document.body.classList.toggle('focus-mode');
  updateFocusModeButton();
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      if (!document.body.classList.contains('focus-mode')) {
        document.body.classList.add('focus-mode');
        updateFocusModeButton();
      }
      const target = document.documentElement;
      await target.requestFullscreen();
    }
  } catch (error) {
    statusBar.textContent = `全屏切换失败：${error.message}`;
  }
  updateFullscreenButton();
}

async function loadDynamicData() {
  statusBar.textContent = `正在拉取 ${currentTeamLabel} 的最新导航数据…`;
  try {
    const resp = await fetch(`/api/nav-data?team=${encodeURIComponent(currentTeam)}`);
    const json = await resp.json();
    if (!resp.ok || !json.ok) {
      const detail = [json.code, json.httpStatus, json.response?.result].filter(Boolean).join(' / ');
      throw new Error(detail ? `${json.error} (${detail})` : (json.error || '动态接口返回失败'));
    }

    const normalized = normalizeData(json.groups);
    if (!normalized || !normalized.length) {
      throw new Error('接口返回成功，但 data.result 不是当前站点可识别的导航分组结构');
    }

    currentData = normalized;
    render(currentData, searchInput.value);
    selectFirst();
    const groupCount = json.summary?.groupCount ?? currentData.length;
    const itemCount = json.summary?.itemCount ?? currentData.reduce((sum, g) => sum + g.items.length, 0);
    const loadedTeamLabel = json.teamLabel || currentTeamLabel;
    statusBar.textContent = `${loadedTeamLabel} 动态数据已加载：${groupCount} 个分组 / ${itemCount} 个链接 · 来源 WPS webhook`;
  } catch (error) {
    currentData = [];
    render(currentData, searchInput.value);
    clearSelection('导航数据加载失败');
    statusBar.textContent = `${currentTeamLabel} 动态加载失败：${error.message}`;
  }
}

copyLink.addEventListener('click', async () => {
  if (!activeUrl) return;
  try {
    await navigator.clipboard.writeText(activeUrl);
    copyLink.textContent = '已复制';
    setTimeout(() => copyLink.textContent = '复制链接', 1500);
  } catch {
    copyLink.textContent = '复制失败';
    setTimeout(() => copyLink.textContent = '复制链接', 1500);
  }
});

refreshBtn.addEventListener('click', loadDynamicData);
focusModeBtn.addEventListener('click', toggleFocusMode);
fullscreenBtn.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => {
  updateFullscreenButton();
  if (!document.fullscreenElement) {
    statusBar.textContent = '已退出浏览器全屏';
  } else {
    statusBar.textContent = '已进入浏览器全屏';
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.classList.contains('focus-mode') && !document.fullscreenElement) {
    document.body.classList.remove('focus-mode');
    updateFocusModeButton();
  }
});
searchInput.addEventListener('input', e => render(currentData, e.target.value));

updateTeamBranding();
currentData = [];
render(currentData);
clearSelection('正在加载导航数据…');
updateFocusModeButton();
updateFullscreenButton();
loadDynamicData();
