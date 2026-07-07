# 打包部署文档

本项目有两个独立的发布单元：

- **后端服务**：Express + PostgreSQL，用 Docker Compose 部署到你的服务器。
- **移动 App**：Expo（React Native），用 EAS 内部分发（Internal Distribution）给你俩装。

发布顺序：**先部署后端并跑通 HTTPS，再打 App 包**（App 的 `apiBaseUrl` 要填后端的正式域名）。

---

## 一、后端部署

### 1.1 前置条件

- 一台能公网访问的服务器，已装 Docker + Docker Compose。
- 一个解析到该服务器的域名（例如 `habit.example.com`）。
- 一个 OpenAI（或兼容）API Key，用于 AI 生成习惯计划。

### 1.2 配置环境变量

在 `server/` 目录准备 `.env`（参考 `server/.env.example` 与 `docker-compose.yml` 用到的键）：

```bash
# 数据库（务必改掉默认弱密码）
POSTGRES_USER=habit
POSTGRES_PASSWORD=<强随机密码>
POSTGRES_DB=habit
DB_PORT=5432        # 宿主机映射端口，仅本机/内网用可不对公网开放
APP_PORT=8787       # 容器对外端口，由反代转发

# 鉴权密钥（登录 token 签名，务必强随机）
JWT_SECRET=<强随机串，勿用示例值>

# AI
OPENAI_API_KEY=<你的 key>
OPENAI_MODEL=gpt-5.5          # 兜底模型，客户端可按请求覆盖

# AI 端点鉴权：设置后客户端必须在 x-api-key 头带同一值
# 公网暴露必须设置，否则任何人可刷你的 OpenAI 额度
API_KEY=<强随机串>

# 限流：每个 IP 每分钟最大请求数
RATE_LIMIT_MAX=60
```

生成强随机串的一种方式：

```bash
openssl rand -base64 32
```

> **安全要点**
> - `API_KEY` 留空 = AI 端点无鉴权。本地开发可留空，**正式环境必须填**。
> - `JWT_SECRET` 泄露 = 任何人可伪造登录态，务必强随机且不入库、不进 git。
> - `POSTGRES_PASSWORD` 不要用 compose 里的默认 `habit`。

### 1.3 HTTPS 反向代理

生产构建的 iOS/Android **默认禁止明文 HTTP 请求**，后端必须通过 HTTPS 域名对外。容器只监听 `8787`（明文），前面挂一层反代负责 TLS。

**推荐 Caddy**（自动申请并续期 Let's Encrypt 证书），`Caddyfile`：

```
habit.example.com {
    reverse_proxy localhost:8787
}
```

Nginx 亦可，但需自行用 certbot 管理证书。反代把 `443` 的 HTTPS 流量转发到容器的 `8787`。

> 建议：`docker-compose.yml` 里 `app` 的端口 `${APP_PORT:-8787}` 只绑定到 `127.0.0.1`（如 `127.0.0.1:8787:8787`），不直接对公网开放，全部流量走反代。`db` 的端口也不必对公网暴露。

### 1.4 构建与启动

```bash
cd server
docker compose up -d --build
```

- 多阶段构建：先编译 TS，再产出精简运行镜像。
- 首次启动时 `runSchema()` 自动建表，并对旧库做 `ALTER`（补 `role`、`created_by` 等列），**无需手动迁移**。
- 数据持久化在 `habit-db` 卷，重启/重建容器不丢数据。

### 1.5 验证

```bash
# 健康检查
curl https://habit.example.com/health
# 期望：{"ok":true}

# 未带 x-api-key 时 AI 端点应被拒（若已设 API_KEY）
curl -X POST https://habit.example.com/api/ai/habit-plan -d '{}'
# 期望：401
```

### 1.6 运维备注

- **限流是单实例内存计数**，不要横向扩多副本（多实例各算各的，限流失效）。双人使用单实例足够。
- 查看日志：`docker compose logs -f app`。
- 备份：定期 `docker compose exec db pg_dump -U habit habit > backup.sql`。
- 更新：改完代码后 `docker compose up -d --build` 即滚动重建。

---

## 二、App 打包（EAS 内部分发）

### 2.1 前置条件

- Expo 账号，本机装了 EAS CLI：`npm install -g eas-cli`。
- 后端已部署好，拿到正式 HTTPS 域名。

