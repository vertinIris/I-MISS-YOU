# 飞行雪绒 · 项目现状汇报与缺口补充（2026-10-11）

> 范围：目录结构、配置、依赖清单、README/文档、已有代码模块、待办注释。
> 方法：全量 grep 引用解析 + 关键文件精读 + 构建脚本核对 + 版本一致性比对。
> 结论：**生产站（index.html / forum/）功能完整**，所有 HTML/JS/CSS 引用均可解析；旧 QA 报告（2026-09-07）所列「缺失文件」现已修复。真实缺口集中在**版本/配置漂移、健壮性、构建可复现**三类，已全部修复或给出确认项。

---

## 1. 现状：已完成的功能

| 域 | 状态 | 说明 |
|---|---|---|
| 主站叙事/角色/音乐/日志/投稿 | ✅ | index.html 含完整 DOM 挂载点（account-panel、music、submit、egg、donate、sn-footer） |
| Supabase 账号系统（Auth + RLS） | ✅ | `js/auth-manager.js` + `js/supabase-adapter.js`，30 个 migration 已落地至 030 |
| 论坛「星炬学院」 | ✅ | 左固定栏、夜电台尾页、音乐播放器、9072 触发、PhotoSwipe、Markdown 渲染、Just-Validate |
| 彩蛋体系（F14–F22） | ✅ | snow-easter.js / secret-portal.js / snow-realm.js 均在 |
| 基建 | ✅ | CSP（`_headers` + HTML meta 双轨）、SW（network-first + 强制接管）、web-vitals RUM、SRI vendor |
| 内容管线 | ✅ | `scripts/build-forum-import.cjs` → `forum/js/forum-import-data.js` → Supabase |
| 门禁 | ✅ | smoke-check / extreme-audit / lint / a11y / Lighthouse CI |

## 2. 技术栈与编码约定

- **前端**：原生 HTML/CSS/JS，零框架；主站 `js/`(27) + 构建产物 `dist/bundle-main.js`；论坛 `forum/js/`(20) + `dist/bundle-forum.js`。
- **后端**：Supabase（PostgreSQL + Auth + Realtime + RLS），共 30 个 migration（001–030）。
- **音频**：Web Audio API 合成（无音频文件时按真实时间推进可视化）。
- **部署**：Cloudflare Pages（主）+ GitHub Pages（备）；CI 双轨（静态检查 + Lighthouse + a11y）。
- **依赖模型**：第三方库本地自托管于 `vendor/`（DOMPurify/Notyf/Marked/highlight/PhotoSwipe/Just-Validate/FA/MDI/animejs/lazysizes），SRI 双保险；**Supabase JS 走 CDN + 本地回退**（唯一例外）。
- **编码约定**：
  - 模块风格：bundle 与多数模块为 classic `defer`/IIFE，挂 `window.*` 全局（`SupabaseAdapter`、`AuthManager`、`DataRepository`、`__FXRE_API` 等）；仅 `web-vitals-collector.js` 与 `photoswipe-init.js` 为 ESM `type=module`。
  - 命名：文件 kebab-case；函数 camelCase；常量 `UPPER_SNAKE` / `PascalCase`。
  - CSS 前缀：**`sn-`**（主站）、**`stf-`**（论坛）、JS 全局命名空间 `window.__FXRE_*` / `window.__STF_*`。
  - 健壮性范式：「节点缺失则跳过初始化」「全局使用前存在性检查」，Supabase 调用多用 try/catch + 离线队列（`queueOp`）。

## 3. 缺陷与缺失（真实发现，已分级）

