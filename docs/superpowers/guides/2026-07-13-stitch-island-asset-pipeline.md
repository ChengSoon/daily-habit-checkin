# Stitch 岛屿素材流程（透明岛图）

## 目标

用 Google Stitch 批量产出 **2.5D 立体岛屿精灵图**，经抠图后成为：

- 管理端「自定义岛屿形象」上传用的 **透明 PNG**
- 或内置默认主题岛：`assets/images/adventure/islands/{theme}.png`

并避免白底矩形包住岛屿。

## 前置条件

1. Stitch 已鉴权（任选其一）
   - 交互：`npx -y stitch-design-cli auth set`
   - 环境变量：`export STITCH_API_KEY=...`
2. 本机有 Python3 + Pillow（抠图切片用）
3. 项目已支持：
   - 上传 MIME：jpeg / png / webp / **gif**
   - 岛屿选图会 **保留 PNG 透明**（不再压成 JPEG）

检查鉴权：

```bash
npx -y stitch-design-cli doctor --json
npx -y stitch-design-cli project list --json
```

## 总流程（一页看懂）

```
Stitch 出图（绿幕/纯色底）
    → 下载 screenshot
    → chroma key 抠透明
    → 裁切单岛 / 切片精灵表
    → 预览棋盘格确认透明
    → 管理端上传 或 放入 assets/islands
```

**关键原则：**

- 岛图必须有 **alpha 透明**，不能是白底 JPG。
- Stitch 往往出的是 **带背景的整屏图**，不能直接当精灵用，**必须抠图**。
- 背景图（海/天空）与岛图分开做；岛图只画岛。

---

## 阶段 0：准备 Stitch 项目

### 复用已有项目

```bash
npx -y stitch-design-cli project list --json
# 记下 projectId，例如双人冒险相关项目
```

### 或新建

```bash
npx -y stitch-design-cli project create --title "Adventure Island Assets" --json
```

下文用 `PROJECT_ID` 表示。

---

## 阶段 1：生成「绿幕单岛」或「绿幕六岛表」

### 推荐 A：一次 6 主题精灵表（默认包）

适合：`lighthouse / forest / market / camp / bridge / summit`

```bash
npx -y stitch-design-cli screen generate \
  --project-id "$PROJECT_ID" \
  --device-type MOBILE \
  --include-image \
  --json \
  --prompt "$(cat <<'PROMPT'
Design a pure mobile game ASSET sprite sheet (not an app UI screen).

Canvas: mobile vertical.
Background: perfectly flat solid pure chroma green #00FF00 only.
No gradients, no shadows on the background, no ocean plane, no floor, no UI chrome.

Layout: exactly 6 separate isolated 2.5D floating islands in a 2-column x 3-row grid,
with generous empty green space between islands for clean cropping later.

Style: soft painterly casual mobile game art, warm daylight, readable silhouette,
visible cliff thickness (2.5D volume), polished, no watermark.

Islands (in order):
1) Top-Left: sandy coastal lighthouse island with small beacon
2) Top-Right: lush pine forest island
3) Middle-Left: riverside market island with colorful stalls
4) Middle-Right: camping island with tent and campfire
5) Bottom-Left: misty arched bridge island
6) Bottom-Right: snowy mountain summit island with tiny cabin

ABSOLUTELY NO text, numbers, labels, buttons, frames, logos, or watermarks.
Each island is a single prop asset only.
PROMPT
)"
```

记下返回的 `screenId`。

### 推荐 B：单岛精修（某一章自定义）

```bash
npx -y stitch-design-cli screen generate \
  --project-id "$PROJECT_ID" \
  --device-type MOBILE \
  --include-image \
  --json \
  --prompt "$(cat <<'PROMPT'
Pure game asset: ONE floating 2.5D island only.

Subject: [在这里写主题，例如 dark volcanic demon island with lava rivers and gothic ruins]

Style: soft painterly mobile game prop, isometric/three-quarter view, clear silhouette,
cliff thickness, centered, fills ~70% of frame, generous padding.

Background: perfectly flat solid pure chroma green #00FF00.
No white background, no gradient, no floor plane, no ocean, no UI, no text, no watermark.
PROMPT
)"
```

### 若已有图要改成绿幕版

```bash
npx -y stitch-design-cli screen edit \
  --project-id "$PROJECT_ID" \
  --screen-id "$SCREEN_ID" \
  --include-image \
  --json \
  --prompt "Keep the same island design. Replace any white/sky/photo background with a perfectly flat solid pure chroma green #00FF00. No shadows on the background. Do not add text or UI."
```

---

## 阶段 2：拉取截图

```bash
npx -y stitch-design-cli screen get \
  --project-id "$PROJECT_ID" \
  --screen-id "$SCREEN_ID" \
  --include-image \
  --json > /tmp/stitch-island.json
```

