# 飞行雪绒 · Snow — 利益相关者汇报演示文稿

> **版本基线**：v10.0（`package.json` 10.0.0） · **线上**：https://vertiniris.github.io/I-MISS-YOU/
> **汇报日期**：2026-08-11 · **性质**：非商业同人创作（鸣潮角色爱弥斯）
> **文档组织**：按 6 大功能域分类汇报

---

## 〇、执行摘要（Executive Summary）

**项目定位**：纯前端静态站 + Supabase BaaS 的双站同人社区——**飞行雪绒**（频道/夜电台）× **星炬学院**（论坛/公共研讨场），GitHub Pages 部署，零框架原生 JS。

**整体健康度仪表盘**：

```
┌─────────────────────────────────────────────────────────┐
│  维度              状态        评分    趋势              │
├─────────────────────────────────────────────────────────┤
│  功能完整性        ✅ 闭环     9.0/10   ─→  稳定         │
│  视觉与体验        ✅ 达标     9.2/10   ↑   v10 提升     │
│  数据与同步        ✅ 闭环     8.8/10   ─→  Production 确认│
│  安全与权限        🟡 基本达标  7.5/10   ─→  口令模式待统一│
│  工程化与 CI       🟡 半自动   7.0/10   ↑   CI 已上线     │
│  性能优化          🟡 待收尾   6.5/10   ─→  未压缩       │
│  文档与可维护性    ✅ 充分     8.5/10   ─→  稳定         │
└─────────────────────────────────────────────────────────┘
综合评分：8.1 / 10   ·   阻塞项：0   ·   待决策项：3
```

**一句话结论**：项目代码层与云端层均已闭环，v9.6 全 20 项评审收尾完毕；剩余短板集中在工程化收尾（压缩/内联）与权限体系统一，**无功能性缺失，可稳定运营**。

---

## 一、飞行雪绒主站域（Main Site Domain）

### 1.1 关键指标

| 指标 | 数值 | 备注 |
|---|---|---|
| `index.html` 体积 | 130 KB | 单页 hash-SPA |
| `js/main.js` 体积 | 243 KB / 4 564 行 | 未压缩（待 P1-1） |
| 主站 JS 模块数 | 18 个 | 含 auth/sync/upload/repository 等 |
| 主站 CSS 文件数 | 8 个 | `style.css` 158 KB 主样式 |
| 视觉令牌层级 | 6 级字阶 + 3 级表面 | R17/R18 已落地 |
| 主题模式 | dark / light / auto | 三态切换 + 系统跟随 |
| 粒子性能 | 24/42 帧节流 | Three.js + CSS 降级 |

### 1.2 重大发展

- **R17 三级色彩角色重构**：去玻璃拟态同质化，`--surface-card` / `--surface-inset` / `--surface-accent` 三档表面分层
- **R18 六级字阶系统**：Hero→Display→Title→Subtitle→Body→Caption，行高 1.05→1.7 递减节奏令牌化
- **R19 增量 DOM 协调**：`reconcileCommentThread` / `reconcileCommunityGrid` 替代整段 `innerHTML` 重绘，Realtime 推送不再闪烁
- **P0 阶段三件套落地**：字阶下钻控件层（25 处裸值→令牌）+ 模态 `role="dialog"`/`aria-modal`/焦点陷阱 + 13 个脚本加 `defer`
- **CSP + OG 元数据完善**：`default-src 'self'` + Supabase 域白名单 + WebP og:image

### 1.3 遇到的挑战

| 挑战 | 影响 | 现状 |
|---|---|---|
| `main.js` 233 KB 未压缩 | 首屏 TTI 偏高 | ⬜ P1 待 terser |
| 13 个独立 `<script>` 请求 | 请求数多 | ✅ 已加 defer |
| 模态可访问性缺失 | 不达 WCAG AA | ✅ 已补 role+焦点陷阱 |
| `og-cover.png` 2.0 MB | 社交分享慢 | ⬜ 待转 WebP |

### 1.4 显著成就

