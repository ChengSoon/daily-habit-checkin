# 个推服务端推送

## 配置

在 `server/.env` 或部署环境中设置以下变量：

- `GETUI_APP_ID`
- `GETUI_APP_KEY`
- `GETUI_MASTER_SECRET`
- `GETUI_API_BASE_URL`（可选，默认使用个推生产地址）
- `GETUI_PUSH_SCHEDULER`（可选，设为 `0` 关闭习惯提醒调度）
- `GETUI_PUSH_TICK_MS`（可选，默认 `30000`）

客户端安装生产/开发构建后，会自动获取 Android 个推 CID，并在登录态下调用 `PUT /api/push/token` 登记。

可通过 `GET /api/push/status` 查看个推配置状态，通过资料页的测试按钮验证服务端推送。
