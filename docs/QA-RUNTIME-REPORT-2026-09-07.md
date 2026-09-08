# 飞行雪绒 · 真实运行体验缺陷报告

> 检查日期：2026-09-07
> 检查方式：本地静态服务器（`http://127.0.0.1:8848`）+ Chrome 134 headless（CDP 驱动）真实加载与交互操作
> 覆盖范围：主站 `/`、`/forum/`、`/characters/{aimisi,denia}/`、`/reset-password.html`
> 操作方式：页面滚动、筛选点击、表单提交、评论发布、点赞、音乐播放、面板开合、注入测试
> 结论：**项目存在 3 个致命级（P0）功能缺陷，核心社区功能实际不可用。**

---

## 一、总体结论

| 维度 | 实测结果 |
|------|---------|
| 页面加载 | 正常（主站 1854 节点，无 pageerror） |
| 时间线 / 日志 / 音乐 / 角色页 | 正常 |
| 评论系统 | 正常（可提交、可渲染、XSS 注入未执行） |
| **社区投稿（听众来信）** | **完全不可用（P0）** |
| **管理员后台** | **完全不可达（P0）** |
| **静态资源引用** | **5 处 404（P1）** |
| 论坛列表 / 分页 / 聊天 | 正常 |
| Service Worker | 注册成功，但版本号与站点不一致 |

---

## 二、P0 致命缺陷

### P0-1　社区投稿区渲染完全失败 + DOM 节点无限泄漏

**现象**
- 主站「听众来信」（`#community-grid`）在页面上**完全空白**，没有任何投稿卡片。
- grid 内实际只有一批孤立的装饰节点 `<span class="sig-tape-corner">`，数量随每次筛选点击**单调增长**：
  首屏 3 → 点击筛选后 10 → 17 → 34 → 41 → **49**（实测连续点击 10+ 次后），永不回收。
- `document.querySelectorAll('.community-card').length` **始终为 0**。
- 用户提交投稿后数据写入 localStorage 成功（实测 `stored: 1`），但页面上**检索不到该内容**（`visibleMarker: false`），grid 文本为空字符串。

**根因（代码级定位）**

1. `js/app-toast.js:77-96` 定义了 DOMPurify 白名单：
   - `ALLOWED_TAGS` **不含 `article`**
   - `FORBID_TAGS` 包含 `button`、`input`、`form`
   - `ALLOW_DATA_ATTR: false` → 所有 `data-*` 属性被剥离
   - `ALLOWED_ATTR` 不含 `style`
2. `js/main.js:3444 buildSubmissionCardNode()` 对**整张投稿卡**调用 `safeHTML()`：
   ```js
   var html = buildSubmissionCardHTML(s);      // 返回 <article class="sn-letter-card community-card" data-id=...>
   tmp.innerHTML = safeHTML(html);             // ← article/button/input/data-* 全被剥离
   var el = tmp.firstElementChild;             // ← 只剩 <span class="sig-tape-corner">
   ```
3. `js/main.js:3453 reconcileCommunityGrid()` 依赖 `.community-card` 选择器做增量协调：
   - 由于卡片根节点已被剥离，`grid.querySelectorAll('.community-card')` 永远为空
   - 每次渲染都落入 `else` 分支执行 `grid.appendChild(fresh)`，只追加残留的 span，**从不清理**

**影响范围**
- 主站「听众来信」板块 100% 不可用：标题、作者、正文、点赞、评论、收藏、举报按钮全部丢失
- 用户投稿成功但看不到自己的内容（提交闭环断裂）
- DOM 节点与内存持续增长，长时间浏览会拖垮页面性能（实测点击 16 次后 grid 子节点 49 个且仍在增长）
- 连带失效：投稿点赞/收藏/编辑/删除/评论入口

**复现步骤**
1. 打开首页 → 滚到「听众来信」
2. 观察：区域空白
3. 反复点击「文字 / 故事 / 全部」筛选
4. 观察 `#community-grid` 子节点数量单调增长，始终无卡片

---

### P0-2　管理员后台完全不可达

**现象**
- 导航「管理」按钮 `#admin-panel-open-btn` 带 `hidden` 属性，需管理员登录后才显示
- 账号面板内的 `#account-admin-login-btn`（管理员登录）点击后实测 `offsetParent` 为 null（不可见），点击无效果
- 文档中记录的「双击页脚 / 长按页脚 800ms 触发管理员登录」：**实测两种方式均无任何对话框弹出**，`#admin-panel` 保持 `hidden: true`
- 最终结果：版主/管理后台**无法从任何入口进入**

**影响范围**
- 举报审核、评论管理、批量隐藏/恢复/删除、操作日志全部不可用
- 站点内容治理能力为零

---

### P0-3　投稿区「打开账号」按钮无响应

**现象**
- `#auth-upgrade-toggle`（投稿区认证状态栏的「打开账号」按钮）点击后 `#account-panel` 仍为 `hidden: true`、`display: none`、高度 0
- 对照组：导航区 `#nav-account-btn` 点击可正常展开面板（高度 134px，内容完整）

**影响范围**
- 未登录用户在投稿流程中无法升级账号，投稿与评论无法跨设备同步

---

## 三、P1 严重缺陷