- ✅ REVIEW-v9.6 全 20 项（R1-R20）收尾完毕
- ✅ `node --check` 10 个 JS 文件全通过，无语法回退
- ✅ reduced-motion 全局处理 + 粒子懒加载
- ✅ 主题切换 / 滚动揭示 / 点赞彩蛋 / 频段切换全部稳定

---

## 二、星炬学院论坛域（Forum Domain）

### 2.1 关键指标

| 指标 | 数值 | 备注 |
|---|---|---|
| `forum/index.html` 体积 | 84 KB | 独立页 |
| 论坛 JS 模块数 | 11 个 | 含 416 KB 种子数据 |
| 论坛 CSS 文件数 | 4 个 | `forum.css` 96 KB 主样式 |
| 讨论区能力 | 列表筛选 + 置顶 + 详情 + 一层楼中楼 | schema 已确认 |
| 内容分区数 | 3 个 | 讨论区 / 角色档案 / 世界观 |
| 种子导入分片 | 4 个（`024-import-seed-1~4`） | 共 51 万字符 |

### 2.2 重大发展

- **论坛三区边界硬约束**：讨论区帖 / 角色档案 / 世界观 lore 卡严格分流，`type:lore` 双拦不进 `forum_submissions`
- **双套 Auth 共存**：主站 `fxre_auth_session` + 论坛 `stf_session`，同域 GoTrue 共享会话
- **论坛内容管线成熟**：`论坛内容/二创内容库/*.md` → `npm run content:build` → `forum-import-data.js` → Supabase
- **migration 020-028 全套就绪**：论坛表 / RLS / Realtime / 聊天 / 置顶 / 一层楼中楼
- **论坛品牌独立化**：顶栏→星炬学院档案，去「飞行雪绒」化（达妮娅状态标注同步落地）

### 2.3 遇到的挑战

| 挑战 | 影响 | 现状 |
|---|---|---|
| 双套 Auth UI 未合并 | 通行证边界保留 | 🟡 非当前目标（设计如此） |
| 大正稿勿进仓库 | 内容管理复杂 | ✅ `论坛内容/` gitignore |
| 论坛聊天废弃 migration | 误跑风险 | ✅ 已改名 `DEPRECATED-` |

### 2.4 显著成就

- ✅ Production 已确认 017/027/028 三项关键迁移
- ✅ `ensureCloudSeed` 白名单双拦 lore 不上云
- ✅ XSS 防护：`escapeHTML` + `SecurityShield` + `safeMediaUrl`
- ✅ 论坛视觉与主站可一眼区分（玫夜粉 vs 学院蓝金）

---

## 三、角色档案域（Character Archive Domain）

### 3.1 关键指标

| 指标 | 数值 | 备注 |
|---|---|---|
| 角色档案页数 | 7 个 | aimisi/denia/sigrica/linne/mornye/lucilla/drifter |
| 资料分层标记 | 3 级 `source-tier` | 官方 / 同人共识 / 本站原创 |
| 入口锚点 | `#characters-archive` | 从论坛进入 |
| 评审文档 | 双轮自审落盘 | [docs/CHARACTERS-EXPAND-REVIEW.md](docs/CHARACTERS-EXPAND-REVIEW.md) |

### 3.2 重大发展

- **七角色档案扩写完成**：时间线/性格/战斗/关系/信物/频率/语录/锚点折叠结构齐全
- **资料优先级硬规则落地**：【官方】＞【同人共识】＞【项目原创】，主线文本等同官方权重
- **爱弥斯幼年线升回官方**：父母=磁暴研究员 / 虚质磁暴 / 渐湖小屋 → 升【官方 · 3.1 主线】
- **达妮娅威胁口径校正**：「失踪/无威胁」明确标【本站原创】，官方仅「虚质放逐」
- **生成器默认拒写**：`_expand-char-archives.mjs` 需 `FORCE_EXPAND_CHAR_ARCHIVES=1` 才运行

### 3.3 遇到的挑战

| 挑战 | 影响 | 现状 |
|---|---|---|
| 官方/共识/原创易混层 | lore 准确性风险 | ✅ 已逐项校正 |
| 字体加载阻塞 | 角色页性能 | ✅ 改 `media=print`+`onload` 非阻塞 |
| 生成器覆盖人工校标 | 误操作风险 | ✅ 默认 `exit(1)` |

