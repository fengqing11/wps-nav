const nav = document.getElementById('nav');
const searchInput = document.getElementById('searchInput');
const viewer = document.getElementById('viewer');
const docTitle = document.getElementById('docTitle');
const docMeta = document.getElementById('docMeta');
const openLink = document.getElementById('openLink');
const copyLink = document.getElementById('copyLink');
const refreshBtn = document.getElementById('refreshBtn');
const toggleAllGroupsBtn = document.getElementById('toggleAllGroupsBtn');
const statusBar = document.getElementById('statusBar');
const focusModeBtn = document.getElementById('focusModeBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const siteTitle = document.getElementById('siteTitle');
const siteSubtitle = document.getElementById('siteSubtitle');

let activeUrl = '';
let activeButton = null;
let currentData = [];
let favoriteDocs = [];
let collapsedGroups = {};

const TEAM_LABELS = {
  jingyue: '景越',
  yuyan: '钰衍'
};

const urlParams = new URLSearchParams(window.location.search);
const currentTeam = (urlParams.get('team') || 'jingyue').trim().toLowerCase();
const currentTeamLabel = TEAM_LABELS[currentTeam] || currentTeam;
const currentDocParam = urlParams.get('doc') || '';
const RECENTS_KEY = `jingyue-nav:recent:${currentTeam}`;
const FAVORITES_KEY = `jingyue-nav:favorites:${currentTeam}`;
const COLLAPSED_GROUPS_KEY = `jingyue-nav:collapsed-groups:${currentTeam}`;
const FAVORITES_LIMIT = 20;

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

function loadJsonList(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadFavoriteDocs() {
  favoriteDocs = loadJsonList(FAVORITES_KEY);
}

function saveFavoriteDocs() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteDocs.slice(0, FAVORITES_LIMIT)));
}

function loadCollapsedGroups() {
  try {
    const parsed = JSON.parse(localStorage.getItem(COLLAPSED_GROUPS_KEY) || '{}');
    collapsedGroups = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    collapsedGroups = {};
  }
}

function saveCollapsedGroups() {
  localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(collapsedGroups));
}

function getGroupKey(groupName) {
  return String(groupName || '未分组');
}

function isGroupCollapsed(groupName) {
  return Boolean(collapsedGroups[getGroupKey(groupName)]);
}

function setGroupCollapsed(groupName, collapsed) {
  const key = getGroupKey(groupName);
  if (collapsed) {
    collapsedGroups[key] = true;
  } else {
    delete collapsedGroups[key];
  }
  saveCollapsedGroups();
}

function expandGroup(groupName) {
  setGroupCollapsed(groupName, false);
}

function getVisibleGroupNames(keyword = '') {
  const q = keyword.trim().toLowerCase();
  return currentData
    .map(group => ({
      name: group.group,
      items: group.items.filter(item => {
        if (!q) return true;
        return [group.group, (group.modules || []).join(' '), item.title, item.url].join(' ').toLowerCase().includes(q);
      })
    }))
    .filter(group => group.items.length)
    .map(group => group.name);
}

function updateToggleAllGroupsButton(keyword = searchInput?.value || '') {
  if (!toggleAllGroupsBtn) return;
  const groupNames = getVisibleGroupNames(keyword);
  if (!groupNames.length) {
    toggleAllGroupsBtn.textContent = '全部折叠';
    toggleAllGroupsBtn.disabled = true;
    return;
  }

  toggleAllGroupsBtn.disabled = false;
  const allCollapsed = groupNames.every(groupName => isGroupCollapsed(groupName));
  toggleAllGroupsBtn.textContent = allCollapsed ? '全部展开' : '全部折叠';
}

function toggleAllGroups() {
  const keyword = searchInput?.value || '';
  const groupNames = getVisibleGroupNames(keyword);
  if (!groupNames.length) return;

  const activeGroup = activeButton?.dataset.group || '';
  const allCollapsed = groupNames.every(groupName => isGroupCollapsed(groupName));

  groupNames.forEach(groupName => {
    const shouldCollapse = allCollapsed ? false : groupName !== activeGroup;
    setGroupCollapsed(groupName, shouldCollapse);
  });

  if (activeGroup) {
    expandGroup(activeGroup);
  }

  render(currentData, keyword);
  restoreActiveButton();
  updateToggleAllGroupsButton(keyword);
  statusBar.textContent = allCollapsed ? '已全部展开当前分组' : '已折叠其他分组，并保留当前文档所在分组展开';
}

function isFavorite(url) {
  return favoriteDocs.some(item => item.url === url);
}

