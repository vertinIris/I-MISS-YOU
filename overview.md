# 飞行雪绒 / Snow — 工作概览

当前版本：v9.6（本地 HEAD `877320d` 已同步 GitHub Pages）

## 本轮改动：账号面板注册 / 登录职责重构

### 问题（用户审计发现）
- 游客面板只有「升级账号」+「登录」两个 tab，没有独立「注册」通道
- 「升级账号」底层是 `updateUser`（匿名→注册），对新用户命名误导
- 两个 tab 都是邮箱+密码，视觉重复、职责不清

### 优化方案（已落地）
游客面板改为清晰的 **「注册 / 登录」** 两个 tab：

| Tab | 职责 | 底层调用 |
|-----|------|----------|
| 注册 | 新用户/匿名用户创建或绑定账户 | `AuthManager.registerUser` |
| 登录 | 已有账户登录 | `AuthManager.signIn` |

`registerUser` 内部智能路由：
- 当前为匿名会话 → 复用 `upgradeToRegistered`（`updateUser`，保留 UID，匿名期间评论/投稿仍归你）
- 非匿名会话 → `supabaseClient.auth.signUp` 全新注册

### 改动文件
- `js/auth-manager.js`：新增 `registerUser` 方法 + 导出；`upgradeToRegistered` 保留为底层能力
- `index.html`：游客面板「升级账号」→「注册」，相关 id 全部改为 `account-register-*`
- `js/main.js`：`switchAccountTab` 与提交绑定同步到 `register` / `account-register-*`

### 验证
- `node --check js/auth-manager.js` 通过
- `node --check js/main.js` 通过
- 已确认无遗留 `account-upgrade-*` 引用

### 待办
- 用户需在 GitHub Desktop 执行 Commit + Push（沙箱无 TTY，无法自动推送）
- 推送后 `Ctrl + F5` 强刷可见新「注册」tab

## 历史遗留（仍可选）
- R17 色彩系统重构 / R18 完整 type scale / R19 增量渲染 —— 需设计确认后处理
- R20 `db/migration-016-replica-identity.sql` —— 去 Supabase SQL Editor 跑一次（可选加固）