### 2.2 必须修改 `app.json`

当前 `app.json` 有三处会阻断发布，逐一处理：

**① `extra.apiBaseUrl`**（最关键）
现在是 `http://192.168.1.8:8787`（局域网 IP + 明文 HTTP）。打进正式包后出了家门连不上，且生产构建禁明文 HTTP。改为：

```json
"extra": {
  "apiBaseUrl": "https://habit.example.com",
  "apiKey": "<与后端 API_KEY 相同的值>"
}
```

- `apiBaseUrl`：不带端口（交给反代的 443）。`apiClient` 和 `aiClient` 都从这里读。
- `apiKey`：`aiClient.ts` 会读它塞进 `x-api-key` 头调 AI 端点。必须与后端 `.env` 的 `API_KEY` 一致，否则 AI 生成计划会 401。

**② iOS `bundleIdentifier` / Android `package`**（EAS 构建必填，当前缺失）

```json
"ios": {
  "icon": "./assets/expo.icon",
  "bundleIdentifier": "com.cheng.dailyhabit"
},
"android": {
  "package": "com.cheng.dailyhabit",
  "adaptiveIcon": { ... },
  "predictiveBackGestureEnabled": false
}
```

命名规则：反向域名，全小写，只用字母/数字/点。一经上架不可更改（内部分发可改，但换了等于新 App）。

### 2.3 创建 `eas.json`

项目根目录新建 `eas.json`，配 `internal` distribution：

```json
{
  "cli": { "version": ">= 0.60.0" },
  "build": {
    "internal": {
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "ios": { "simulator": false }
    }
  }
}
```

- Android 出 `.apk`（可直接下载安装，无需上架）。
- iOS 出 `.ipa`，走 ad-hoc/内部分发，**必须先注册设备 UDID**。

### 2.4 初始化 EAS

```bash
eas login
eas build:configure   # 生成 project ID，写回 app.json 的 extra.eas.projectId
```

### 2.5 iOS 设备注册（仅 iOS 需要）

内部分发的 iOS 包只能装在已注册的设备上：

```bash
eas device:create
```

按提示把你和另一半的 iPhone UDID 都注册进去。Android 无此限制。

### 2.6 发布前自检

```bash
# 客户端
npm run test        # 单元测试
npx tsc --noEmit    # 类型检查

# 后端
cd server && npm run test && npx tsc --noEmit
```

全绿再打包。

### 2.7 打包

```bash
# 分平台或一次两平台
eas build --profile internal --platform android
eas build --profile internal --platform ios
```

构建在 Expo 云端进行，完成后给下载链接：

- Android：把 `.apk` 发给对方，直接安装。
- iOS：用分发链接在已注册设备上安装。

---

## 三、发布清单（Checklist）

后端：

- [ ] `.env` 已填强 `POSTGRES_PASSWORD` / `JWT_SECRET` / `API_KEY` / `OPENAI_API_KEY`
- [ ] 域名解析到服务器，反代（Caddy/Nginx）配好 HTTPS
- [ ] `docker compose up -d --build` 成功，`/health` 返回 `{"ok":true}`
- [ ] 容器端口不直接对公网暴露（走反代）

App：

- [ ] `app.json` 的 `apiBaseUrl` 改成正式 HTTPS 域名
- [ ] `app.json` 补 `apiKey`（= 后端 API_KEY）
- [ ] `app.json` 补 `bundleIdentifier` / `package`
- [ ] `eas.json` 已创建
- [ ] `eas build:configure` 已跑（有 project ID）
- [ ] iOS 已注册双方设备 UDID
- [ ] `npm run test` + `npx tsc` 两端全绿
- [ ] `eas build --profile internal` 成功，双方装上并能登录/同步

联调验证（发布后真机确认，fake 测不到）：

- [ ] 登录/注册/加入空间（邀请码）
- [ ] 数据跨设备同步、XP 服务端权威计算
- [ ] 图片上传与显示（base64）
- [ ] owner/member 权限实际生效（奖励管理仅 owner）
- [ ] `created_by` 服务端盖章正确（两台设备各打卡，归属正确）
- [ ] AI 生成习惯计划（`x-api-key` 通过、限流不误伤）
