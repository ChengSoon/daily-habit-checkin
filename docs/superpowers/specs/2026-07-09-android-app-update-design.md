# Android App Update Design

## 背景

当前仓库已经在 `v*` tag 上通过 GitHub Actions 构建 Android `production-apk`，并把 APK 上传到 GitHub Release。这个流程解决了“发版产物生成”，但没有解决两件事：

- App 内无法知道有新版本。
- 部分用户无法稳定访问 GitHub Release 下载 APK。

本功能一期只做 Android APK 更新提示与可访问下载镜像，不做静默安装，也不做 iOS 更新链路。

## 目标

- 开发者发布 `v*` tag 后，CI 自动生成可被客户端读取的 `latest.json`。
- APK 与 `latest.json` 同步到 Cloudflare R2，通过自定义公网域名提供下载。
- 客户端从自家后端读取最新版本信息，不直接访问 GitHub。
- 客户端在发现新 APK 时提示用户，并打开下载地址让用户手动确认安装。
- 保留最近少量 APK，避免 R2 免费存储额度被历史包占满。

## 非目标

- 不实现 Android 静默安装；普通 App 无法绕过系统确认。
- 不引入 Expo OTA 热更新；后续可以另做 EAS Update，用来覆盖 JS 与资源小改动。
- 不做强制升级拦截；一期只提示可用更新。
- 不维护设备 push token，不做发版后系统通知推送。

## 方案

采用“GitHub Release 产物 + R2 镜像 + 后端 manifest 代理 + App 内提示”的四段式链路。

1. `v*` tag 触发 `.github/workflows/eas-build.yml`。
2. EAS local build 产出 `production-apk`，继续上传 GitHub Release。
3. CI 计算 APK 的 `sha256`、大小、版本号，生成 `latest.json`，并把 APK 与 `latest.json` 上传到 R2。
4. 后端新增匿名接口 `GET /api/app-update/latest`，读取配置的 manifest URL，校验并返回客户端需要的字段。
5. App 新增更新检查模块，比较当前版本与 manifest 版本，发现新版时在“我的”页显示更新卡片。
6. 用户点击“下载更新”后，App 使用系统浏览器打开 R2 下载链接。

## Manifest 契约

`latest.json` 放在 R2，例如：

```json
{
  "platform": "android",
  "version": "1.0.1",
  "buildNumber": 12,
  "mandatory": false,
  "releaseDate": "2026-07-09T00:00:00.000Z",
  "notes": "修复同步体验并优化打卡动画。",
  "downloadUrl": "https://your-cdn.example.com/releases/android/v1.0.1/app.apk",
  "sha256": "64 位十六进制摘要",
  "sizeBytes": 123456789
}
```

字段约束：

- `platform` 必须是 `android`。
- `version` 使用语义化版本或当前 `v*` tag 去掉前缀后的值。
- `buildNumber` 用于同版本号下的构建比较；缺失时客户端只按 `version` 比较。
- `downloadUrl` 必须是 HTTPS。
- `sha256` 与 `sizeBytes` 用于展示和后续校验扩展；一期不在客户端下载后校验，因为 APK 下载交给系统浏览器。

## 后端接口

新增 `server/src/appUpdate/appUpdateRoutes.ts`：

- 路由：`GET /api/app-update/latest?platform=android`
- 鉴权：匿名可访问。
- 数据源：`APP_UPDATE_MANIFEST_URL` 环境变量。
- 返回：manifest 中客户端需要的字段。
- 错误处理：
  - 未配置 manifest URL：返回 `204 No Content`，表示没有更新通道。
  - manifest 拉取失败或格式非法：返回 `502` 与“更新信息暂不可用”。
  - 非 Android 平台：返回 `400`。

后端做 manifest 代理的原因：

- 客户端不依赖 GitHub，也不需要知道 R2 目录结构。
- 后续可以在后端切换镜像源、灰度规则或强制升级策略。
- manifest schema 在服务端先校验，客户端逻辑更简单。

## 客户端行为

新增 `src/updates/` 模块：

- `appVersion.ts`：读取当前 App 版本与构建号。
- `versionCompare.ts`：比较版本号与构建号。
- `updateClient.ts`：请求 `/api/app-update/latest` 并判断是否有更新。
- `updateClient.test.ts` / `versionCompare.test.ts`：覆盖核心判断。

“我的”页新增“应用更新”卡片：

- 默认显示当前版本。
- 进入页面时自动检查一次。
- 用户可点击“检查更新”手动刷新。
- 发现新版时显示版本、包大小、发布日期、更新说明和“下载更新”按钮。
- 网络失败时只显示轻量错误，不影响其他设置功能。
- Web / iOS 上显示“当前平台暂不支持应用内安装包更新”或隐藏下载按钮。

## R2 与流量策略

R2 只存静态 APK 和 manifest，使用公开桶或自定义域名直链下载，不通过 Worker 代理下载。

存储策略：

- 上传路径：`releases/android/v<version>/app.apk`
- Manifest 路径：`releases/android/latest.json`
- CI 发布后保留最近 3 到 5 个版本，删除更老 APK。

这样下载流量不走服务器带宽；R2 的主要消耗是 APK 文件存储与少量读写请求。

## CI 配置

`.github/workflows/eas-build.yml` 在发布步骤后追加 R2 同步：

- 找到构建产出的 `.apk`。
- 计算 `sha256` 与 `sizeBytes`。
- 从 tag 解析版本号。
- 生成 `latest.json`。
- 使用 S3 兼容命令上传 APK 与 manifest 到 R2。
- 可选清理历史版本，只保留最近 N 个目录。

新增 secrets / variables：

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_PUBLIC_BASE`
- `R2_RELEASE_PREFIX`，默认 `releases/android`
- `R2_RELEASE_KEEP`，默认 `5`

## 风险与边界

- Android 用户仍需要手动确认安装 APK；这是系统安全边界。
- 用户若关闭“允许安装未知来源应用”，下载后安装会被系统拦截，需由系统设置引导。
- GitHub Actions 构建失败时不会更新 manifest，客户端仍看到上一个稳定版本。
- R2 manifest 被错误覆盖时可能导致下载失败；后端 schema 校验可以拦截明显坏数据。
- 当前 `eas.json` 使用 remote app version source，CI 需要从 tag 或 Expo 配置中稳定得到版本号，不能依赖本地 `package.json` 自动递增值。

## 验收标准

- 打 `v1.0.1` tag 后，CI 仍能上传 APK 到 GitHub Release。
- 同一次发布会把 APK 上传到 R2，并生成可访问的 `latest.json`。
- 后端 `GET /api/app-update/latest?platform=android` 能返回合法 manifest。
- App 当前版本低于 manifest 时，“我的”页显示可更新状态。
- 点击“下载更新”会打开 R2 HTTPS 下载链接。
- App 当前版本等于或高于 manifest 时，显示已是最新版本。
- R2 只保留配置数量内的旧版本。
- 客户端测试、服务端测试与类型检查通过。