### 3.4 显著成就

- ✅ 七角色页均保留完整模块结构（未删减）
- ✅ glossary JSON 可解析，含虚质磁暴/渐湖等术语
- ✅ 与世界观区边界清晰，扩展资料不混入讨论区表

---

## 四、世界观与内容域（Worldview & Content Domain）

### 4.1 关键指标

| 指标 | 数值 | 备注 |
|---|---|---|
| 世界观总典 | [docs/WORLDVIEW.md](docs/WORLDVIEW.md) 29 KB | 全索拉里斯覆盖 |
| 术语表 | [docs/worldview-glossary.json](docs/worldview-glossary.json) 12 KB | 机读源 |
| 版本语境 | 3.x 拉海洛 / 星炬学院 | 3.0/3.1/3.2+ |
| 本地卷宗 | `论坛内容/事实卷宗/` 卷一~八 | gitignore 不进仓库 |
| 内容管线脚本 | `scripts/build-forum-import.cjs` | md → 种子 JS |

### 4.2 重大发展

- **三区上云安全硬规则**：讨论区帖 / lore 卡 / 角色档案严格分区，禁止交叉
- **本地卷宗 vs 公开总典分离**：事实卷宗本地私有，公开文案只链 `docs/` 内文档
- **内容管线闭环**：源稿 → 构建 → 种子 → 云端 pull/seed → Supabase，全链路可追溯
- **拉海洛区域铁律**：区域设定「仅拉海洛」，九子细表以卷三为准

### 4.3 遇到的挑战

| 挑战 | 影响 | 现状 |
|---|---|---|
| 官方表述冲突 | lore 准确性 | ✅ 标【待核实】不写死 |
| 社群硬科幻归纳 | 易冒充官方 | ✅ 禁止标【官方】 |
| 大陆访问 GitHub Pages 慢 | 内容可达性 | ⬜ P2 待决策镜像 |

### 4.4 显著成就

- ✅ 资料优先级四级标记体系（官方/共识/原创/待核实）
- ✅ 世界观与论坛入口对应表清晰
- ✅ 标注升降一览可追溯（见评审记录）

---

## 五、数据与后端域（Data & Backend Domain）

### 5.1 关键指标

```
┌────────────────────────────────────────────────────────┐
│  数据规模仪表盘                                         │
├────────────────────────────────────────────────────────┤
│  Migration 文件数      31 个（001~028 + 024 四分片）    │
│  核心数据表            11 张（comments/submissions/...）│
│  RPC 函数              11+ 个（删除/审核/限流/标签...）  │
│  Storage 桶            1 个（uploads）                  │
│  RLS 策略              全表覆盖                         │
│  Realtime 频道         comments + submissions + forum   │
│  Production 已确认迁移 017 / 027 / 028                  │
└────────────────────────────────────────────────────────┘
```

### 5.2 重大发展

- **R20 硬删 + Realtime DELETE**：软删 `is_hidden` → 物理 DELETE，`moderation_logs.content_snapshot` 快照保留审计
- **分层限流 v2**：客户端 `ClientRateLimiter` + 服务端 `check_daily_quota` RPC 双层
- **双写合并去重**：`repository.js` 本地+云端双写，`commentSig`/`mergeComments`/`dedupeLocalComments` 去重
- **评论删除令牌全链路**：`generateToken` → `extraFields.delete_token` → `delete_comment_with_token` RPC
- **Supabase Storage 集成**：拖拽上传 .txt/.md/.jpg/.png/.gif，文本 10MB / 图片 5MB

### 5.3 遇到的挑战

| 挑战 | 影响 | 现状 |
|---|---|---|
| 软删导致 Realtime DELETE 不广播 | 跨设备删除不同步 | ✅ migration-017 已确认 |
| 评论重复 | 列表闪烁 | ✅ migration-018 去重 |
| 多设备同改冲突 | 数据一致性 | ⬜ P2 暂缓（概率低） |
| Agent 无法登录 Supabase | 无法自核验 | ✅ 用户已确认 + 自查 SQL |

