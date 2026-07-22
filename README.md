# 每日打卡

面向双人共享空间的习惯养成 App。两位成员可以一起制定习惯、完成每日打卡、积累 XP、解锁闯关章节和兑换奖励，也可以通过 AI 计划助手与共同宠物「卡卡」获得陪伴和行动支持。

项目采用 Expo + React Native 构建移动端，Express + PostgreSQL 提供鉴权、同步、AI、语音、奖励和冒险服务。目前重点支持 Android，iOS 与 Web 可用于常规功能开发和调试。

## 界面预览

<p align="center">
  <img src="docs/assets/readme/today.png" alt="今日打卡与双人小岛" width="31%" />
  <img src="docs/assets/readme/world-map.png" alt="双人闯关世界地图" width="31%" />
  <img src="docs/assets/readme/companion.png" alt="卡卡陪伴与共同记忆" width="31%" />
</p>

<p align="center"><sub>今日打卡与小岛经营 · XP 世界地图 · 卡卡陪伴设置</sub></p>

## 核心功能

### 习惯与打卡

- 创建、编辑、暂停和恢复习惯
- 支持每日、工作日和每周指定日期等频率
- 支持完成型与数值型目标
- 今日打卡、撤销窗口、连续天数、里程碑和完成统计
- 本地提醒、晚间未完成汇总与免打扰时段
- SQLite 本地数据与云端共享空间同步

### 双人空间

- 注册、登录、创建或加入共享空间
- 习惯、打卡、XP、奖励、闯关进度和卡卡对话按 `space_id` 隔离
- WebSocket 推送资源失效事件，双方设备及时刷新
- owner/member 权限控制与管理入口
- 头像、奖励图片和章节素材通过 Cloudflare R2 直传与公开读取

### AI 计划助手

- 根据目标、基础、周期和提醒偏好生成分阶段习惯计划
- 在保存前预览并编辑每天的行动和目标值
- 流式 AI 对话、计划调整建议和阶段复盘
- 支持为每个共享空间配置独立的 OpenAI 兼容服务地址、API Key 与模型
- 模型不可用时返回明确错误，不影响基础打卡能力

### 共同宠物「卡卡」

- 全局浮动宠物、逐帧动画、拖动、休息状态和快捷互动
- 根据打卡、里程碑、伴侣进展和情绪签到提供上下文反馈
- 双方共享近期对话、已确认记忆和羁绊进度
- 支持情绪签到、鼓励、复盘、陪伴呼吸和连续语音对话
- Android 使用应用内录音 + 腾讯云 ASR，减少对手机系统语音服务的依赖
- 服务端接入 MiMo 流式 TTS；不可用时客户端回退到系统语音
- 支持“卡卡”语音唤醒，并可携带唤醒词后的指令直接进入对话
- 可提议完成打卡、新建/修改习惯、暂停或恢复习惯；所有写操作必须由发起成员确认后执行

卡卡不是医疗或心理诊断服务。对话、共同记忆和卡卡回复对共享空间双方可见；模型只能接触服务端整理后的最小必要上下文。

### XP、奖励与闯关

- 打卡、连续奖励和计划完成可获得 XP
- 奖励商城支持虚拟奖励、现实奖励、库存和兑换记录
- owner 可管理奖励并处理待兑现项目
- 累计 XP 解锁双人岛屿章节、故事和徽章
- 章节支持草稿/发布/归档、真实奖励兑现和自定义岛屿素材

### 更新与发布

- App 内检查 Android 新版本并打开 APK 下载地址
- `v*` tag 自动构建 production APK、创建 GitHub Release 并同步到 R2
- R2 `latest.json` 作为 Android 更新清单，包含版本、哈希、大小和下载地址
- 同一个 `v*` tag 触发服务端生产镜像构建、远程部署和健康检查

## 系统架构

```mermaid
flowchart LR
  App["Expo / React Native App"]
  API["Express API"]
  DB[("PostgreSQL")]
  R2["Cloudflare R2"]
  LLM["OpenAI-compatible LLM"]
  ASR["Tencent Cloud ASR"]
  TTS["MiMo Streaming TTS"]
  CI["GitHub Actions"]

  App -->|"REST / SSE / WebSocket"| API
  API --> DB
  API --> LLM
  API --> ASR
  API --> TTS
  API -->|"presigned upload"| R2
  App -->|"direct upload / public read"| R2
  CI -->|"APK + latest.json"| R2
  CI -->|"Docker deploy"| API
```

移动端负责交互、本地 SQLite、原生提醒、录音和音频播放；服务端统一负责身份边界、共享数据、模型提示词、结构化动作校验、第三方密钥与持久化。客户端不会直接持有 LLM、ASR、TTS 或 R2 私密凭据。

## 技术栈

### 移动端

- Expo 57、React Native 0.86、React 19
- Expo Router、TypeScript
- Expo SQLite、Expo Notifications
- React Native Reanimated、React Native Audio API
- Expo Speech Recognition、Expo Speech
- Vitest、Expo ESLint