| 优先级 | 问题 | 影响 | 处置 |
|---|---|---|---|
| **P0** | 版本漂移：README 11.3.2 / STATUS.md 11.5.1 / `js/sw-register.js` v=11.5.1 / `sw.js` v11.6.1，实际 11.7.1 | 文档误导；SW 注册 query 不随版本变，老用户缓存可能不刷新 | ✅ 已对齐 11.7.1 |
| **P0** | `reset-password.html` 用裸 CDN 链 `@supabase/supabase-js@2` | 若 jsdelivr 不返回 UMD，全局 `supabase` 缺失 → 重置页失效 | ✅ 改显式 `/dist/umd/supabase.min.js` |
| **P1** | `vendor/manifest.json` 漏记 Supabase，且「无 CDN 依赖」声明不实 | 依赖清单不准确 | ✅ 补 supabase 条目 + 修正声明 |
| **P1** | 无 `npm run build`，dist 仅靠手动 `node scripts/build-phase2.mjs` | 构建不可复现 | ✅ 加 `build`/`build:all` |
| **P2** | `dist/js/` 与 `dist/forum/js/` 为 build-phase1 孤儿副本（无任何 HTML/sw.js 引用） | 维护者误判源码 | ⏸ 建议 gitignore/部署排除（待确认） |
| **P2** | `reset-password.html` 内 `<script type="text/plain" data-legacy-inline>` 为死代码（真实逻辑在 `js/reset-password.js`，已含 `.catch`） | 误导 | ⏸ 建议清理（待确认） |
| **P2** | `forum/js/forum.js` 多处空回调 `function(){}` 吞掉 `StarTorchCloud` 错误 | 失败无 UI 反馈 | ⏸ 建议加错误提示（重构需谨慎） |
| **P2** | `dist/` 内提交真实 anon key | 设计上公开（RLS 控权），但缺轮换文档 | ⏸ 建议文档化 |
| **说明** | `design.md` 的「redesign 33 项缺失」属独立编辑式重做提案 | 非当前生产站缺陷 | 划为单独工作流，不在本次范围 |

## 4. 已完成的补充（逐项正确说明）

1. **README.md** — 版本 `v11.3.2` → `v11.7.1`（两处）。影响：文档与代码一致，零风险。
2. **docs/STATUS.md** — 对外版本/package.json `v11.5.1` → `v11.7.1`。影响：现状速览与页脚/全局版本号一致。
3. **sw.js** — `CACHE_VERSION` `snowfluff-v11.6.1-footer-unify` → `snowfluff-v11.7.1`。影响：部署后强制清理旧缓存、拉取新资源（与站点版本同步，符合其注释设计的缓存破坏机制；CI 的 SHA 注入仍会覆盖）。
4. **js/sw-register.js** — `SW_VERSION` `v=11.5.1` → `v=11.7.1`。影响：SW 注册 URL query 随版本变化，老控制页被检测为过期并强制重置刷新；与站点版本对齐。
5. **reset-password.html** — CDN 链接改为显式 `…/supabase-js@2/dist/umd/supabase.min.js`，与主站 `js/supabase-loader.js` 一致。影响：降低 `window.supabase` 未定义导致重置页失效的风险。
6. **vendor/manifest.json** — 修正 description（承认 Supabase 为 CDN 例外）；新增 `supabase` 库条目（version/source/cdn/localFallback/note）。影响：依赖清单准确，JSON 校验通过。
7. **package.json** — scripts 新增 `"build": "node scripts/build-phase2.mjs"` 与 `"build:all": "node scripts/build-phase1.mjs && node scripts/build-phase2.mjs"`。影响：单命令可复现 `dist/`（bundle + CSS + SRI 注入）；`build-phase2` 独立自足（直接从 `js/`、`forum/js/` 源构建，不依赖 phase1 产物）。

校验：`node --check sw.js|sw-register.js` 通过；`package.json`/`vendor/manifest.json` JSON.parse 通过。

## 5. 待确认 / 建议（未自动执行，需取舍）

- **A. 孤儿副本**：是否将 `dist/js/`、`dist/forum/js/` 加入 `.gitignore` 或部署排除？它们由 `build-phase1.mjs` 生成但交付物只用 `dist/bundle-*.js`。建议排除以免混淆。
- **B. 死代码清理**：是否删除 `reset-password.html` 的 `data-legacy-inline` 块？确认无任何加载器会 eval 它后删除。
- **C. 错误反馈**：`forum.js` 空回调处是否要补充用户可见的错误 toast？属较大改动，建议单独 PR。
- **D. anon key 治理**：是否在 `docs/` 明确「anon key 可公开、随 Supabase 项目轮换、CI 注入 dist」的策略？
- **E. 范围边界**：`design.md` 的编辑式重做（33 功能点）是否作为独立里程碑推进？本次按「不破坏现有逻辑」原则未触碰。

> 所有 P0/P1 修正均已落地并通过语法/JSON 校验，未改动任何运行逻辑与挂载点 ID。
