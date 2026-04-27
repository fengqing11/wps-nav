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

const FALLBACK_DATA = [
  {
    group: '景越-备货分析',
    items: [
      { title: '备货分析-优化', url: 'https://www.kdocs.cn/l/ckMbZ12leZAJ' },
      { title: '备货算法配置', url: 'https://www.kdocs.cn/wo/sl/v12UNTGv' },
      { title: '历史下单数据', url: 'https://www.kdocs.cn/wo/sl/v13anGlp' },
      { title: '✔️佛山仓库', url: 'https://www.kdocs.cn/wo/sl/v13cHMA8' },
      { title: 'BOSS视图', url: 'https://www.kdocs.cn/wo/sl/v13nfIsT' }
    ]
  },
  {
    group: '景越-采购订单管理',
    items: [
      { title: '采购订单管理', url: 'https://www.kdocs.cn/l/cuEPxbObTeHu' },
      { title: '表格视图-赣州', url: 'https://www.kdocs.cn/wo/sl/v11gKqKX' },
      { title: '表格视图-佛山', url: 'https://www.kdocs.cn/wo/sl/v1Uo9U7' },
      { title: '产品信息表  表格视图', url: 'https://www.kdocs.cn/wo/sl/v135jpS' },
      { title: '赣州货盘', url: 'https://www.kdocs.cn/wo/sl/v11GRcgI' }
    ]
  },
  {
    group: '景越-制版订单管理',
    items: [
      { title: '制版订单管理', url: 'https://www.kdocs.cn/l/cniVBcNZtioD' },
      { title: '运营-预选品', url: 'https://www.kdocs.cn/wo/sl/v11rwWRN' },
      { title: '制版订单表-赣州', url: 'https://www.kdocs.cn/wo/sl/v12X264W' },
      { title: '制版订单表-佛山', url: 'https://www.kdocs.cn/wo/sl/v1A2gLB' }
    ]
  },
  {
    group: 'NVFelix-货盘',
    items: [{ title: '货盘表', url: 'https://www.kdocs.cn/l/cskf9dwxFXFU' }]
  },
  {
    group: '景越-预备货表',
    items: [
      { title: '预备货表', url: 'https://www.kdocs.cn/l/cmt0npiPCvpJ' },
      { title: '仓库间拣货表-拣货单', url: 'https://www.kdocs.cn/wo/sl/v1H6VZK' }
    ]
  },
  {
    group: '景越-财务数据',
    items: [
      { title: '景越-财务数据', url: 'https://www.kdocs.cn/l/ciJw5YS1k4dU' },
      { title: '原始数据-表格视图', url: 'https://www.kdocs.cn/wo/sl/v13jSNbx' }
    ]
  },
  {
    group: '景越-退供(样)数据',
    items: [
      { title: '退供处理-佛山 表格视图-月份分组', url: 'https://www.kdocs.cn/wo/sl/v1a36U1' },
      { title: '退样处理-佛山', url: 'https://www.kdocs.cn/wo/sl/v14Fzta3' },
      { title: '退供处理-赣州 表格视图-月份分组', url: 'https://www.kdocs.cn/wo/sl/v1iYld7' },
      { title: '退样处理-赣州', url: 'https://www.kdocs.cn/wo/sl/v11h7WpF' },
      { title: '退供数据-所有', url: 'https://www.kdocs.cn/wo/sl/v128bNyE' }
    ]
  },
  {
    group: '景越-TK产品信息表',
    items: [
      { title: 'TK产品信息表-原始数据', url: 'https://www.kdocs.cn/l/ckrfj5feM5g7' },
      { title: 'TK产品信息表-表格视图', url: 'https://www.kdocs.cn/wo/sl/v12Q7PSx' },
      { title: '表格视图-TTS-景越', url: 'https://www.kdocs.cn/wo/sl/v13DSIf0' },
      { title: '表格视图-TTS-景创瑞', url: 'https://www.kdocs.cn/wo/sl/v13UWEk5' }
    ]
  },
  {
    group: '景越-店铺提现',
    items: [
      { title: '提现数据汇总-表格视图', url: 'https://www.kdocs.cn/wo/sl/v1301saq' },
      { title: '仪表盘', url: 'https://www.kdocs.cn/wo/sl/v1375dB2' },
      { title: '基础数据-账户信息', url: 'https://www.kdocs.cn/wo/sl/v13M2SB6' },
      { title: '基础数据-店铺结算', url: 'https://www.kdocs.cn/wo/sl/v1Di7vi' },
      { title: '基础数据-提现记录', url: 'https://www.kdocs.cn/wo/sl/v123rTgu' }
    ]
  },
  {
    group: '景越-人员',
    items: [
      { title: '用户表-表格视图', url: 'https://www.kdocs.cn/wo/sl/v11cAGsy' },
      { title: '景越内部人员-账号收集', url: 'https://www.kdocs.cn/wo/sl/v14RsDbn' }
    ]
  }
];

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
  if (first) selectDoc(first);
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
    currentData = FALLBACK_DATA;
    render(currentData, searchInput.value);
    selectFirst();
    statusBar.textContent = `${currentTeamLabel} 动态加载失败，已切换到静态兜底数据：${error.message}`;
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
currentData = FALLBACK_DATA;
render(currentData);
selectFirst();
updateFocusModeButton();
updateFullscreenButton();
loadDynamicData();
