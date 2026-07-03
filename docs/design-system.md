# UI/UX 设计系统

> **版本**: v7.7 | **设计理念**: 融合「爱弥斯」温柔粉白与「漂泊者」深邃星空

---

## 1. 色彩系统

### 1.1 品牌色

| 名称 | Hex | 用途 |
|------|-----|------|
| 爱弥斯粉 | `#FF6B9D` | 主色调，按钮、强调、爱心 |
| 漂泊者蓝 | `#6B8AFF` | 次色调，链接、头像、雪花 |
| 浅粉 | `#FFB6D9` | 渐变中间色、hover态 |
| 浅蓝 | `#A8D8FF` | 渐变中间色、雪花高光 |
| 梦幻紫 | `#B66BFF` | 渐变中间色、特殊强调 |
| 深空黑 | `#0A0A12` | 暗色模式背景 |
| 星耀金 | `#FFD700` | 仅点缀，极度克制 |

### 1.2 CSS 变量

```css
:root {
    /* 品牌色 */
    --aimisi-pink: #FF6B9D;
    --aimisi-white: #FFFFFF;
    --aimisi-gold: #FFD700;

    --drifter-blue: #6B8AFF;
    --drifter-purple: #B66BFF;
    --drifter-starlight: #A8D8FF;

    --spectral-cyan: #00CED1;

    /* 背景色 */
    --bg-dark: #07070E;
    --bg-card: rgba(255, 255, 255, 0.06);

    /* 文字 */
    --text-primary: #FAF8FF;
    --text-secondary: rgba(250, 248, 255, 0.7);

    /* 按钮交互 */
    --btn-transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    --scale-hover: scale(1.03);
    --scale-active: scale(0.96);

    /* 玻璃拟态 */
    --glass-blur: blur(20px);
    --glass-bg: rgba(255, 255, 255, 0.06);
    --glass-border: rgba(255, 255, 255, 0.12);
}
```

### 1.3 动态渐变

```css
/* 6秒循环流动的彩虹渐变 */
background: linear-gradient(
    90deg,
    #FF6B9D, #FFB6D9, #B66BFF,
    #6B8AFF, #A8D8FF, #FFFFFF,
    #FF6B9D
);
background-size: 400% 100%;
animation: gradientShift 6s linear infinite;
```

---

## 2. 字体系统

### 2.1 字体栈

```css
/* 正文 */
font-family: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei',
             sans-serif;

/* 日志/标题 */
font-family: 'Noto Serif SC', 'Source Han Serif SC', 'SimSun',
             serif;

/* 代码/数字 */
font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
```

### 2.2 字号层级

| 用途 | 大小 | 字重 | 行高 |
|------|------|------|------|
| Hero 标题 | 3.5rem (56px) | 700 | 1.2 |
| Section 标题 | 2rem (32px) | 700 | 1.3 |
| 卡片标题 | 1.25rem (20px) | 600 | 1.4 |
| 正文 | 1rem (16px) | 400 | 1.6 |
| 辅助文字 | 0.875rem (14px) | 400 | 1.5 |
| 标签/徽章 | 0.75rem (12px) | 500 | 1.4 |

---

## 3. 组件设计

### 3.1 按钮系统（鸣潮共振按钮 v6）

四种角色色按钮，统一四态交互：

| 按钮 | 类名 | 角色色 | 动效 |
|------|------|--------|------|
| 查看动态 | `.btn-primary` | 爱弥斯（粉白金） | aimisiFlow 8s + aimisiCore 6s + aimisiShimmer 5s |
| 认识飞行雪绒 | `.btn-ghost` | 漂泊者（深空蓝紫） | nebulaDrift 10s + starTrail + starTwinkle |
| 我的音乐 | `.btn-music` | 双形态（黑胶+频谱） | vinylSpin 12s + soundwaveRotate 4s |
| 尝试连接信号 | `.egg-btn` | 信号（青蓝紫粉） | signalFlow 6s + signalScan 4s + signalPulse 3s |