### 服务端

- Node.js、Express 5、TypeScript
- PostgreSQL、`pg`、WebSocket (`ws`)
- JWT、bcrypt、Zod
- OpenAI SDK
- Tencent Cloud SDK、MiMo TTS
- AWS S3 SDK（Cloudflare R2）
- Docker、Docker Compose

### CI/CD

- GitHub Actions：客户端/服务端 CI、Android 构建、服务端部署
- EAS CLI 本地构建：development build、APK、AAB
- GHCR：服务端生产镜像
- GitHub Release + Cloudflare R2：Android 安装包与更新清单

## 目录结构

```text
.
├── app/                    # Expo Router 页面与路由
├── src/
│   ├── adventure/          # 双人闯关、章节与徽章
│   ├── ai/                 # AI 计划、对话与调整规则
│   ├── checkins/           # 打卡、统计、里程碑与撤销
│   ├── pet/                # 卡卡、语音、记忆与受控动作
│   ├── rewards/            # 奖励与兑换
│   ├── sync/               # 鉴权、API、上传与实时同步
│   ├── updates/            # Android 更新检查
│   └── xp/                 # XP 规则、钱包与流水
├── server/src/
│   ├── adventure/          # 闯关 API 与持久化
│   ├── auth/               # 账号、空间与 JWT
│   ├── companion/          # 卡卡模型、ASR、TTS、记忆与动作
│   ├── data/               # 习惯、打卡、奖励与设置 API
│   ├── sync/               # WebSocket 资源失效通知
│   └── uploads/            # R2 presigned upload
├── assets/                 # App、宠物和岛屿视觉资源
├── docs/                   # 设计方案、实现计划与原型
├── .github/workflows/      # CI、移动端发布与服务端部署
├── app.config.js           # 按 APP_ENV 注入客户端配置
├── app.json                # Expo 应用元数据与原生权限
└── eas.json                # EAS build profiles
```

## 本地开发

### 环境要求

- Node.js 24
- npm 11（`package-lock.json` 由 npm 11 维护）
- PostgreSQL 17，或可访问的 PostgreSQL 实例
- Android Studio / Xcode（运行原生 development build 时）
- Docker Desktop（可选，用于本地 PostgreSQL 或完整服务端容器）

原生语音、通知和音频播放不能在 Expo Go 中完整验证，请使用 development build。

### 1. 安装依赖

```bash
git clone https://github.com/ChengSoon/daily-habit-checkin.git
cd daily-habit-checkin

npm ci
cd server && npm ci
```

### 2. 配置开发环境

`APP_ENV` 决定加载哪组根配置：

- `development`（默认）读取 `.env.dev`
- `production` / `prod` 读取 `.env.prod`
- 本机私密覆盖放在 `.env.dev.local` / `.env.prod.local`
- 服务端还会读取 `server/.env` 与 `server/.env.local`

不要把真实密钥提交到仓库。推荐在根目录创建 `.env.dev.local`：

```dotenv
# App 公共配置
API_BASE_URL=http://127.0.0.1:8787
R2_PUBLIC_BASE=https://cdn.example.com

# Server 基础配置
DATABASE_URL=postgresql://habit:habit@127.0.0.1:5432/habit
JWT_SECRET=replace-with-a-long-random-secret
PORT=8787

# AI（可选；未配置时 AI 功能不可用）
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=

# 卡卡语音（可选）
TENCENT_SECRET_ID=
TENCENT_SECRET_KEY=
TENCENT_ASR_REGION=ap-guangzhou
TENCENT_ASR_ENGINE=16k_zh
MIMO_API_KEY=
MIMO_TTS_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_TTS_MODEL=mimo-v2.5-tts
MIMO_TTS_VOICE=冰糖

# 图片与 Android 更新（可选）
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
APP_UPDATE_MANIFEST_URL=https://cdn.example.com/releases/android/latest.json
```

常用配置说明：

| 配置 | 用途 | 必需场景 |
| --- | --- | --- |
| `API_BASE_URL` | App 访问统一后端 | App 联调 |
| `DATABASE_URL` | 服务端连接 PostgreSQL | 账号与共享数据 |
| `JWT_SECRET` | 签发和验证登录令牌 | 账号与共享数据 |
| `OPENAI_*` | AI 计划和卡卡文字模型默认配置 | AI 功能 |
| `TENCENT_*` | Android 应用内语音识别 | 卡卡语音输入 |
| `MIMO_*` | 卡卡流式语音合成 | 卡卡云端语音输出 |
| `R2_*` | 图片上传、公开资源和 APK 镜像 | R2 相关功能 |
| `APP_UPDATE_MANIFEST_URL` | 服务端代理 Android 更新清单 | App 内更新 |
| `API_KEY` | 保护旧版 `/api/ai/*` 接口 | 需要额外访问控制时 |

### 3. 启动 PostgreSQL

