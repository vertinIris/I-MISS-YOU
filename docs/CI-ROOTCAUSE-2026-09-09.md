# CI Static Checks 反复失败 — 根因复盘（2026-09-09）

## 结论先行
连续多轮 CI `Static Checks` 失败，**真正根因不是「跨环境（Linux/Windows）构建产物字节不一致」，而是 `npm install` 因依赖 peer 冲突 ERESOLVE 失败，拖垮了 `dist-sync` job**。构建产物（dist/ + 被回写 SRI 的 HTML）与提交版本**逐字节一致**，门禁本身从未真正失败。

最终修复 commit：`e69b139`，Static Checks 已全绿（dist-sync / runtime-assert / smoke+audit 均 success）。

---

## 排查时间线（含两次误判）

| 阶段 | 假设 | 验证手段 | 结果 |
|------|------|----------|------|
| 1 | 源映射 `*.map` 跨环境行尾不同 | 排除 `*.map` 比对 | 仍失败 |
| 2 | terser/csso `^` 浮动版本导致输出漂移 | 锁定 5.36.0 / 5.0.5 | 仍失败 |
| 3 | Linux/Windows 跨 OS terser 输出不一致 | 本地重建 vs 提交版逐字节比对 → **0 差异** | 排除失步 |
| 4 | 行尾 CRLF/LF 影响 terser 输出 | 脚本比对 CRLF/LF 源 → 输出一致 | 排除 |
| 5 | Node 20(CI) vs 22(本地) 差异 | 锁定 CI 为 Node 22 | 仍失败 |
| 6 | 依赖树版本漂移 | lock 与本地 node_modules 逐项比对 → 一致 | 排除 |
| 7 | **`npm install` ERESOLVE 失败**（真因） | 临时把 `git status`/`diff` 回传 Issue 诊断 → 工作树为空、构建未运行 | **确认** |

## 真正的根因
`package.json` 中：
- `eslint@^9.39.5`
- `@eslint/js@^10.0.1`

eslint 9 的 peer 要求 `@eslint/js@9`，但当前解析到 `@eslint/js@10`，`npm install` 触发 `ERESOLVE could not resolve`（peerOptional 冲突）。

后果链：
1. CI `npm install --no-audit --no-fund` 直接报错退出；
2. 后续 `node scripts/build-phase2.mjs` / `git diff` 步骤即便运行也无意义（terser 可能未装）；
3. 整个 `dist-sync` job 被判 `failure`。

而之前在 Issue 里看到的「dist 0 差异、git status 为空」恰恰证明：**构建产物与提交版本来就一致**，只是 install 在更早的阶段就挂了。

## 修复内容（e69b139）
1. **`dist-sync` 安装命令** 改为：
   ```yaml
   npm install --legacy-peer-deps --no-audit --no-fund
   ```
   该 peer 冲突与「dist 构建」无关（构建只需 terser/csso），`--legacy-peer-deps` 绕过即可，不影响产物。
2. **门禁范围收紧**：`git diff --exit-code` 只比对构建产物本身，避免被 `npm install` 可能重写的 `package-lock.json` 等无关追踪文件误伤：
   ```yaml
   git diff --exit-code -- 'dist' 'index.html' 'forum/index.html' \
     ':!dist/build-report-phase2.json' ':!dist/**/*.map'
   ```
3. 新增 `scripts/ci-dist-diff.mjs`：逐文件比对「已提交版」与「本次重建版」的首次差异偏移与上下文（仅打印，便于失败复盘）。

## 遗留问题（建议单独立项）
`eslint` 与 `@eslint/js` 主版本不匹配是真实 bug。建议：
- 将 `@eslint/js` 降到 `^9`（与 eslint 9 对齐），或
- 整体升级 eslint 到 10 并同步配套插件。

否则本地与 CI 任何 `npm install`（不带 `--legacy-peer-deps`）都会 ERESOLVE。本次为最小可用修复，未动 eslint 工具链。

## 验证
- `e69b139` Static Checks：`dist 构建产物同步` ✅ / `runtime-assert (headless DOM)` ✅ / `smoke-check + extreme-audit` ✅ / `browser-probe` skipped。
- 临时诊断 Issue #1、#2 已关闭。