**四态交互**:
```css
.btn { transition: var(--btn-transition); }
.btn:hover  { transform: translateY(-3px) var(--scale-hover); }
.btn:active { transform: var(--scale-active); }
.btn:disabled { filter: grayscale(0.6) brightness(0.7); }
.btn:focus-visible { outline: 2px solid var(--aimisi-pink); }
```

**共振特效（JS）**:
- 点击涟漪: `resonance-ripple` 0.6s 扩散动画
- 悬停粒子: 每120ms发射一个角色色粒子

### 3.2 玻璃拟态卡片

```css
.glass-card {
    background: var(--glass-bg);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: 1px solid var(--glass-border);
    border-radius: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

/* 降级：不支持 backdrop-filter 的浏览器 */
@supports not (backdrop-filter: blur(20px)) {
    .glass-card {
        background: rgba(20, 20, 35, 0.85);
    }
}
```

### 3.3 评论组件

```
┌─────────────────────────────────────────┐
│  ┌────┐  用户昵称              2分钟前   │
│  │头像│  ──────────────────────────────  │
│  └────┘  评论内容文字...                │
│                                  [删除]  │  ← 仅作者10分钟内/管理员可见
└─────────────────────────────────────────┘
```

### 3.4 同步状态指示器

```
页脚区域:
  ☁ 本地模式                          [🔄]  ← v7.7 主动同步按钮
  ✅ 云端在线 · user f95fa4cd · 待同步: 0  [🔄]
  ⚠️ 同步失败 · 点击查看详情              [🔄]
  ⏳ 检测中...                           [🔄]
```

---

## 4. 动画系统

### 4.1 背景动画（多层叠加）

| 层级 | 元素 | 动画 | 速度 |
|------|------|------|------|
| L1 | 粉色星河 `.pink-galaxy` | 径向渐变脉动 | 8s |
| L2 | 星河光带 `.galaxy-river` | 横向流动 + 旋转 | 20s |
| L3 | Three.js 粒子 / CSS 雪花 | 3D旋转 / 垂直下落 | 可变 |
| L4 | 流星 `.shooting-star` | 随机方向划过 | 递归setTimeout |
| L5 | 闪光粒子 `.sparkle` | 浮动 + 闪烁 | 3-5s |
| L6 | 爱弥斯大招背景 `.ult-energy-core` | 中心脉动光球 | 4s |

### 4.2 流星随机化系统（v4）

```javascript
// 4种模式随机切换
// 连发模式 (15%): 2-4颗流星快速连射
// 快速模式 (25%): 单颗快速流星
// 普通模式 (35%): 标准流星
// 长暂停模式 (25%): 安静时刻

// 每颗流星独立随机: 大小/速度/角度/尾迹长度/光强
```

### 4.3 雪花系统（v4 统一设计）

```
导航栏/页脚 logo:
  2层（主臂 + 分叉枝）+ 核心圆 + 尖端圆点
  蓝白渐变 (#A8D8FF → #6B8AFF → #FFFFFF)
  rotate-slow 旋转动画

彩蛋雪花:
  3层（主臂 + 二级分叉 + 三级细枝）
  Gaussian Blur 发光 + 径向渐变核心
  snowFloat + snowRotate + snowGlow 三重动画
```

### 4.4 CSS 降级雪花（v5 层次差异化）

```
40% 轻盈层:
  - 半透明 (opacity: 0.3-0.5)
  - 小尺寸 (3-5px)
  - 模糊 (filter: blur(1px))
  - 淡蓝白色

60% 饱满层:
  - 高白度 (opacity: 0.8-1.0)
  - 大尺寸 (5-8px)
  - 白色发光阴影 (box-shadow: 0 0 4px #fff)
```

---

## 5. 响应式设计

### 5.1 断点

