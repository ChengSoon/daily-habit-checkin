# 卡卡桌宠 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用真实 3D 毛绒海豹动画图集替换临时 SVG 卡卡，并在打卡系统中提供状态联动、拖动和对话入口。

**Architecture:** 图像生成与应用运行时解耦：`openai-image-api` 生成源图，`hatch-pet` 生成经过验证的固定图集，应用只读取静态 WebP。动画状态、帧时序和拖动边界放在纯 TypeScript 模块中，React Native 组件只负责计时、裁切图集和手势。

**Tech Stack:** Expo 57、React Native 0.86、TypeScript、Expo Image、Vitest、OpenAI Image API、hatch-pet。

---

### Task 1: 固化动画与拖动契约

**Files:**
- Create: `src/pet/petAnimation.ts`
- Create: `src/pet/petAnimation.test.ts`
- Modify: `src/pet/types.ts`

- [ ] **Step 1: 写失败测试**

覆盖六种 `PetMood` 的图集状态映射、九行动画的行号/帧时序、减少动态效果时固定首帧，以及拖动方向和边界计算。

- [ ] **Step 2: 验证测试按预期失败**

Run: `npm test -- src/pet/petAnimation.test.ts`

Expected: FAIL，原因是 `petAnimation.ts` 尚不存在。

- [ ] **Step 3: 实现最小纯函数模块**

导出 `PET_ANIMATIONS`、`animationForMood`、`frameAtElapsed`、`motionStateForDelta` 和 `clampPetOffset`，所有魔法尺寸集中为命名常量。

- [ ] **Step 4: 验证定向测试通过**

Run: `npm test -- src/pet/petAnimation.test.ts`

Expected: PASS。

### Task 2: 生成并验证卡卡图集

**Files:**
- Create: `artifacts/pets/kaka/**`
- Create: `assets/images/pet/kaka/spritesheet.webp`
- Create: `assets/images/pet/kaka/pet.json`

- [ ] **Step 1: 准备 hatch-pet 运行目录**

使用 `prepare_pet_run.py` 写入角色、材质、色彩、chroma key 和九状态 prompt。

- [ ] **Step 2: 生成主形象**

使用 `image_api.py --model gpt-image-2 --quality high` 生成单只居中的完整卡卡，复制到 `decoded/base.png` 和 `references/canonical-base.png`。

- [ ] **Step 3: 生成动作条**

每次最多并行两个 Image API 请求；每一行都附带 canonical base 与对应 layout guide。右行动画确认可镜像后，用 hatch-pet 脚本生成左行动画。

- [ ] **Step 4: 组合和校验**

依次运行 `extract_strip_frames.py`、`inspect_frames.py`、`compose_atlas.py`、`validate_atlas.py`、`make_contact_sheet.py` 和 `render_animation_previews.py`。

- [ ] **Step 5: 视觉 QA 与打包**

检查联系表和九组 GIF；通过后把 WebP 与 `pet.json` 放进应用资产目录，并保留 run summary 和 QA 证据。

### Task 3: 替换精灵渲染器

**Files:**
- Modify: `src/pet/PetSprite.tsx`
- Modify: `src/pet/index.ts`

- [ ] **Step 1: 基于已通过的纯函数契约实现裁切渲染**

使用 `expo-image` 加载静态 WebP，在固定宽高且 `overflow: hidden` 的容器中按行列位移完整图集。

- [ ] **Step 2: 实现逐帧计时与减少动态效果**

状态变化时从首帧开始，按 `PET_ANIMATIONS` 中持续时间推进；启用减少动态效果时不启动计时器。

- [ ] **Step 3: 验证类型与定向测试**

Run: `npx tsc --noEmit`

Expected: PASS。

### Task 4: 接入真实桌宠交互

**Files:**
- Create: `src/pet/FloatingPet.tsx`
- Modify: `src/pet/GlobalPet.tsx`
- Modify: `src/pet/PetContext.tsx`
- Modify: `src/pet/PetChatPanel.tsx`

- [ ] **Step 1: 加入拖动容器**

用 `PanResponder` 驱动 `Animated.ValueXY`，限制在安全可视区域；拖动时按水平增量选择左右行动画，释放后恢复当前情绪。

- [ ] **Step 2: 保留点击和气泡交互**

轻触继续打开对话；气泡随宠物移动且可关闭；AI 页继续隐藏重复入口。

- [ ] **Step 3: 修正状态交接**

结束 AI 思考后再展示成功或失败反馈，避免 `notifyThinking(false)` 立即清除结果气泡；打开空闲对话面板时使用 `waiting`。

- [ ] **Step 4: 运行宠物测试**

Run: `npm test -- src/pet`

Expected: PASS。

### Task 5: 整体验证

**Files:**
- Modify only if verification exposes a task-related defect.

- [ ] **Step 1: 静态质量门禁**

Run: `npm test && npx tsc --noEmit && npm run lint`

Expected: all PASS。

- [ ] **Step 2: 启动 Web 应用**

Run: `EXPO_OFFLINE=1 npm run web -- --localhost --port 57373`

Expected: Expo 开发服务器可访问。

- [ ] **Step 3: 浏览器验收**

在桌面与移动视口检查图集非空、透明背景、无重叠，验证待机动画、拖动方向、点击对话和打卡反馈。

- [ ] **Step 4: 检查最终差异**

确认未覆盖用户已有修改，未包含密钥、临时生成源图或无关文件。