### P1-1　5 处静态资源路径错误（HTTP 404）

| 引用位置 | 错误路径 | 正确路径 | 后果 |
|---------|---------|---------|------|
| `forum/index.html:39` | `../js/forum-theme-bootstrap.js` | `js/forum-theme-bootstrap.js` | 论坛主题引导脚本未加载 |
| `forum/index.html:1275` | `../js/forum-supabase-loader.js` | `js/forum-supabase-loader.js` | 论坛 Supabase 客户端加载器未加载 |
| `forum/js/photoswipe-init.js:11` | `../vendor/photoswipe/photoswipe-lightbox.esm.min.js` | `../../vendor/photoswipe/...` | **图片灯箱功能完全失效** |
| `characters/aimisi/index.html:299` | `../../dist/js/snow-easter.js` | 文件不存在（`dist/js/` 目录无） | 爱弥斯页彩蛋脚本缺失 |
| `reset-password.html:39` | `dist/js/supabase-adapter.js` | 文件不存在 | 重置密码页 Supabase 适配器缺失 |

> 备注：仅爱弥斯角色页引用了 `dist/js/snow-easter.js`，其余 6 个角色页未引用，故只有该页报 404。

### P1-2　Service Worker 版本漂移

- 运行时注册：`sw.js?v=11.5.0`
- 站点实际版本：`__FXRE_API.version = v11.3.2`，页脚 `v11.3.2`，`package.json` `11.3.2`
- SW 缓存键超前站点版本两个小版本，存在新旧资源错配风险（历史上 v11.3.1 / v11.3.2 都修过 SW 相关加载问题）

### P1-3　论坛「进入讨论区」按钮点击后无变化

- 点击前后 `#stf-community-grid` 子节点均为 8，内容完全一致
- 该 CTA 按钮未产生视图切换或滚动定位效果

### P1-4　CSP 白名单缺失

- 控制台警告：`[SecurityShield] csp https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js script-src-elem`
- `_headers` 中 `script-src` 仅允许 `'self' cdn.jsdelivr.net unpkg.com`，未含 `cdnjs.cloudflare.com`

---

## 四、P2 一般问题

| 编号 | 问题 | 说明 |
|------|------|------|
| P2-1 | ESLint 5 errors / 181 warnings | 含 `js/sw-register.js:77 'indexedDB' is not defined`（no-undef）、`web-vitals-collector.js` 2 处 no-useless-assignment |
| P2-2 | 消毒策略不一致 | 投稿卡走 `safeHTML()`（被过度剥离导致功能损坏），评论渲染实测保留了 `button`/`a` 等标签，二者策略不一致；实测 XSS 注入 `<img src=x onerror=...>` 未执行，暂无实际漏洞，但存在维护风险 |
| P2-3 | 项目自带 `smoke-check` 只校验文件存在性 | 无法发现上述任何运行时缺陷（实测 smoke-check 全绿通过） |
| P2-4 | 论坛搜索无明显反馈 | 输入关键词后列表条数保持 8，需人工确认过滤是否生效 |

---

## 五、实测确认「正常」的模块（避免过度否定）

| 模块 | 实测证据 |
|------|---------|
| 首屏与导航 | 9 个 section 齐全；`#main-content/#hero/#profile/#music/#timeline/#diary/#submit/#community` 锚点全部存在 |
| 动态时间线 | 7 条 `post-card` 正常渲染 |
| 角色日志 | 6 条 `diary-card` 正常渲染 |
| 评论系统 | 80 个评论项完整渲染（作者/时间/正文/回复/举报按钮齐全）；提交新评论成功（16→17 条）并落库 |
| 音乐播放器 | 点击 `#play-btn` 后唱片进入 `.playing`，进度从 `0:02` 推进到 `0:05`，磁带机同步激活 |
| 角色专区 | 爱弥斯页 8 个模块渲染完整，档案数据齐全 |
| 论坛列表 | `#stf-community-grid` 8 条/页，分页显示 `1 / 60`（共 478 条本地数据） |
| 论坛聊天面板 | 可正常展开 |
| Service Worker | 注册成功（1 个 registration） |
| 收藏面板 | 可正常打开 |
| XSS 防护 | 注入 payload 未执行，未生成 `img` 节点 |

---

## 六、修复优先级建议

1. **立即修复 P0-1**：给 `PURIFY_CONFIG` 增加投稿卡所需标签（`article`/`button`/`input`/`form`）与 `ALLOW_DATA_ATTR: true`、`style` 属性；或改为「字段级转义 + 结构化 DOM 构建」，避免整卡 HTML 消毒。同时修复 `reconcileCommunityGrid` 在找不到节点时不清空旧节点的逻辑。
2. **修复 P0-2 / P0-3**：恢复页脚长按/双击的管理员入口，或提供显式可见的后台入口；修复 `#auth-upgrade-toggle` 的事件绑定。
3. **修复 P1-1 五处 404 路径**，尤其 photoswipe 灯箱。
4. **统一 SW 版本号与站点版本**，避免缓存错配。
5. **增强 smoke-check**：从「文件存在性检查」升级为「真实浏览器关键路径断言」，否则同类缺陷无法在 CI 中被发现。
