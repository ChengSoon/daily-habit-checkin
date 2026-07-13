# 程序化世界地图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or implement task-by-task in-session. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 将死地图（固定底图 + 硬编码锚点）改为章节驱动的可自动延伸程序化路径地图。

**Architecture:** 纯函数 `mapLayout` 按章节数计算画布高度与左右交替节点坐标；`WorldMapCanvas` 去掉定长 PNG，改用可延伸渐变背景 + 原有路径/节点渲染。业务解锁规则与 API 不变。

**Tech Stack:** TypeScript, React Native, react-native-svg, vitest, Expo

**Spec:** `docs/superpowers/specs/2026-07-12-procedural-world-map-design.md`

---

## 文件地图

| 文件 | 职责 |
| --- | --- |
| `src/adventure/mapLayout.ts` | 布局常量、高度公式、节点坐标、路径 d、layoutChapters |
| `src/adventure/mapLayout.test.ts` | 布局不变量单测 |
| `src/adventure/WorldMapCanvas.tsx` | 接新 layout + 渐变背景渲染 |
| `app/adventure/map.tsx` | 仅必要时微调（默认不动） |

---

### Task 1: TDD 重写 mapLayout

**Files:**
- Modify: `src/adventure/mapLayout.ts`
- Modify: `src/adventure/mapLayout.test.ts`

- [x] **Step 1: 重写失败测试**

用新 API 断言：`layoutChapters` / `buildMapLayout` 高度随 N 增长、cy 递减、x 在安全区、路径含 Q。

- [x] **Step 2: 实现布局引擎**

删除 `CHAPTER_MAP_POINTS` / `THEME_MAP_POINTS` / `resolveMapPoint` 查表。
实现常量与公式（见 design）：

```
SEGMENT_H=108, PAD_TOP=72, PAD_BOTTOM=88, WIDTH=360, nodeRadius=28, pathWidth=6
amp=0.22, x clamp [0.18,0.82]
cy = H - PAD_BOTTOM - i * SEGMENT_H
```

- [x] **Step 3: 跑单测通过**

Run: `npx vitest run src/adventure/mapLayout.test.ts`

---

### Task 2: WorldMapCanvas 接程序化布局

**Files:**
- Modify: `src/adventure/WorldMapCanvas.tsx`

- [x] **Step 1:** 用 `layoutChapters(ordered, { width })` 替代 `resolveMapPoint`
- [x] **Step 2:** 画布高度来自 layout.height * scale
- [x] **Step 3:** 去掉 `world-map.png`；Svg 纵向渐变 + 轻色带
- [x] **Step 4:** 保留路径高亮、节点状态、点击

---

### Task 3: 验证

- [x] `npx vitest run src/adventure`
- [x] 确认无残留 `CHAPTER_MAP_POINTS` / `resolveMapPoint` / `WORLD_MAP_IMAGE` 引用（除 assets 文件可暂留）

---

### 非目标

- 不改 server / admin / 解锁规则
- 不做 Region / 坐标 override / 自动滚动
