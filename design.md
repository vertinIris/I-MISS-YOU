# Design — 飞行雪绒 × 星炬学院

双品牌锁定系统。两站气质必须可一眼区分；禁止同款换色皮。

## Research notes（依据）

- **资料优先级**：鸣潮官方 ＞ 同人共识补白 ＞ 项目原创（详见 `docs/WORLDVIEW.md`）。
- **鸣潮**：索拉里斯后启示录 × 机能风 × 低饱和高级感；声骸/调谐/频率意象；黑海岸清冷守望（以官方情报为准，维基仅交叉核对）。
- **飞行雪绒**：爱弥斯歌手化名；粉发墨镜夜航感；歌友会/电台/「I miss you」思念频道（官方角色设定 + 本站频道演绎）。
- **星炬学院**：学院/深空联合相关公共研讨场；毕业曲《星炬不熄》；蓝金星炬而非粉雪（官方企划文案优先）。
- **UI 原则**：OLED 夜电台（ui-ux-pro-max Dark Mode OLED）+ 学院 navy/gold（Academic Journal palette，改暗场）；电台/夜航 UI 吸收「频率、私密、低发光」原则，不抄像素。

## Genre

| 站 | Genre | Macrostructure | Nav | Footer |
|---|---|---|---|---|
| 飞行雪绒 | atmospheric（custom Midnight-Rose） | Letter × Marquee Hero | N9 edge-minimal soft | Ft5 statement |
| 星炬学院 | modern-minimal × academic | Ecosystem Index | N6 masthead（学院版） | Ft1 mast-headed |

## 飞行雪绒 — tokens

- Paper: `oklch(12% 0.02 350)` 玫夜墨
- Accent: `oklch(72% 0.14 350)` 雪绒粉（非紫白套路）
- Mist: 粉白雾 `oklch(92% 0.03 350)`
- Display: ZCOOL XiaoWei + Noto Serif SC
- Body: Noto Sans SC
- Mono: IBM Plex Mono（调频数字）
- Radius: 软圆 16–22px
- Motion: 品牌呼吸 · 调频微脉冲 · 滚动淡入（仅 transform/opacity）

## 星炬学院 — tokens

- Paper: `oklch(14% 0.03 250)` 学院深蓝
- Brand: `oklch(68% 0.12 255)` 星炬蓝
- Gold: `oklch(78% 0.12 85)` 仅签发/精华/通行证
- Display: Noto Serif SC
- Body: Noto Sans SC
- Mono: JetBrains Mono（学号/频段）
- Radius: 锐角感 6–10px
- Motion: 灯芯点亮 · 侧栏滑入 · 帖卡边光（克制）

## What MUST differ

- 色相家族、圆角语言、标题字重节奏、导航形态、表面材质（雪绒雾面 vs 学院冷金属）
- 主站允许粉星云/轻雪；论坛禁止粉铺底

## Performance

- 禁止恢复全屏 blur 叠乘；粒子保持懒加载；尊重 `prefers-reduced-motion` 与现有 `fxre-anim-paused`
