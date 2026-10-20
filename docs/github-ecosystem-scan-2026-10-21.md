# GitHub 高星生态扫描 — 飞行雪绒技术补充

> 扫描日期：2026-10-21 · 门槛：GitHub Stars ≥ 10K（或 2024 后创建的爆发式新星）
> 工具：GitHub Repository Search API（topic / stars / created 组合过滤）

---

## 一、扫描结论速览

| 结论 | 说明 |
|---|---|
| 已装 10 个 | vendor/ 早期已自托管 DOMPurify / Notyf / lazysizes / marked / highlight.js / PhotoSwipe / Just-Validate / Font-Awesome / anime.js / MDI，本次不重复下载 |
| 本次新增 4 个 | Fuse.js、howler.js、canvas-confetti、Day.js |
| 新增总体积 | 79.2 KB（未 gzip），均为零依赖独立文件 |
| 考察后放弃 8 个 | 见第四节，原因：功能重叠 / 体积不划算 / 与项目架构冲突 |

---

## 二、本次下载清单（已落地 vendor/）

| 库 | Stars | 版本 | 体积 | 浏览器全局名 | 对本项目的填补 |
|---|---|---|---|---|---|
| **Fuse.js** | 20.5K | 6.6.2 | 23.5 KB | `window.Fuse` | 论坛/主站**客户端模糊搜索**。当前搜索依赖 `migration-029` 的 Postgres RPC，离线或 RPC 失败时无降级；Fuse 可在本地数据集上直接检索 |
| **howler.js** | 25.4K | 2.2.4 | 36.2 KB | `window.Howl` / `Howler` | 夜电台+音乐页的**音频播放层**：移动端 autoplay unlock、Web Audio↔HTML5 自动回退、音量淡入淡出。现有原生 Web Audio 手写逻辑可由它兜底 |
| **canvas-confetti** | 12.8K | 1.9.4 | 10.8 KB | `window.confetti` | 点赞/投稿成功/9072 连点彩蛋的**粒子反馈**。自带 `snow` 预设，与"雪绒"主题天然契合；canvas 默认 `pointer-events:none`，不会拦截彩蛋挂载点点击 |
| **Day.js** | 48.7K | 1.11.23 | 7.2 KB（+1.4 KB zh-cn） | `window.dayjs` | 统一时间线/投稿/评论的**时间格式化**，替掉各处手写 `Intl` 逻辑。核心仅 2KB gzip |

**校验状态**：5 个文件全部 `node --check` 通过；Fuse.js 在模拟浏览器全局环境下实跑，中文模糊查询命中正确（`"爱弥"` → `爱弥斯与漂泊者`）。
**SRI**：全部为 sha384，已写入 `vendor/manifest.json`（与既有 14 个库同格式，含 `integration` / `usage` / `note` 字段）。

### 接入片段

```html
<!-- Fuse.js — 论坛/主站搜索降级 -->
<script src="vendor/fuse/fuse.min.js"
        integrity="sha384-zPE55eyESN+FxCWGEnlNxGyAPJud6IZ6TtJmXb56OFRGhxZPN4akj9rjA3gw5Qqa"
        crossorigin="anonymous"></script>

<!-- howler.js — 音频层 -->
<script src="vendor/howler/howler.min.js"
        integrity="sha384-SSf4pKRrGaeWL8bdA89QvGkhZo5WvIVCGwKVzfX7z+9sSaIHtE/AkOLehofI4JVY"
        crossorigin="anonymous"></script>

<!-- canvas-confetti — 彩蛋/庆祝动效（按需页加载） -->
<script src="vendor/canvas-confetti/confetti.browser.min.js"
        integrity="sha384-JSZXO0kKYHTylAsDYTb+7Kg2eUyalm19b8Pydcdf8sQ1cCKYZr9lLahoKT9+LFY5"
        crossorigin="anonymous" defer></script>

<!-- Day.js + 中文语言包 -->
<script src="vendor/dayjs/dayjs.min.js"
        integrity="sha384-1Ft4/JTNbt7S/44V0himpcjx+YfQ1a6W6SYBJMr94ba6jwZhWoWoLaZsMmtJILgq"
        crossorigin="anonymous"></script>
<script src="vendor/dayjs/zh-cn.js"
        integrity="sha384-JlOvD9rwLmKdB9EoDKPPtxT02Btalz7oisrWI0tS0cwjMnTvZB9ww5BpcPAnhn+a"
        crossorigin="anonymous"></script>
```