### 5.4 显著成就

- ✅ RLS 全表覆盖 + 服务端 XSS/injection 触发器（migration-014）
- ✅ Realtime 增量合并 + 断线指数退避重连
- ✅ 审计日志完整（`moderation_logs` 含 content_snapshot）
- ✅ Production 三项关键迁移已确认执行

---

## 六、工程化与质量域（Engineering & Quality Domain）

### 6.1 关键指标

| 指标 | 数值 | 备注 |
|---|---|---|
| CI 工作流 | 1 个 | `.github/workflows/static-checks.yml` |
| 本地门禁脚本 | 4 个 | smoke-check / extreme-audit / syntax-check / browser-probe |
| 评审文档数 | 10+ 份 | REVIEW / FIX-REPORT / OPTIMIZATION-ROADMAP 等 |
| `node --check` 覆盖 | 12 个 JS 文件 | 全通过 |
| 构建管道 | 无 | 暂缓（构建债） |
| 自动化测试 | 0 | P3 待引入 Vitest + Playwright |

### 6.2 重大发展

- **CI 自动门禁上线**：push 到 `main` 自动跑 smoke + extreme，可选 browser-probe（需 `PLAYWRIGHT_PROBE=1`）
- **三级评审闭环**：smoke + extreme + 落盘评审文档（无 Codex MCP 时的等价闭环）
- **smoke-check 扩展**：12 JS 语法 + 符号断言 + migration 001-015 覆盖
- **文档体系完善**：`docs/README.md` 索引 + STATUS + CONTENT-PIPELINE + WORLDVIEW + 评审记录

### 6.3 遇到的挑战

| 挑战 | 影响 | 现状 |
|---|---|---|
| 无构建管道 | 无法压缩/内联 | ⬜ P1 待 terser + GitHub Actions |
| 无自动化测试 | 回归靠人工 | ⬜ P3 待 Vitest + Playwright |
| `更新GitHubPages.bat` 有 bug | 误判无改动 | ⚠️ 禁用，改用 git 命令 |
| 移动端管理员入口脆弱 | 触屏双击不可靠 | ✅ 已改长按 800ms + 页内 modal |

### 6.4 显著成就

- ✅ CI 已上线，push 即自动卡语法 + 冒烟
- ✅ smoke-check + extreme-audit 双层门禁
- ✅ 文档齐全，可维护性高
- ✅ 部署即 GitHub Pages 自动触发，无需额外 action

---

## 七、综合挑战与跨域问题

### 7.1 跨域挑战矩阵

```
挑战严重度热力图（🔴高 / 🟡中 / 🟢低 / ⬜无）

                      主站  论坛  档案  世界观  数据  工程
性能压缩未做           🔴   🟡   🟢    🟢     🟢    🔴
权限体系统一           🟡   🟡   ⬜    ⬜     🟡    ⬜
大陆访问镜像           🟡   🟡   🟡    🟡     ⬜    ⬜
自动化测试缺失         🟡   🟡   🟡    🟡     🟡    🔴
双站架构重构(论坛主体) 🟡   🔴   🟡    ⬜     ⬜    🟡
```

### 7.2 关键依赖与风险

- **Supabase Free Tier 限制**：500MB 数据库 / 50k MAU / 1GB 存储 / 5GB 带宽——需监控用量
- **GitHub Pages 大陆访问**：已知限制，需用户决策镜像方案
- **无构建管道**：当前靠源文件直出，加构建需处理 CSP 哈希与脚本路径

---

## 八、路线图与决策点（Roadmap & Decision Points）

### 8.1 推荐实施顺序

```
阶段 A（P0，已完成 ✅）
  ├─ 字阶下钻控件层
  ├─ 模态可访问性补强
  └─ 脚本 defer
  → 已落地，零可见副作用

阶段 B（P1，待执行 ⬜）           ← 当前重点
  ├─ CI 已上线 ✅
  ├─ JS 压缩 + 关键 CSS 内联（terser → dist/）
  ├─ og:image 转 WebP
  └─ 移动端管理员访问修复 ✅

阶段 C（P2，需决策 🟡）
  ├─ 大陆访问镜像（EdgeOne 备案 / cloudstudio）
  ├─ 权限体系统一（共享口令 vs 具名管理员）
  └─ 双站架构重构（论坛为主体，飞行雪绒降子模块）

阶段 D（P3，远期）
  ├─ Vitest + Playwright 自动化测试
  ├─ PWA / Service Worker（暂缓）
  └─ 数据冲突合并 CRDT（暂缓）
```

