# 4 个新库的融入方案 — 结合飞行雪绒现状

> 日期：2026-10-21 · 基于对 `index.html` / `forum/index.html` / `js/*.js` / `forum/js/*.js` 的逐项核对

---

## 一、结论速览（先看这张表）

| 库 | 项目现状（实测） | 真实价值 | 建议 |
|---|---|---|---|
| **Fuse.js** | 论坛搜索是 `indexOf` 子串匹配（`forum.js:331-334`）；主站**无搜索入口** | **高** — 错别字/拼音容错 + 相关性排序，论坛是唯一且明确的落点 | ✅ 接入论坛 |
| **Day.js** | **三套时间格式并存**（评论中文月日 / 投稿 ISO / cloud ISO-hm） | **中高** — 统一展示层口径，契合论坛"档案处"人设 | ✅ 接入论坛 |
| **canvas-confetti** | 投稿成功只有 `showToast`（`forum.js:1110/1159`）；彩蛋是纯视觉、无粒子反馈 | **中** — 属设计口味增量 | ⚠️ 按需接入（按需懒加载） |
| **howler.js** | 主站音乐 = **Web Audio 合成器**（`notes[]` + oscillator，无音频文件）；论坛音乐 `src: ""` 界面模拟 | **当前为 0** — 它是"播采样文件"的库，项目没有音频文件 | ❌ **暂不接入**，保留 vendor 作预埋 |

**一句话**：真正该动的只有 Fuse（论坛搜索）和 Day.js（时间统一）；confetti 看你口味；howler 现在引了也是白占字节。

---

## 二、Fuse.js — 论坛搜索从"子串"升级为"模糊"

### 现状（`forum/js/forum.js:329-335`）

```js
if (searchQuery) {
    var q = searchQuery.toLowerCase();
    filtered = filtered.filter(function (s) {
        var hay = [s.title, s.content, s.name].concat(s.tags || []).join(' ').toLowerCase();
        return hay.indexOf(q) !== -1;      // 精确子串，打错一个字就 0 结果
    });
}
```

问题：搜「爱弥思」（错别字）→ 空；搜「aimisi」→ 空；搜「雪 9072」→ 必须连续出现才命中。

### 改造原则：**精确优先，Fuse 兜底**

不改变用户已经习惯的搜索行为 —— 精确子串有结果时**完全走原逻辑**，只有精确匹配 0 结果时才让 Fuse 模糊捞回。这样零回归风险。

```js
/* ===== 模糊搜索：Fuse.js 渐进增强（未加载则行为完全不变） ===== */
var _fuseIdx = null, _fuseSig = '';

function _sig(list) {
    return list.length + ':' + (list.length ? list[0].id || '' : '');
}

function _buildFuse(list) {
    _fuseIdx = new window.Fuse(list, {
        keys: [
            { name: 'title',   weight: 0.5 },
            { name: 'content', weight: 0.25 },
            { name: 'name',    weight: 0.15 },
            { name: 'tags',    weight: 0.10 }
        ],
        threshold: 0.32,          // 保守：宁可少捞，不要捞一堆不相干
        ignoreLocation: true,     // 关键词出现在正文任何位置都算
        minMatchCharLength: 2,    // 单字不模糊，避免噪音
        includeScore: true
    });
    _fuseSig = _sig(list);
}

function applySearch(list, q) {
    if (!q) return list;
    var lower = q.toLowerCase();

    // 1) 精确子串优先 —— 与原逻辑完全一致
    var exact = list.filter(function (s) {
        return [s.title, s.content, s.name].concat(s.tags || []).join(' ').toLowerCase().indexOf(lower) !== -1;
    });
    if (exact.length > 0) return exact;

    // 2) 精确无果 → Fuse 兜底
    if (!window.Fuse) return exact;                 // 库没加载：维持原行为（0 结果）
    if (!_fuseIdx || _fuseSig !== _sig(list)) _buildFuse(list);
    return _fuseIdx.search(q).map(function (r) { return r.item; });
}
```

把 `forum.js:329-335` 整体替换为：

```js
if (searchQuery) filtered = applySearch(filtered, searchQuery);
```

### 挂载点

`forum/index.html` 第 1318 行（DOMPurify）之后、bundle 之前：

```html
<script defer src="../vendor/fuse/fuse.min.js"
        integrity="sha384-zPE55eyESN+FxCWGEnlNxGyAPJud6IZ6TtJmXb56OFRGhxZPN4akj9rjA3gw5Qqa"
        crossorigin="anonymous"></script>
```

