# 景越文档导航站

## 位置

`mini-sites/jingyue-nav`

## 现在支持两种运行方式

### 方式 1：本地 Node 运行

适合本地调试。

#### 1) 新建 `.env`

参考：`.env.example`

```env
WPS_WEBHOOK=https://www.kdocs.cn/api/v3/ide/file/corH6Pn7C9vm/script/V2-3VpBguvVTfZKpjuTNO5VE3/sync_task
WPS_TOKEN=你的 AirScript Token
PORT=8090
```

#### 2) 启动服务

```bash
node server.mjs
```

#### 3) 打开站点

`http://127.0.0.1:8090/`

---

### 方式 2：Cloudflare Pages 部署

已经整理成 Pages 可部署结构：

- `public/`：静态页面
- `functions/api/nav-data.js`：Pages Functions 动态接口
- `wrangler.toml`：Pages 配置

#### Cloudflare Pages 环境变量 / Secret

部署时需要在 Cloudflare Pages 项目里配置：

- `WPS_WEBHOOK`
- `WPS_TOKEN`

其中：
- `WPS_TOKEN` 必须作为 **Secret** 配置，不要写进前端

#### 本地 Pages 开发（可选）

先安装依赖：

```bash
npm install
```

然后：

```bash
npx wrangler pages dev public
```

#### 部署命令（CLI）

```bash
npx wrangler pages deploy public
```

---

## 当前行为

- 页面会先显示一份静态兜底导航数据
- 然后自动请求 `/api/nav-data`
- 如果 webhook 返回结构符合预期，就自动替换成动态数据
- 如果失败，则继续使用静态数据，并在页面顶部状态栏显示错误原因

## 为什么不建议前端直调 WPS webhook

原因有两个：

1. **Token 会暴露**：任何打开网页的人都能在浏览器里看到你的 AirScript Token
2. **跨域受限**：浏览器直接对 `kdocs.cn` 发起跨域预检时，大概率会被拒绝

所以更稳的方式是：

- 本地：`前端页面 -> 本地 Node 服务 -> WPS webhook`
- Cloudflare Pages：`前端页面 -> Pages Function -> WPS webhook`
