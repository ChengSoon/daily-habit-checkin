# FCM 服务端推送

## 配置密钥

1. 将 Firebase 服务账号 JSON 放到 `server/secrets/firebase-adminsdk.json`（已 gitignore）
2. 或设置 `GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json`
3. 安装依赖：`cd server && npm install`
4. 启动服务后日志应出现：`FCM 已初始化`

## API

- `PUT /api/push/token` `{ token, platform }` 登记设备令牌（需登录）
- `POST /api/push/test` 给当前账号设备发测试推送
- `GET /api/push/status` 是否已配置 FCM
- `POST /api/push/run-tick` 手动跑一轮到点提醒扫描

## 到点推送

服务启动后默认每 30s 扫描：上海时区 `HH:mm` 与 `habits.reminder_time` 相同、未完成的习惯，推给同空间已登记设备。

关闭：`FCM_PUSH_SCHEDULER=0`

## 客户端

- 安装包需配置 Firebase `google-services.json`（Android）才能拿到原生 FCM token
- Expo Go 不可靠；用 EAS/本地 dev build
- App 启动/回前台/登录后会自动 `registerDevicePushToken`
- 资料 → 提醒：可点「测试服务端 FCM 推送」