---

## 三、扫描到的其他高星项目（未下载，分档评估）

### A 档 — 与 vendor 已有库功能重叠，不重复安装

| 项目 | Stars | 重叠对象 |
|---|---|---|
| PhotoSwipe | 25.3K | 已装（5.4.4） |
| DOMPurify | 17.5K | 已装（3.2.7） |
| anime.js | 73.7K | 已装（4.5.0） |

### B 档 — 有价值但当前优先级不高，留作备选

| 项目 | Stars | 评估 |
|---|---|---|
| wavesurfer.js | 10.4K | 音频波形可视化。**风险**：页脚频谱 EQ 是本站家族签名，替换会破坏品牌一致性；建议仅在音乐页做独立组件，不动页脚 |
| FlexSearch | 13.8K | 比 Fuse 更重的全文索引引擎。数据量破千条再考虑，当前论坛规模 Fuse 足够 |
| date-fns | 36.6K | 功能比 Day.js 全，但 tree-shaking 前体积大得多，不适合无打包器的静态站 |
| GSAP | 29.5K | 动画能力最强，但与已装的 anime.js 定位冲突，且商业授权条款更严 |
| Tone.js | 14.8K | Web Audio 合成框架，适合做交互式音乐，超出本站"播放器"需求 |
| Toast UI Editor | 11K+ | 富文本/Markdown 编辑器，可升级投稿体验，但体积 > 300KB，与站点轻量路线冲突 |

### C 档 — 2024 后创建的爆发式新星

按 `stars:>10000 created:>2024-01-01` 扫描，榜单**几乎被 AI Agent 类项目垄断**（openclaw 392K、rea 345K、superpowers 302K、deepseek-harness 255K……），与本站（静态同人站）技术栈无交集，不具备参考价值。

筛出的前端向新星：

| 项目 | Stars | 创建 | 评估 |
|---|---|---|---|
| react-bits | 49.8K | 2024-08 | 动效组件库（React）。**可参考 CSS/动效实现思路**，但需手工移植到原生 JS，不建议直接引入 |
| react-scan | 21.9K | 2024-09 | 渲染性能诊断，仅支持 React，本站原生 JS 用不上 |
| midscene | 15.3K | 2024-07 | 自然语言 E2E 测试。**值得观察**——可补强现有 `scripts/browser-probe.mjs`，但引入成本高 |
| bentopdf | 16.1K | 2025-10 | 一年内涨到 16K，纯前端 PDF 工具箱。本站无 PDF 需求，仅作趋势记录 |

---

## 四、接入前必须注意的三件事

1. **SW 缓存版本**：一旦把这 4 个库写进 `index.html` / `forum/index.html`，**必须同步 bump `sw.js` 的 `CACHE_VERSION`**（v11.7.2 起立的规矩：改资源不 bump 会被旧缓存钉死）。本次未改任何 HTML，故未动版本号。
2. **CSP 兼容**：4 个库均为纯静态文件、无 `eval`、无内联脚本注入，与站点严格 CSP 兼容。但**禁止**用内联 script 初始化——初始化逻辑要写进外部 JS 文件。
3. **reduced-motion**：`confetti()` 必须在业务层先判断 `matchMedia('(prefers-reduced-motion: reduce)').matches` 再调用；同理，Fuse 的搜索建议动画也应降级。

### Fuse.js 为什么锁 6.6.2 而不是最新 7.5.0

7.x 起官方**移除了 UMD 构建**，dist 只提供 `.mjs` / `.cjs`。本站禁内联脚本、无打包器，无法通过 `<script type="module">` 内联 import 挂载全局，因此锁定 6.6.2 —— 最后一个提供浏览器 IIFE 全局 `window.Fuse` 的版本。已在 `manifest.json` 的 `note` 字段写明，防止后续误升级。

---

## 五、目录变更

```
vendor/
├── fuse/fuse.min.js                            (新, 23.5 KB)
├── howler/howler.min.js                        (新, 36.2 KB)
├── canvas-confetti/confetti.browser.min.js     (新, 10.8 KB)
├── dayjs/{dayjs.min.js, zh-cn.js}              (新, 7.2 + 1.4 KB)
├── manifest.json                               (改, 库数 11 → 15)
└── README.md                                   (改, 清单表 +4 行)
```
