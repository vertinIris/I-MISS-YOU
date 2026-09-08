# 项目现状复核与优化方向（2026-09-08）

> 基于 2026-09-07 真实运行测试 + 09-08 两轮修复后的复核。所有结论均有实测证据，不含推测。

## 一、当前状态总览

| 项目 | 状态 | 证据 |
|---|---|---|
| GitHub Actions Static Checks | ✅ success | 提交 `eba47b1` |
| Accessibility Audit | ✅ success | 同上 |
| Lighthouse CI | ✅（前两轮 success） | `c020e8a` 轮次已绿 |
| pages build and deployment | ✅ success | 站点已发布 |
| smoke-check（本地） | ✅ 通过 | 含 4 项版本一致性 + 10 页引用扫描 |
| extreme-audit（本地） | ✅ 通过 | 1 条提示（未传 baseUrl，跳过 HTTP 探测） |
| ESLint | ✅ 0 error | 181 warning（179 `no-unused-vars`） |
| 真实浏览器回归 | ✅ 14/15 | 唯一失败为脚本内日记区选择器误判，非功能缺陷 |
| 本地引用完整性 | ✅ 10 页 0 坏引用 | smoke-check 新增扫描 |

版本已全线统一至 **v11.5.1**：`package.json` / `package-lock.json` / `js/main.js(__FXRE_API)` / 主站页脚 / 论坛页脚 / `sw.js`+`sw-register.js` / `CODE-WIKI.md` / `docs/STATUS.md`。

## 二、本轮「检查疏漏」发现的遗漏

上一轮只改了 `package.json`、`js/main.js`、`index.html`，漏掉同步的 5 处：

1. **`package-lock.json` 仍为 11.3.2** — 与 package.json 漂移，属真实不一致
2. `docs/STATUS.md` 正文「package.json：11.3.2」（只改了标题行，漏了正文行）
3. `CODE-WIKI.md` 4 处版本标注
4. `docs/README.md` 文档索引描述
5. `js/security-shield.js`、`js/auth-manager.js` 头部注释版本

均已修正，并**补上防复发机制**：`package-lock.json` 纳入 smoke-check 版本一致性断言。

## 三、CI 加固（本轮新增）

1. **版本一致性检查扩展**：`js/main.js` / `index.html` / `forum/index.html` / `package-lock.json` 全部与 `package.json` 动态对齐（不再硬编码）
2. **本地引用存在性扫描**（新增）：遍历主站、重置密码页、论坛页与全部角色页，校验 `src`/`href` 指向的本地文件真实存在。已做负向测试——注入 2 个假引用后 smoke-check 正确报出 `FAIL 坏引用` 并以退出码 1 失败

这一步的意义：昨天 P0 里的 5 处 404 资源路径错误，若有此检查即可在 CI 阶段被拦截，不必靠人工浏览器测试发现。

## 四、仍存在的风险与技术债（按优先级）

### P1 — 值得尽快处理

1. **CI 无运行时断言（最大短板）**
   昨天 3 个 P0（投稿区渲染失败、后台不可达、账号按钮无响应）CI 全绿放行，因为 smoke-check 只校验「文件存在 + 字符串包含」。
   建议二选一：
   - 轻量：仓库 Settings → Variables 建 `PLAYWRIGHT_PROBE = 1`，启用工作流里已写好的 `browser-probe` job（目前显示 Skipped 就是缺这个变量）
   - 彻底：把本次使用的 CDP 断言脚本（`.workbuddy/tmp/verify-fix.mjs`，15 项关键路径断言）改造为 `scripts/browser-assert.mjs` 并加进 `static-checks.yml`

2. **dist 构建产物与源码可能失步**
   页面实际加载 `dist/bundle-*.js` 而非 `js/` 源文件，改源码忘跑 `node scripts/build-phase2.mjs` 则线上不生效且无任何告警。
   建议：CI 增加一步「重新构建并 diff」——构建后 `git diff --exit-code dist/` 非空即失败；或加 husky pre-commit 钩子自动构建。

3. **179 个 `no-unused-vars` 警告**
   数量偏大，会掩盖真正的问题。建议分批清理，或对历史文件加 `/* eslint-disable no-unused-vars */` 分层豁免。

### P2 — 可以规划

4. **版本号仍靠手工同步 8 处文件**：建议加 `npm run version:bump 11.5.2` 脚本，一次性改 package.json / lock / main.js / 两个页脚 / sw.js / sw-register.js，从源头消除漂移
5. **SW 缓存版本与站点版本强耦合**：历史上 v11.3.1、v11.3.2 都栽在 SW 上。建议 CI 断言 `sw.js` 缓存键与 `package.json` 版本一致（目前靠人工保证）
6. **文档陈旧**：`CODE-WIKI.md` 生成于 2026-08-14，未覆盖 v11.5.1 的社区渲染重构、后台入口改造
7. **CSP 仍有 `'unsafe-inline'`（style-src）**：可进一步收敛为 nonce/hash 方案

## 五、已确认正常的功能（避免重复排查）

时间线 7 帖 · 日志区（`.diary-book`）渲染正常 · 评论 81 条且可提交 · 曲目 5 条 · 音乐播放进度推进正常 · 角色页 8 模块 · 论坛 8 条/页 · 管理员入口点击有登录弹窗响应 · XSS 注入未执行 · SW 注册正常 · 论坛/角色页/重置密码页均无 404。