从 JSON 取 `data.imageUrl`（或 `data.data.screenshot.downloadUrl`），下载最大图：

```bash
URL="$(python3 - <<'PY'
import json
from pathlib import Path
data=json.loads(Path('/tmp/stitch-island.json').read_text())
print(data['data'].get('imageUrl') or data['data']['data']['screenshot']['downloadUrl'])
PY
)"

curl -L --fail -o /tmp/stitch-island-raw.jpg "${URL}=s0"
file /tmp/stitch-island-raw.jpg
```

---

## 阶段 3：抠透明 + 切片

### 3.1 绿幕抠图（单岛或整表）

```bash
python3 - <<'PY'
from PIL import Image
from pathlib import Path

src = Image.open('/tmp/stitch-island-raw.jpg').convert('RGBA')
px = src.load()
w, h = src.size
out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
op = out.load()

for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        # 绿幕：G 明显高于 R/B
        if g > 140 and g > r + 25 and g > b + 25:
            continue
        # 边缘去绿溢色
        if g > r and g > b:
            g = min(g, (r + b) // 2 + 12)
        op[x, y] = (r, g, b, 255)

out.save('/tmp/stitch-island-rgba.png')
print('saved /tmp/stitch-island-rgba.png', out.size)
PY
```

### 3.2 六岛表切成 6 张主题图

布局约定：2 列 × 3 行，顺序：

| 位置 | 主题 key |
| --- | --- |
| 上左 | lighthouse |
| 上右 | forest |
| 中左 | market |
| 中右 | camp |
| 下左 | bridge |
| 下右 | summit |

```bash
python3 - <<'PY'
from PIL import Image
from pathlib import Path

sheet = Image.open('/tmp/stitch-island-rgba.png').convert('RGBA')
W, H = sheet.size
cell_w, cell_h = W // 2, H // 3
keys = [
    ('lighthouse', 0, 0),
    ('forest', 0, 1),
    ('market', 1, 0),
    ('camp', 1, 1),
    ('bridge', 2, 0),
    ('summit', 2, 1),
]
out_dir = Path('assets/images/adventure/islands')
out_dir.mkdir(parents=True, exist_ok=True)

def trim_square(im: Image.Image, size=768, pad=10) -> Image.Image:
    alpha = im.split()[-1]
    box = alpha.point(lambda p: 255 if p > 12 else 0).getbbox()
    if not box:
        return Image.new('RGBA', (size, size), (0, 0, 0, 0))
    l, t, r, b = box
    l, t = max(0, l - pad), max(0, t - pad)
    r, b = min(im.width, r + pad), min(im.height, b + pad)
    cropped = im.crop((l, t, r, b))
    side = max(cropped.width, cropped.height)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(cropped, ((side - cropped.width) // 2, (side - cropped.height) // 2), cropped)
    if side != size:
        canvas = canvas.resize((size, size), Image.Resampling.LANCZOS)
    return canvas

for key, row, col in keys:
    cell = sheet.crop((col * cell_w, row * cell_h, (col + 1) * cell_w, (row + 1) * cell_h))
    island = trim_square(cell)
    path = out_dir / f'{key}.png'
    island.save(path)
    print('wrote', path, path.stat().st_size)

print('done')
PY
```

### 3.3 单岛居中导出（管理端上传用）

```bash
python3 - <<'PY'
from PIL import Image
from pathlib import Path

im = Image.open('/tmp/stitch-island-rgba.png').convert('RGBA')
a = im.split()[-1]
box = a.point(lambda p: 255 if p > 12 else 0).getbbox()
cropped = im.crop(box)
side = max(cropped.width, cropped.height, 512)
canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
canvas.paste(cropped, ((side - cropped.width)//2, (side - cropped.height)//2), cropped)
canvas = canvas.resize((768, 768), Image.Resampling.LANCZOS)
out = Path('/tmp/island-custom.png')
canvas.save(out)
print('upload this:', out)
PY
```

---

## 阶段 4：验收清单（必做）

在电脑上打开 PNG：

- [ ] 岛外应是 **透明/棋盘格**，不是白色矩形  
- [ ] 岛主体完整、无大块绿边  
- [ ] 无文字/水印/UI  
- [ ] 大约居中，四周有透明边距  

快速自检脚本：

```bash
python3 - <<'PY'
from PIL import Image
im = Image.open('assets/images/adventure/islands/lighthouse.png')  # 或你的路径
print('mode', im.mode, 'size', im.size)
# 四角应接近全透明
for p in [(2,2), (im.width-3,2), (2,im.height-3), (im.width-3,im.height-3)]:
    print(p, im.getpixel(p))
PY
```

四角 `A` 通道应接近 `0`。若是 `(255,255,255,255)` 说明仍是白底。

---

## 阶段 5：接入 App

### 路径 A：默认主题岛（改包内资源）

