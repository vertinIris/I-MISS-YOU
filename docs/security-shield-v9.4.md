# 安全防护网 v9.4

> 飞行雪绒纵深防御体系 — 前端 + 数据库 + Supabase 原生能力

---

## 架构（7+1 层）

| 层级 | 模块 | 能力 |
|------|------|------|
| L1 | `escapeHTML()` | 全字符 HTML 转义 |
| L2 | `SecurityShield` | XSS/SQLi 模式检测、输入清洗、洪泛检测 |
| L3 | `rate-limiter.js` + `ClientRateLimiter` | 前端冷却与重复检测 |
| L4 | CSP meta（index.html） | `base-uri` / `form-action` / `object-src` / `upgrade-insecure-requests` |
| L5 | Supabase RLS | 行级读写隔离 |
| L6 | `check_rate_limit` + `check_daily_quota` | 服务端频率与日配额 |
| L7 | `moderate_content` | 敏感词与垃圾内容 |
| L8 | **migration-014** | INSERT/UPDATE 前危险标记拦截（script/on*= 等） |

---

## SecurityShield 功能

- **guardUserInput**：评论/投稿提交前扫描
- **guardSyncAction**：同步按钮 8 次/分钟上限
- **safeParseJSON**：防 prototype pollution
- **isSafeUrl**：拦截 `javascript:` / 恶意 `data:` URL
- **DOM 监控**：移除动态注入的内联 script / iframe
- **localStorage 保护**：单 key/value 大小上限
- **CSP 违规监听**：`securitypolicyviolation` 事件日志

控制台可见 `[SecurityShield]` 警告（生产环境可接 Sentry）。

---

## 运维

### 必跑（若尚未执行）

```
001 → … → 013 → 014
```

```bash
npm run db:migrate-014
# 在 Supabase SQL Editor 执行 db/migration-014-security-hardening.sql
```

### 验证

```bash
npm run smoke-check
```

1. 评论输入 `<script>alert(1)</script>` → 应被前端拦截
2. 绕过前端直写 API → migration-014 触发器应拒绝
3. 连续狂点 🔄 同步 → 1 分钟后应提示「同步过于频繁」

---

## 已知边界（静态站点极限）

| 威胁 | 现状 |
|------|------|
| DDoS | 依赖 GitHub Pages + Supabase 基础设施 |
| 管理员口令 | 仍在前端 SHA-256，需 DB 版主角色做全网操作 |
| CSP `unsafe-inline` | 纯静态内联脚本所需；未来可拆 external JS |
| 匿名用户 | 可换 UUID 绕过封禁 → 依赖配额 + RLS |

---

## 相关文件

- `js/security-shield.js` — 前端防护网
- `db/migration-014-security-hardening.sql` — 数据库触发器
- `docs/security.md` — 历史安全文档（v7.7）