`defer` 保证执行顺序，且 Fuse 在 `initCommunity()` 前已就绪。

### 性能

论坛内容库约几十~几百条，Fuse 全量建索引 < 10ms，且在用户输入防抖（现有 220ms）之后才触发。索引按 `length + 首条 id` 做签名缓存，只在数据集变化时重建。

---

## 三、Day.js — 统一三套不一致的时间格式

### 现状（实测三处，格式互不相同）

| 位置 | 产出 | 场景 |
|---|---|---|
| `forum.js:813` | `10月21日 00:58` | 评论时间 |
| `forum.js:1018` | `2026-10-21 00:58` | 投稿时间 |
| `forum-cloud.js:44` `fmtTimeStr()` | `2026-10-21 00:58` | 云端归一化 |

同一屏里，评论显示「10月21日 00:58」、它上方的投稿显示「2026-10-21 00:58」—— 视觉上不齐。

### 统一口径：**`YYYY-MM-DD HH:mm`**

理由贴合已确立的论坛人设：论坛 = **学院档案处 / 第三人称 / 克制归档口气**。ISO 式时间戳正对味；「10月21日」这种中文月日更适合主站温柔叙事口吻（若主站将来要统一，可单独用 `M月D日 HH:mm`）。

### 改造

新增统一 helper（放 `forum.js` 顶部工具区）：

```js
/* ===== 时间格式化：Day.js 优先，未加载则回退原手写逻辑 ===== */
function fmtStamp(d) {
    var src = (d && typeof d.getTime === 'function') ? d : new Date(d);
    if (isNaN(src.getTime())) return '';
    if (window.dayjs) return window.dayjs(src).format('YYYY-MM-DD HH:mm');
    var p = function (n) { return String(n).padStart(2, '0'); };
    return src.getFullYear() + '-' + p(src.getMonth() + 1) + '-' + p(src.getDate()) +
           ' ' + p(src.getHours()) + ':' + p(src.getMinutes());
}
```

替换三处：

| 位置 | 改为 |
|---|---|
| `forum.js:813` | `timeStr: fmtStamp(now),` |
| `forum.js:1018` | `timeStr: fmtStamp(now),` |
| `forum-cloud.js:44` `fmtTimeStr` 函数体 | `return fmtStampLocal(iso);`（该函数是模块内私有，保留签名、内部改调用即可） |

### ⚠️ 两个必须守住的边界

1. **只改展示，不改存储**。 `supabase-adapter.js` / `sync-manager.js` / `forum-cloud.js:190` 里那些 `new Date().toISOString()` 是**写库时间戳**，必须保持 ISO — Day.js 不要碰。
2. **`zh-cn.js` 可以暂时不加载**。我们只用 `format()` 输出数字格式，与 locale 无关；`zh-cn` 只在用 `fromNow()` / 星期名时才需要。省 1.4KB。将来若要加「3 分钟前」相对时间，再补 `relativeTime` 插件 + `zh-cn`。

### 挂载点

`forum/index.html`：

```html
<script defer src="../vendor/dayjs/dayjs.min.js"
        integrity="sha384-1Ft4/JTNbt7S/44V0himpcjx+YfQ1a6W6SYBJMr94ba6jwZhWoWoLaZsMmtJILgq"
        crossorigin="anonymous"></script>
```
（不引 `zh-cn.js`，见上。若要用相对时间再加。）

---

## 四、canvas-confetti — 反馈动效（可选，按需懒加载）

### 挂载点（已定位）

- `forum.js:1110` — `showToast('发帖成功，已发布到讨论区 ✨')`
- `forum.js:1159` — `showToast('已发布到讨论区 ✨')`
- 主站：当前**没有成功类 toast**，彩蛋（`secret-portal.js`）是纯视觉面板、无粒子反馈 → 若要加，挂在彩蛋触发瞬间

### 推荐做法：不全局加载，用时才取

10.8KB 不该让每个访客都付，只在真的要放礼花时才拉：

```js
/* ===== 礼花：按需加载，同源 script 动态注入（CSP 允许 self） ===== */
var _confettiLoading = false;

function celebrate() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.confetti) { _burst(); return; }
    if (_confettiLoading) return;
    _confettiLoading = true;
    var s = document.createElement('script');
    s.src = '../vendor/canvas-confetti/confetti.browser.min.js';
    s.onload = function () { _confettiLoading = false; _burst(); };
    s.onerror = function () { _confettiLoading = false; };   // 失败静默，不影响主流程
    document.head.appendChild(s);
}

function _burst() {
    if (!window.confetti) return;
    window.confetti({
        particleCount: 70,
        spread: 62,
        startVelocity: 34,
        origin: { y: 0.68 },
        colors: ['#6D8FD6', '#E8C56A', '#FFD7E8', '#F0F4FF'],   // 论坛蓝金 + 玫瑰点缀
        disableForReducedMotion: true                            // 库自带守卫，双保险
    });
}
```

