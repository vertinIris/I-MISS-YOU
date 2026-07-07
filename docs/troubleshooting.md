# 运维排错手册

> **版本**: v7.8.1 | **最后更新**: 2026-07-03

---

## 快速诊断表

| 页脚显示 | 含义 | 首要检查 |
|----------|------|----------|
| ✅ 云端在线 | 正常 | — |
| ☁ 本地模式 | 未连 Supabase | SDK/CDN/配置 |
| ☁ 云端未就绪 | SDK 加载中或失败 | 网络、jsdelivr |
| ⚠ 云端未认证 | 匿名登录失败 | Anonymous Sign-ins |
| ☁ 未配置云端 | CONFIG.enabled/url | supabase-adapter.js |

---

## 1. 评论互不可见

### 症状

- 自己发的评论能看到
- 朋友看不到；朋友发的你也看不到

### 排查步骤

1. **Supabase → Table Editor → comments**
   - 有数据 → 前端读取问题（强刷、查 v7.8 是否部署）
   - 无数据 → 写入失败（见下）

2. **确认 migration-004 已执行**（最常见根因）
   - 只跑 003 不跑 004 → 所有 INSERT 失败
   - 见 [fix-journal-v7.8.md](./fix-journal-v7.8.md)

3. **发评论时是否弹出 Toast「云端同步失败」**
   - 有 → 看 F12 Console 具体错误
   - 无且表无数据 → 可能仍在本地模式

4. **双方是否用 GitHub Pages 链接**（非 localhost / file://）

5. **测试用新评论**（旧评论可能只在各自 localStorage）

### 修复

```text
1. 跑 db/migration-004-fix-search-path.sql
2. 确认 Anonymous Sign-ins 开启
3. Ctrl+F5 强刷线上页
4. 页脚点 🔄 手动同步
```

---

## 2. 页脚「本地模式」

| 原因 | 处理 |
|------|------|
| jsdelivr 被 Edge 扩展拦截 | 关广告拦截/VPN；或用无痕模式对比 |
| Supabase SDK 未加载 | F12 Network 查 supabase.min.js |
| 匿名登录未启用 | Auth → Providers → Anonymous |
| 项目休眠（Free Tier） | Dashboard 打开唤醒；UptimeRobot 心跳 |
| CONFIG.enabled = false | 检查 supabase-adapter.js |

---

## 3. 本地预览打不开

### ERR_EMPTY_RESPONSE（localhost:8080）

**原因**：8080 被其他程序占用。

**处理**：

- 双击 `打开本地预览.bat`（自动用 8848+ 端口）
- 或 `.\run.ps1`
- **不要**直接双击 `index.html`（file:// 协议功能受限）

---

## 4. GitHub 部署

### push rejected (non-fast-forward)

```powershell
cd C:\Users\lenovo\CURSOR\Snow
git pull origin main --allow-unrelated-histories
git push origin main
```

### 合并冲突

- GitHub Desktop：每个文件选 **Accept Current Change**（保留本地 v7.8）
- 或双击 `解决合并冲突.bat`

### Actions Deploy 失败

1. **Settings → Pages** → Source: **Deploy from a branch** → main → `/ (root)`
2. **Settings → Actions → General** → Workflow permissions: **Read and write**

### 正确 URL

```
https://vertiniris.github.io/I-MISS-YOU/
```

小写 `l-MISS-YOU` 会 404。

---

## 5. 投稿同步失败

**原因**：英文 type 与数据库中文 CHECK 不匹配（v7.8 前）。

**现况**：v7.8+ 已在 `supabase-adapter.js` 自动映射。确认线上已部署 v7.8。

---

## 6. 控制台常用日志

| 日志 | 含义 |
|------|------|
| `[SupabaseAdapter] 初始化成功` | SDK OK |
| `[SupabaseAdapter] 匿名登录成功` | 可写入 |
| `[Repository] 云端同步成功` | 评论已入库 |
| `[SupabaseAdapter] addComment 失败` | 看 message；常因 003 未修 |
| `[Phase3] Realtime 订阅已启用` | 实时刷新 OK |

---

## 7. 诊断信息复制

点击页脚 **#sync-status** 区域（非 🔄 按钮）→ 诊断 JSON 复制到剪贴板。

```json
{
  "provider": "supabase",
  "ready": true,
  "user": "<uuid>",
  "pending": 0,
  "error": null
}
```

- `pending > 0`：有点击 🔄 或等自动重试
- `user: null`：匿名登录失败
- `ready: false`：SDK 未就绪