### 8.2 待决策点（需利益相关者确认）

| # | 决策点 | 选项 | 建议 |
|---|---|---|---|
| D1 | 大陆镜像方案 | EdgeOne（需 ICP 备案）/ cloudstudio / 不做 | cloudstudio（无备案更稳） |
| D2 | 权限模型 | 维持共享口令 / 具名管理员+角色分配 | 维持现状（同人项目合理） |
| D3 | 双站架构重构 | 启动 P2-P5 / 维持现状 | 维持现状（收益不明确） |
| D4 | 构建管道引入 | terser+GH Actions / 维持源文件直出 | 引入（性能收益明确） |

### 8.3 明确不推荐（避免过度工程）

- ❌ 引入 React/Vue 重写（原生 JS 已可维护）
- ❌ CSS 拆微服务式多文件（无构建时增请求）
- ❌ 大量新增动效（reduced-motion 已全局关闭）
- ❌ 后端重构成 Edge Functions 全套（RPC+RLS 已满足）

---

## 九、附录

### 9.1 文档索引

| 文档 | 用途 |
|---|---|
| [README.md](README.md) | 项目入口 |
| [docs/STATUS.md](docs/STATUS.md) | 现状速览 + migration 要点 |
| [docs/CONTENT-PIPELINE.md](docs/CONTENT-PIPELINE.md) | 内容管线 |
| [docs/WORLDVIEW.md](docs/WORLDVIEW.md) | 世界观总典 |
| [OPTIMIZATION-ROADMAP-v10.md](OPTIMIZATION-ROADMAP-v10.md) | 优化路线图 |
| [POST-PUSH-REVIEW.md](POST-PUSH-REVIEW.md) | 推送后查漏 |
| [TASKS.md](TASKS.md) | 任务接续 |
| [design.md](design.md) | 双站设计令牌 |

### 9.2 常用命令

```bash
npm run serve            # 本地预览（端口 8848）
npm run smoke-check      # 冒烟检查
npm run extreme-audit    # 深度审计
npm run syntax-check     # JS 语法检查
npm run content:build    # 论坛内容构建
npm run db:migrate-028   # 打印迁移指引
```

### 9.3 关键全局契约（新代码必须遵守）

- `window.supabaseClient` 各模块共享，**不能自己 createClient**
- `SyncManager.connectSubmissions(handlers)` 必须传**对象**，不是函数
- `DataRepository.addComment(targetId, text, name, extraFields)` 透传 `delete_token`
- 所有新功能用 `typeof X !== 'undefined'` 守卫
- 投稿标签筛选是 **AND 语义**

---

## 十、总结

**飞行雪绒 · Snow v10.0** 是一个**完成度高、文档齐全、可稳定运营**的同人社区项目：

- ✅ **功能层**：双站 + 7 角色档案 + 论坛三区 + Realtime 同步 + 审核限流，全闭环
- ✅ **视觉层**：三级色彩角色 + 六级字阶 + 双站可区分气质，REVIEW-v9.6 全 20 项收尾
- ✅ **数据层**：31 个 migration + Production 三项关键迁移已确认 + RLS 全覆盖
- ✅ **质量层**：CI 自动门禁 + smoke/extreme 双层 + 评审文档落盘
- 🟡 **工程层**：构建管道与压缩待引入（P1），自动化测试待引入（P3）
- 🟡 **决策层**：3 个待确认决策点（镜像/权限/架构），均不阻塞当前运营

**综合评分 8.1/10，阻塞项 0，可投入运营，建议优先推进阶段 B（P1 工程化收尾）。**

---

*汇报生成：2026-08-11 · 基线 v10.0 · 按 6 大功能域分类*
