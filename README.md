# 景越文档导航站

## 位置

`mini-sites/jingyue-nav`

## 当前推荐用法

不走 Wrangler，本项目保留两种清晰用途：

### 1）本地 Node 调试

适合你本地开发、验证 WPS webhook 是否正常。

#### 新建 `.env`

参考：`.env.example`

```env
WPS_WEBHOOK=https://www.kdocs.cn/api/v3/ide/file/corH6Pn7C9vm/script/V2-3VpBguvVTfZKpjuTNO5VE3/sync_task
WPS_TOKEN=你的 AirScript Token
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

保留的目录结构：

- `public/`：静态页面
- `functions/api/nav-data.js`：Cloudflare Pages Functions

#### Cloudflare Pages 里要配的环境变量

- `WPS_WEBHOOK`
- `WPS_TOKEN`

其中：
- `WPS_TOKEN` 要作为 **Secret** 配置
- 不要写进前端

#### Pages 构建配置

- **Framework preset**：None
- **Build command**：留空
- **Build output directory**：`public`

---

## 当前行为

- 页面先显示静态兜底导航
- 然后请求 `/api/nav-data`
- 本地 Node 调试时，`/api/nav-data` 由 `server.mjs` 提供
- Cloudflare Pages 部署时，`/api/nav-data` 由 `functions/api/nav-data.js` 提供
- 如果动态数据失败，则继续使用静态兜底数据

## 为什么不前端直调 WPS webhook

原因还是这两个：

1. **Token 会暴露**
2. **浏览器跨域不稳**

所以正确结构是：

- 本地：`前端 -> 本地 Node -> WPS webhook`
- 线上：`前端 -> Cloudflare Pages Function -> WPS webhook`