function toggleFavorite(doc) {
  if (!doc?.url) return;

  if (isFavorite(doc.url)) {
    favoriteDocs = favoriteDocs.filter(item => item.url !== doc.url);
    statusBar.textContent = `已取消收藏：${doc.title}`;
  } else {
    favoriteDocs = [{ ...doc, savedAt: Date.now() }, ...favoriteDocs.filter(item => item.url !== doc.url)].slice(0, FAVORITES_LIMIT);
    statusBar.textContent = `已收藏：${doc.title}`;
  }

  saveFavoriteDocs();
  render(currentData, searchInput.value);
  restoreActiveButton();
}

function updateUrlForDoc(url) {
  const nextUrl = new URL(window.location.href);
  if (url) {
    nextUrl.searchParams.set('doc', url);
  } else {
    nextUrl.searchParams.delete('doc');
  }
  history.replaceState(null, '', nextUrl.toString());
}

function buildEmpty(message) {
  nav.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'empty';
  empty.textContent = message;
  nav.appendChild(empty);
}

function createFavoriteButton(item, groupName) {
  const star = document.createElement('button');
  star.type = 'button';
  star.className = `favorite-toggle${isFavorite(item.url) ? ' active' : ''}`;
  star.title = isFavorite(item.url) ? '取消收藏' : '加入收藏';
  star.setAttribute('aria-label', isFavorite(item.url) ? '取消收藏' : '加入收藏');
  star.textContent = isFavorite(item.url) ? '★' : '☆';
  star.addEventListener('click', event => {
    event.stopPropagation();
    toggleFavorite({ title: item.title, url: item.url, group: groupName });
  });
  return star;
}

function createItemButton(item, groupName) {
  const btn = document.createElement('button');
  btn.className = 'item';
  btn.type = 'button';
  btn.dataset.url = item.url;
  btn.dataset.title = item.title;
  btn.dataset.group = groupName;

  const top = document.createElement('div');
  top.className = 'item-top';

  const title = document.createElement('span');
  title.className = 'item-title';
  title.textContent = item.title;

  top.append(title, createFavoriteButton(item, groupName));

  const url = document.createElement('span');
  url.className = 'item-url';
  url.textContent = item.url;

  btn.append(top, url);
  btn.addEventListener('click', () => selectDoc(btn));
  return btn;
}

function createGroupSection(titleText, metaText, items, sectionClass = '', options = {}) {
  const { storageKey = titleText, collapsible = true } = options;
  const collapsed = collapsible ? isGroupCollapsed(storageKey) : false;

  const section = document.createElement('section');
  section.className = `group${sectionClass ? ` ${sectionClass}` : ''}${collapsed ? ' collapsed' : ''}`;

  const header = document.createElement('button');
  header.type = 'button';
  header.className = 'group-title';
  header.setAttribute('aria-expanded', String(!collapsed));

  const titleTextEl = document.createElement('span');
  titleTextEl.className = 'group-title-text';
  titleTextEl.textContent = titleText;

  const meta = document.createElement('span');
  meta.className = 'group-meta';
  meta.textContent = metaText;

  const chevron = document.createElement('span');
  chevron.className = 'group-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.textContent = '▾';

  header.append(titleTextEl, meta, chevron);

  const list = document.createElement('div');
  list.className = 'item-list';
  items.forEach(({ item, group }) => list.appendChild(createItemButton(item, group)));

  if (collapsible) {
    header.addEventListener('click', () => {
      const nextCollapsed = !section.classList.contains('collapsed');
      section.classList.toggle('collapsed', nextCollapsed);
      header.setAttribute('aria-expanded', String(!nextCollapsed));
      setGroupCollapsed(storageKey, nextCollapsed);
    });
  } else {
    header.disabled = true;
  }

  section.append(header, list);
  return section;
}

function renderFavoriteSection(container, keyword) {
  const q = keyword.trim().toLowerCase();
  const availableMap = new Map(currentData.flatMap(group => group.items.map(item => [item.url, { item, group: group.group }])));
  const matched = favoriteDocs
    .map(favorite => availableMap.get(favorite.url) || { item: favorite, group: favorite.group || '未分组' })
    .filter(({ item, group }) => {
      if (!q) return true;
      return [group, item.title, item.url].join(' ').toLowerCase().includes(q);
    });

  if (!matched.length) return;
  container.appendChild(createGroupSection('我的收藏', `${matched.length} 项`, matched, 'favorite-group', {
    storageKey: '__favorites__'
  }));
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

  const hasFavoriteMatch = favoriteDocs.some(item => [item.group || '', item.title, item.url].join(' ').toLowerCase().includes(q));

  if (!groups.length && !hasFavoriteMatch) {
    buildEmpty('没搜到匹配项。');
    return;
  }

  nav.innerHTML = '';
  renderFavoriteSection(nav, keyword);

  groups.forEach(group => {
    if (activeButton?.dataset.group === group.group) {
      expandGroup(group.group);
    }
    nav.appendChild(createGroupSection(
      group.group,
      `${group.items.length} 项${group.modules?.length ? ` · ${group.modules.join(' / ')}` : ''}`,
      group.items.map(item => ({ item, group: group.group })),
      '',
      { storageKey: group.group }
    ));
  });

  updateToggleAllGroupsButton(keyword);
}