已有 PostgreSQL 时只需保证 `DATABASE_URL` 可访问。也可以使用仓库中的本地 Compose，仅启动数据库：

```bash
cd server
JWT_SECRET=local-dev-only docker compose \
  -f docker-compose.local.yml up -d db
```

默认数据库地址为 `postgresql://habit:habit@127.0.0.1:5432/habit`。

### 4. 启动服务端

```bash
cd server
npm run dev
```

健康检查：

```bash
curl http://127.0.0.1:8787/health
```

服务端启动时会检查数据库连接并创建当前 schema。数据库不可访问时进程会直接退出并输出排查命令。

### 5. 启动 App

在另一个终端回到仓库根目录：

```bash
npm run start
```

常用运行方式：

```bash
npm run android   # Android development build
npm run ios       # iOS development build
npm run web       # Web 调试，原生能力受限
```

真机访问本机服务端时，`API_BASE_URL` 不能使用手机自身的 `127.0.0.1`，请改为开发电脑的局域网地址或可访问的 HTTPS 地址。

## 质量检查

提交前运行与 CI 一致的检查：

```bash
# Client
npm test
npx tsc --noEmit
npm run lint

# Server
cd server
npm test
npm run build
```

当前测试覆盖习惯、打卡、XP、奖励、同步、闯关、卡卡陪伴、受控动作、ASR/TTS、语音状态机和 Android 更新等核心逻辑。

## 部署与发版

### 服务端手动部署

生产服务器需要 Docker、Docker Compose、可用的 `proxy_net`，并预先在 `/root/habit-server/.env` 配置生产环境变量。部署脚本不会上传或覆盖密钥：

```bash
cd server
./deploy.sh
```

脚本会执行本地 TypeScript build、传输必要源码、远程重建 `habit-app` 容器，并检查 `/health`。它使用 `--no-deps`，不会重建 PostgreSQL。

新增服务端环境变量时，除了更新服务器 `.env`，还必须同步 `server/docker-compose.yml` 和 `server/docker-compose.local.yml` 中 `app.environment` 的变量映射；Compose 不会自动把 `.env` 的所有键注入容器。

### Android 与服务端统一发版

1. 同步修改 `app.json` 的 `expo.version` 与 `package.json` 的 `version`。
2. 完成客户端、服务端质量检查。
3. 使用仓库提交规范创建 release commit。
4. 创建同版本 `v*` tag 并推送 `main` 与 tag。

示例：

```bash
git add app.json package.json
git commit -m "chore(release): 版本升级至 1.0.23"
git push origin main

git tag -a v1.0.23 -m "v1.0.23: release notes"
git push origin v1.0.23
```

tag 推送后：

- `.github/workflows/eas-build.yml` 构建 `production-apk`
- APK 上传到 GitHub Release 和 `releases/android/v1.0.23/app.apk`
- R2 `releases/android/latest.json` 更新并清理超出保留数量的旧版本
- `.github/workflows/cd-server.yml` 构建服务端生产镜像、远程部署并执行健康检查

移动端发布所需 GitHub Secrets：

```text
EXPO_TOKEN
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
```

服务端部署所需 GitHub Secrets：

```text
SSH_PRIVATE_KEY
SSH_HOST
SSH_USER
```

常用 GitHub Variables：

```text
R2_PUBLIC_BASE
R2_RELEASE_PREFIX
R2_RELEASE_KEEP
DEPLOY_REMOTE_DIR
DEPLOY_NODE_IMAGE
DEPLOY_NPM_REGISTRY
```

## 使用与开发注意事项

- 卡卡对话、共同记忆和羁绊属于共享空间数据，双方成员均可见。
- 卡卡的写操作使用服务端白名单、Zod 校验、15 分钟过期提案和发起成员确认，不允许任意工具调用。
- Android 自动更新仅比较版本并下载 APK，不是 Play Store 热更新。
- Expo Go 不包含项目所需的自定义原生语音与音频模块。
- 没有配置腾讯云 ASR 时，Android 卡卡语音输入不可用；没有配置 MiMo 时会尝试系统 TTS 降级。
- R2 未配置时，核心文字与打卡流程仍可运行，但图片上传和 APK 镜像不可用。
- 根目录 `.env.dev` / `.env.prod` 只应保存可公开的环境地址；所有密钥使用未跟踪的 `*.local` 或服务器私密 `.env`。

## 相关文档

- [卡卡自主陪伴设计](docs/superpowers/specs/2026-07-19-kaka-autonomous-companion-design.md)
- [卡卡 App 内受控动作设计](docs/superpowers/specs/2026-07-21-kaka-app-agent-actions-design.md)
- [卡卡 MiMo 流式 TTS 设计](docs/superpowers/specs/2026-07-21-kaka-mimo-tts-streaming-design.md)
- [卡卡桌面宠物设计](docs/superpowers/specs/2026-07-19-kaka-desktop-pet-design.md)
- [糖果岛视觉重设计方案](docs/design-prototypes/2026-07-18-candy-island-redesign-spec.md)
