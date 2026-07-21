# 卡卡 MiMo-V2.5-TTS 真流式语音实现计划

> **给实现阶段使用：** 本计划以 `docs/superpowers/specs/2026-07-21-kaka-mimo-tts-streaming-design.md` 为唯一设计输入。没有用户确认前，不进入业务代码实现。

**目标：** 将卡卡语音对话的系统 TTS 替换为 MiMo `mimo-v2.5-tts` 的 PCM 真流式播放，并保留系统 TTS 降级。

**架构：** 移动端通过已鉴权的 `/api/companion/tts` 请求服务端；服务端使用 `MIMO_API_KEY` 代理 MiMo SSE，并将供应商响应归一化为应用级音频 SSE；移动端将 24kHz 单声道 PCM16LE 增量交给原生 PCM 播放队列。首期完整文字回复后启动 TTS，不做 LLM/TTS 分句并行。

**关键约束：** MiMo Key 只在服务端；首期只允许预置中文音色，默认 `冰糖`；`voiceclone`、后台播放、锁屏播放和音频持久化不在范围内。

### Task 1: 锁定 TTS 流协议和错误语义

**范围：** 在服务端和客户端之间建立稳定的应用级契约，覆盖请求、音频事件、结束事件和错误事件。

- [x] 定义 TTS 请求校验：非空、清理后的文本长度上限、禁止客户端提交 model/key/上游 URL/音频样本。
- [x] 定义音频事件元数据：`sampleRate=24000`、`channels=1`、`encoding=pcm_s16le`，并拒绝不匹配的事件。
- [x] 定义 `audio`、`done`、`error` 和客户端取消的状态转换。
- [x] 为碎片化 SSE、空事件、非法 JSON、非法 Base64、上游错误和 `[DONE]` 写出契约测试。

**退出信号：** 服务端、客户端和测试对同一组 SSE 示例得出相同的事件序列与错误结果。

### Task 2: 实现服务端 MiMo provider 与流式路由

**范围：** 在陪伴域内增加 MiMo TTS provider 和受鉴权的 `/api/companion/tts` 路由。

- [x] 使用 `api-key` 请求头调用 `https://api.xiaomimimo.com/v1/chat/completions`，不要复用文字模型的 `Authorization` 假设。
- [x] 固定 `mimo-v2.5-tts`、`pcm16`、预置音色白名单和卡卡风格提示。
- [x] 将 MiMo `choices[0].delta.audio.data` 归一化为应用级 `event: audio`，保持音频块顺序。
- [x] 处理客户端断开、请求超时、MiMo 429/5xx、Key 缺失和错误响应；不写入敏感日志。
- [x] 增加服务端 TTS 限流与文本长度保护，不能影响现有文字聊天路由。
- [x] 补充 `MIMO_*` 环境变量说明，不把 Key 写入仓库配置或客户端配置。

**退出信号：** 使用假的 MiMo 上游流可以完整跑通“请求 → 多个 audio 事件 → done”，取消和错误都能结束响应且不泄漏凭证。

### Task 3: 实现原生 PCM 播放队列

**范围：** 提供跨平台 `PcmPlayer` 接口和 iOS/Android 原生实现，支持 24kHz 单声道 PCM16LE。

- [x] 实现 `start / enqueue / finish / stop` 生命周期和单一播放队列。
- [x] 保证音频增量顺序、背压、短启动缓冲、队列排空通知和 underrun 处理。
- [x] 保证停止、卸载、切后台和新会话开始时清空旧队列，迟到的块不会播放。
- [x] 将原生模块接入 development build；Expo Go 不作为验收环境。
- [x] 对播放器缺失、初始化失败和播放异常提供可识别的错误结果。

**退出信号：** 在 iOS 和 Android development build 中，人工生成的 PCM 测试流能连续播放、打断后立即停止，队列排空事件只触发一次。

### Task 4: 接入客户端 TTS 流和语音会话状态机

**范围：** 将 TTS SSE 和 PCM 播放接入现有卡卡语音对话，不回归语音识别和系统降级。

- [x] 在现有陪伴客户端边界新增 TTS 流调用和应用级 SSE 解析，不直接访问 MiMo。
- [x] 将 `usePetVoiceConversation` 中的播报职责拆到 TTS/播放器适配层，保持识别状态机职责清晰。
- [x] 完整回复到达后启动 TTS；首个可播放音频块到达后进入 `speaking`，收到 `done` 后等待队列排空再恢复识别。
- [x] 打断、结束、页面卸载、切后台、账号切换和新请求开始时同时取消 SSE 与播放器。
- [x] 首块前 TTS 失败时调用 `expo-speech`；首块后失败时停止播放、显示通用错误并恢复识别，不重复播报整段文本。
- [x] 保持现有语音唤醒、语音识别权限、卡卡动画和文字共同对话行为不变。

**退出信号：** 单元测试覆盖状态转换、迟到事件隔离、取消、首块前后降级和恢复监听；真实设备上成功路径不调用系统 TTS。

### Task 5: 联调、验收与回归

**范围：** 在真实 MiMo 凭证和真实设备上验证协议、播放、异常和现有功能回归。

- [ ] 服务端运行 companion/TTS 测试和 TypeScript build。
- [x] 移动端运行语音状态、SSE、客户端和 PCM 播放相关测试，并执行 TypeScript、ESLint。
- [ ] iOS development build 验证正常流、打断、断网、429/5xx、切后台和重新进入语音会话。
- [ ] Android development build 重复同一组场景，关注 AudioTrack 初始化、音频焦点和队列 underrun。
- [x] 核对日志和构建产物中不存在 `MIMO_API_KEY`、完整请求头或 Base64 音频。
- [x] 核对代码中没有直接从 App 请求 `api.xiaomimimo.com`，没有引入 voice clone、后台播放或音频持久化。

**退出信号：** 设计文档中的正常、边界、错误和“明确不做”验收契约全部有测试或设备操作证据。

## 实现前需要确认

- [ ] 用户确认首期使用 `冰糖`。
- [ ] 用户确认服务端配置 `MIMO_API_KEY`，不复用 App 内文字模型 Key。
- [ ] 用户确认“流式”首期只覆盖 TTS 音频边生成边播放，不覆盖 LLM/TTS 分句并行。
- [ ] 用户提供可用的 iOS/Android development build 验证环境。