```css
/* 移动端 */
@media (max-width: 768px) {
    /* 单列布局，字号缩小，导航折叠 */
}

/* 平板 */
@media (max-width: 1024px) {
    /* 两列网格 */
}

/* 桌面 */
/* 默认样式，最大宽度 1200px 居中 */
```

### 5.2 触摸适配

- 所有可点击元素最小 44×44px 触摸区域
- `touch-action: manipulation` 消除 300ms 延迟
- 长按事件（头像气泡）使用 800ms 阈值
- 评论展开/收起使用 tap 事件

---

## 6. 主题系统

三模式循环切换（dark → light → auto），localStorage 持久化。

```javascript
// 主题切换逻辑
var themes = ['dark', 'light', 'auto'];
var current = localStorage.getItem('fxre_theme') || 'dark';
var next = themes[(themes.indexOf(current) + 1) % 3];

// auto 模式跟随系统偏好
if (next === 'auto') {
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
}
```

### 暗色模式调优（v4）

- 背景 `#07070E`（更深）
- 文字 `#FAF8FF`（更亮）
- 星光 opacity 0.75
- 玻璃透明度微降
- 背景渐变光晕降低饱和度

---

## 7. 视觉素材规范

### 7.1 无外部图片依赖

所有视觉素材通过 CSS/SVG 生成：
- 主角头像：内联 SVG（长发 + 眼高光 + 机兵暗示线条）
- 时间线小头像：内联 SVG（6个统一风格）
- 评论头像：CSS 圆形 + 首字母 + 角色色背景
- 雪花 logo：内联 SVG
- 配图：CSS 渐变 + 动画

### 7.2 SVG 头像规范

```
主头像:
  - hairGrad 渐变长发
  - 眼睛: sparkle（内侧白色 + 外侧 light blue）
  - 腮红: 粉色径向渐变
  - 胸前: 雪花 + 金星星
  - 机兵暗示线条

小头像 (6个):
  - 统一风格: 长发 + 粉白配色 + 蓝眼高光
  - 腮红 + 胸雪花 + 双侧金星
  - 各自独立 gradient ID 避免 SVG 冲突
```

---

## 8. 地点选择器（v4 官方化）

Hero 徽章改造为下拉选择器，5个鸣潮官方地点：

| 地点 | 描述 |
|------|------|
| 星炬学院 | 爱弥斯就读的学院 |
| 拉贝尔学部 | 爱弥斯所在的学部 |
| 拉海洛 | 城市名 |
| 雪原小屋 | 静谧之地 |
| 电子海 | 数字空间 |

交互：click 事件 toggle `.open` 类 + localStorage 持久化（`fxre_location`）

---

## 9. 音乐模块设计

### 9.1 Web Audio API 合成链路

```
OscillatorNode (波形)
    → GainNode (ADSR包络)
        → BiquadFilter (滤波)
            → masterGain (主音量)
                → AnalyserNode (频谱分析)
                    → destination (输出)
```

### 9.2 音色定义

| 音色 | 波形 | 滤波 | 特点 |
|------|------|------|------|
| piano | sine | 无 | 温暖纯净 |
| electronic | sawtooth | lowpass | 电子质感 |
| crystal | dual sine | 无 | 空灵清透 |
| dual | piano + metallic | 无 | 双层叠加 |
| drone | sine + noise | 无 | 氛围嗡鸣 |

### 9.3 Canvas 可视化

```javascript
// 频谱条可视化
var dataArray = new Uint8Array(analyser.frequencyBinCount);
analyser.getByteFrequencyData(dataArray);

var gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
gradient.addColorStop(0, '#FF6B9D');
gradient.addColorStop(0.5, '#6B8AFF');
gradient.addColorStop(1, '#B66BFF');

// 绘制频谱条
for (var i = 0; i < bars; i++) {
    var height = (dataArray[i] / 255) * canvas.height;
    ctx.fillStyle = gradient;
    ctx.fillRect(x, canvas.height - height, barWidth, height);
}
```