1. 覆盖 `assets/images/adventure/islands/*.png`  
2. 确认 `src/adventure/mapAssets.ts` 的 key 与文件名一致  
3. 重启 Metro / 热重载  

### 路径 B：某一章自定义（运营向）

1. 管理端 → 闯关章节 → 编辑对应章  
2. 「自定义岛屿形象」上传 **透明 PNG**（或 GIF）  
3. 可选：「自定义岛屿背景」上传整屏风景（JPG/PNG/GIF 均可）  
4. 保存后打开世界地图验证  

**注意：** 必须走「岛屿形象」上传；不要用会压成 JPEG 的旧奖励图路径。当前 adventure 选图会保留 PNG 透明。

---

## 阶段 6：背景图（可选，单独做）

背景 **不需要透明**，可单独生成竖图：

```text
vertical mobile game map background only, soft painterly ocean-to-sky gradient,
no islands, no characters, no text, no UI, calm atmosphere, seamless vertical scroll feel
```

上传到章节的「自定义岛屿背景」。岛图与背景分离，白底问题只发生在岛图上。

---

## 提示词模板库

### 单岛通用骨架

```text
Pure game asset: ONE floating 2.5D island only.
Subject: {主题描述}
Style: soft painterly mobile game prop, three-quarter view, cliff thickness, centered,
fills about 70% of frame, generous padding.
Background: perfectly flat solid pure chroma green #00FF00.
No white background, no floor, no ocean plane, no text, no UI, no watermark.
```

### 主题示例

| key | Subject 片段 |
| --- | --- |
| lighthouse | sandy coastal lighthouse island with palm trees and small beacon |
| forest | lush evergreen forest island with pine trees and a dirt path |
| market | riverside market island with colorful stalls and wooden pier |
| camp | night camping island with tent, campfire and soft hills |
| bridge | misty floating island with a stone arched bridge |
| summit | snowy mountain peak island with tiny cabin and flag |

### 禁止项（每次都写）

```text
no white background, no pure white canvas, no photo backdrop,
no text, no numbers, no UI chrome, no frames, no watermarks, no logos
```

---

## 常见问题

### 1. 地图上出现白色方块

| 原因 | 处理 |
| --- | --- |
| 资源是白底 JPG/PNG | 绿幕重出或去背后再传 |
| 上传时被压成 JPEG | 已修复；用 adventure 上传并重新传 PNG |
| 只抠了一半仍有白边 | 收紧裁切 / 加强抠图阈值 |

### 2. Stitch 出了 App 界面而不是素材

提示词开头写清：`pure game asset sprite sheet (not an app UI screen)`，并强调 `NO UI`。

### 3. 绿幕抠不干净

- 背景必须写 **flat solid #00FF00**  
- 岛上避免大面积纯绿植被贴边（可用深绿/黄绿）  
- 抠完检查四角 alpha  

### 4. GIF 动态岛

- Stitch 截图多为静态；动态建议：透明静态 PNG + 代码浮动，或外部做 GIF 再上传  
- GIF 上传走 adventure 选图，会原样保留动画  

---

## 建议的日常节奏

| 场景 | 动作 |
| --- | --- |
| 换全套默认岛 | 精灵表生成 → 切片 → 覆盖 `assets/.../islands` |
| 某一章特别装扮 | 单岛生成 → 抠图 → 管理端上传该章 |
| 只换氛围 | 只上传背景，不换岛 |
| 迭代造型 | `screen edit` 同一 screenId，保留构图只改主题 |

---

## 命令速查

```bash
# 健康检查
npx -y stitch-design-cli doctor --json

# 列项目 / 列屏
npx -y stitch-design-cli project list --json
npx -y stitch-design-cli screen list --project-id "$PROJECT_ID" --json

# 生成 / 编辑 / 拉取
npx -y stitch-design-cli screen generate --project-id "$PROJECT_ID" --prompt "..." --device-type MOBILE --include-image --json
npx -y stitch-design-cli screen edit --project-id "$PROJECT_ID" --screen-id "$SCREEN_ID" --prompt "..." --include-image --json
npx -y stitch-design-cli screen get --project-id "$PROJECT_ID" --screen-id "$SCREEN_ID" --include-image --json
```

---

## 与代码的对应关系

| 产物 | 代码字段 / 路径 |
| --- | --- |
| 默认主题岛 PNG | `assets/images/adventure/islands/{mapThemeKey}.png` → `mapAssets.ts` |
| 章节自定义岛 | `adventure_chapters.node_image_key` |
| 章节自定义背景 | `adventure_chapters.background_image_key` |
| 主题键 | `map_theme_key`：lighthouse/forest/market/camp/bridge/summit |

完成一次完整流程后，用世界地图滑动到对应岛验收：岛应「浮」在主题渐变/自定义背景上，四周无白框。