调用：`showToast('发帖成功，已发布到讨论区 ✨'); celebrate();`

### 注意

- 库自带 `disableForReducedMotion`，但业务层仍先判一次，避免无谓加载 10.8KB。
- 它创建的 canvas 是 `pointer-events:none`，**不会挡住**论坛彩蛋挂载点 `#stf-hidden-trigger` 的点击。
- 若采纳此方案，则**不需要**在 HTML 里写死 `<script>` 标签（动态注入即可），也就不用为它单独 bump SW 版本。

---

## 五、howler.js — 建议暂不接入（诚实评估）

### 为什么现在引了没用

| 位置 | 实际实现 |
|---|---|
| 主站 `js/main.js:460-530` | `tracks[].notes = [60,64,67,...]` + `midiToFreq()` → **oscillator 实时合成**，没有音频文件 |
| 论坛 `forum/js/forum-music.js:14-18` | `TRACKS[].src = ""`，注释明写「站点仓库未提交音频文件…仅音频本体为占位」 |
| `js/secret-portal.js:277` | 彩蛋音效用 `AudioContext` 现场合成 |

howler.js 的核心能力是**加载并播放采样文件**（mp3/ogg 精灵图、自动格式回退、autoplay unlock）。项目现在一行音频文件都没有，它是空转的 —— 强行接入只会多 36KB 且改不动任何现有逻辑（合成器路径它接管不了）。

### 预埋路径（将来真有音频文件时）

`forum-music.js` 的注释已经写好了接口，届时只需：

```js
// 现状：无 src → 静默推进计时器
// 将来：
var howl = new Howl({ src: [track.src], html5: true, volume: 0.6, preload: true });
Howler.autoUnlock = true;                    // 解决 iOS/Android 首次交互前禁播
howl.on('end', nextTrack);
howl.on('play', function () { requestAnimationFrame(tick); });
function tick() {
    if (!howl.playing()) return;
    fill.style.width = (howl.seek() / howl.duration() * 100) + '%';
    curEl.textContent = fmtTime(howl.seek());
    requestAnimationFrame(tick);
}
```

进度条/频谱/唱片旋转等现有 UI **完全不用改**，只把「计时器推进」换成「`howl.seek()` 读取」。

⚠️ 主站那条合成器路径 howler 替代不了 —— 要上真实音轨是**新增并行路径**，不是替换。

**结论**：`vendor/howler/howler.min.js` 保留（0 成本，不加载就不产生流量），manifest 里标注「等待音频资源到位」，不进任何 HTML。

---

## 六、接入时必须守的 4 条纪律

1. **bump `sw.js` 的 `CACHE_VERSION`** — 只要往 `index.html` / `forum/index.html` 加了 `<script>` 就得 bump（v11.7.2 立的规矩，否则用户被旧缓存钉死）。confetti 走动态注入的话不需要。
2. **渐进增强** — 每个库都要写「未加载时的回退分支」（上面三段代码都写了）。vendor 文件万一 404 或被 CSP 拦，页面行为必须和今天一模一样。
3. **CSP** — 4 个库都是同源静态文件、无 `eval`、无内联注入，合规。但**严禁**用内联 `<script>` 初始化，初始化逻辑写进已有外部 JS。
4. **vendor 不进 dist** — 这几个文件不走 `build-phase1/2` 的合并链路，改 HTML 引 vendor 不需要重建 dist；但 `smoke-check.mjs` 会校验引用存在性，改完跑一次。

---

## 七、建议落地顺序

| 顺序 | 动作 | 风险 | 收益 |
|---|---|---|---|
| 1 | Day.js 统一三处时间格式 | 低（视觉微调，口径需你拍板） | 立刻消除同屏格式不齐 |
| 2 | Fuse 兜底搜索 | 低（精确优先，零回归） | 错别字/拼音也能搜到 |
| 3 | confetti 按需懒加载 | 低（纯增量，可随时撤） | 投稿成功有仪式感 |
| 4 | howler | — | **暂不做**，等音频资源 |

需要我把 1+2（或全部）实际改到代码里吗？改动前我会先跑一次 `smoke-check` 基线，改完再跑一次对比。
