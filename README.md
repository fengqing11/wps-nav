# 景越文档导航站

## 位置

`mini-sites/jingyue-nav`

## 本次整理后的结构

- `public/`：唯一静态前端目录
- `functions/api/nav-data.js`：Cloudflare Pages 接口
- `lib/nav-core.mjs`：Node / Pages 共用的数据归一化与配置逻辑
- `server.mjs`：本地 Node 调试服务

根目录旧版 `index.html` / `app.js` / `styles.css` 已不再作为正式入口使用，本地与线上现在统一走 `public/`。

---

## 当前推荐用法

### 1）本地 Node 调试

适合你本地开发、验证 WPS webhook 是否正常。

#### 新建 `.env`

参考：`.env.example`

```env
WPS_WEBHOOK_JINGYUE=https://www.kdocs.cn/api/v3/ide/file/corH6Pn7C9vm/script/V2-3VpBguvVTfZKpjuTNO5VE3/sync_task
WPS_WEBHOOK_YUYAN=https://www.kdocs.cn/api/v3/ide/file/钰衍脚本地址/sync_task
WPS_TOKEN=公共 AirScript Token
PORT=8090
```

#### 启动

```bash
node server.mjs
```

或：

```bash
npm run dev
```

#### 打开

`http://127.0.0.1:8090/`

---

### 2）Cloudflare Pages 后台部署（推荐）

直接把 GitHub 仓库连接到 Cloudflare Pages，**不要用 Wrangler CLI**。

#### Pages 构建配置

- **Framework preset**：None
- **Build command**：留空
- **Build output directory**：`public`

#### Cloudflare Pages 里要配的环境变量

明文变量：

- `WPS_WEBHOOK_JINGYUE`
- `WPS_WEBHOOK_YUYAN`

Secret：

- `WPS_TOKEN`

可用官方命令：

```bash
wrangler pages secret put WPS_TOKEN --project-name wps-nav
```

如果要给 preview 环境单独配置：

```bash
wrangler pages secret put WPS_TOKEN --project-name wps-nav --env preview
```

另外，当前 `wrangler.toml` 已声明：

```toml
[secrets]
required = ["WPS_TOKEN"]
```

这样本地开发和部署时都会校验 `WPS_TOKEN` 是否存在。

---

## 当前行为

- 页面启动后直接请求 `/api/nav-data`
- 本地 Node 调试时，`/api/nav-data` 由 `server.mjs` 提供
- Cloudflare Pages 部署时，`/api/nav-data` 由 `functions/api/nav-data.js` 提供
- 前端只消费精简后的导航结构，不再依赖接口返回 `raw` / `logs`
- 本地与线上接口都加了：
  - 10 秒超时
  - 30 秒短缓存
  - 上次成功数据兜底（stale 返回）

---

## 团队区分方式

通过 URL 参数区分团队：

- `?team=jingyue` → 景越
- `?team=yuyan` → 钰衍

现在还支持把当前选中文档写回 URL，例如：

- `?team=jingyue&doc=https%3A%2F%2F...`

这样刷新页面后会尽量回到刚才查看的文档。

---

## 收藏

前端会按团队把 **我的收藏** 保存在浏览器 `localStorage`，默认保留 20 条。

这些都只保存在本机浏览器里，不上传服务端。

---

## 为什么不前端直调 WPS webhook

原因还是这两个：

1. **Token 会暴露**
2. **浏览器跨域不稳**

所以正确结构是：

- 本地：`前端 -> 本地 Node -> WPS webhook`
- 线上：`前端 -> Cloudflare Pages Function -> WPS webhook`