function selectDoc(btn) {
  const url = btn.dataset.url;
  const title = btn.dataset.title;
  const group = btn.dataset.group;

  expandGroup(group);

  activeUrl = url;
  if (activeButton) activeButton.classList.remove('active');
  activeButton = btn;
  activeButton.classList.add('active');

  viewer.src = url;
  docTitle.textContent = title;
  docMeta.textContent = `${group} · ${url}`;
  openLink.href = url;
  updateUrlForDoc(url);
}

function restoreActiveButton() {
  if (!activeUrl) return;
  const btn = document.querySelector(`.item[data-url="${CSS.escape(activeUrl)}"]`);
  if (!btn) return;
  if (activeButton) activeButton.classList.remove('active');
  activeButton = btn;
  activeButton.classList.add('active');
}

function selectFirst() {
  const preferred = currentDocParam ? document.querySelector(`.item[data-url="${CSS.escape(currentDocParam)}"]`) : null;
  const first = preferred || document.querySelector('.item');
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
  updateUrlForDoc('');
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
      await document.documentElement.requestFullscreen();
    }
  } catch (error) {
    statusBar.textContent = `全屏切换失败：${error.message}`;
  }
  updateFullscreenButton();
}

function buildStatusText(json, fallbackLabel) {
  const groupCount = json.summary?.groupCount ?? currentData.length;
  const itemCount = json.summary?.itemCount ?? currentData.reduce((sum, g) => sum + g.items.length, 0);
  const label = json.teamLabel || fallbackLabel;
  const cacheText = json.stale ? ' · 当前展示的是最近一次成功数据' : (json.cached ? ' · 命中短缓存' : '');
  return `${label} 导航已加载：${groupCount} 个分组 / ${itemCount} 个链接${cacheText}`;
}

async function loadDynamicData() {
  statusBar.textContent = `正在拉取 ${currentTeamLabel} 的最新导航数据…`;
  try {
    const resp = await fetch(`/api/nav-data?team=${encodeURIComponent(currentTeam)}`);
    const json = await resp.json();
    if (!resp.ok || !json.ok) {
      throw new Error(json.error || '动态接口返回失败');
    }

    const normalized = normalizeData(json.groups);
    if (!normalized || !normalized.length) {
      throw new Error('接口返回成功，但没有可识别的导航数据');
    }

    currentData = normalized;
    render(currentData, searchInput.value);
    selectFirst();
    statusBar.textContent = buildStatusText(json, currentTeamLabel);
  } catch (error) {
    currentData = [];
    buildEmpty('导航数据加载失败');
    clearSelection('导航数据加载失败');
    statusBar.textContent = `${currentTeamLabel} 动态加载失败：${error.message}`;
  }
}

copyLink.addEventListener('click', async () => {
  if (!activeUrl) return;
  try {
    await navigator.clipboard.writeText(activeUrl);
    copyLink.textContent = '已复制';
    setTimeout(() => {
      copyLink.textContent = '复制链接';
    }, 1500);
  } catch {
    copyLink.textContent = '复制失败';
    setTimeout(() => {
      copyLink.textContent = '复制链接';
    }, 1500);
  }
});

refreshBtn.addEventListener('click', loadDynamicData);
toggleAllGroupsBtn?.addEventListener('click', toggleAllGroups);
focusModeBtn.addEventListener('click', toggleFocusMode);
fullscreenBtn.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => {
  updateFullscreenButton();
  statusBar.textContent = document.fullscreenElement ? '已进入浏览器全屏' : '已退出浏览器全屏';
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.body.classList.contains('focus-mode') && !document.fullscreenElement) {
    document.body.classList.remove('focus-mode');
    updateFocusModeButton();
  }
});
searchInput.addEventListener('input', event => {
  render(currentData, event.target.value);
  restoreActiveButton();
});

localStorage.removeItem(RECENTS_KEY);
loadFavoriteDocs();
loadCollapsedGroups();
updateTeamBranding();
render([]);
clearSelection('正在加载导航数据…');
updateFocusModeButton();
updateFullscreenButton();
loadDynamicData();
updateToggleAllGroupsButton();
