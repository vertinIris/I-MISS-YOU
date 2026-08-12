# 飞行雪绒 · Snow — 部署方案决策矩阵

> **生成日期**：2026-08-11
> **整合来源**：TECH-SELECTION-REPORT.md / CLOUDBASE-VS-CLOUDFLARE-ANALYSIS.md / STAKEHOLDER-REPORT-v10.md

---

## 当前状态

```
GitHub Pages (vertiniris.github.io)
  ↓ 大陆访问慢（TTFB 800ms+）、不稳定
  ↓ 已是当前生产环境
```

## 两个选项

### 选项 A：立即迁移到 Cloudflare Pages（推荐）

| 项 | 详情 |
|---|---|
| **部署平台** | Cloudflare Pages |
| **大陆 TTFB** | 50-100ms（优选IP 优化后） |
| **国际 TTFB** | 20-50ms（310+ 全球节点） |
| **免费额度** | 无限流量 + 无限存储 |
| **备案要求** | ❌ 不需要 |
| **实名认证** | ❌ 不需要（仅需邮箱） |
| **首年成本** | ¥0 |
| **部署耗时** | 20-30 分钟 |
| **技术复杂度** | 中（需配置优选IP CNAME） |

**实施步骤**：
1. 注册 Cloudflare（用现有邮箱）
2. 创建 Pages 项目 → 连接 GitHub 仓库
3. 配置优选IP CNAME（社区维护，¥0）
4. 更新 Supabase CORS 白名单（加 `*.pages.dev`）
5. 验证：评论/登录/论坛全部正常
6. 可选：配置自定义域名 + DNSPod Pro 地理路由（¥20/月，双优）

**风险**：
- 优选IP 可能失效（低概率，有 CNAME 自动化方案）
- 无 SLA（免费版）
- 需每 1-3 个月检查优选IP 状态

**详细分析**：[CLOUDBASE-VS-CLOUDFLARE-ANALYSIS.md](file:///c:/Users/lenovo/CURSOR/Snow/docs/CLOUDBASE-VS-CLOUDFLARE-ANALYSIS.md)

---

### 选项 B：维持 GitHub Pages + 添加 PWA

| 项 | 详情 |
|---|---|
| **部署平台** | GitHub Pages（不变） |
| **大陆 TTFB** | 800ms+（无改善） |
| **免费额度** | 100 GB/月流量 |
| **备案要求** | ❌ 不需要 |
| **首年成本** | ¥0 |
| **PWA 额外工作量** | 3-5 天 |
| **技术复杂度** | 低 |

**PWA 增量功能**：
- Web App Manifest：可安装到主屏幕（0.5 天）
- Service Worker：静态资源缓存，二次访问 0.3s（2 天）
- Push API：新评论推送通知（2 天）

**限制**：
- 大陆访问速度无改善（核心痛点未解决）
- 用户转化率低（首屏加载 3s+ 时流失率高）

**技术选型报告**：[TECH-SELECTION-REPORT.md](file:///c:/Users/lenovo/CURSOR/Snow/docs/TECH-SELECTION-REPORT.md)

---

## 对比矩阵

| 维度 | A: Cloudflare Pages | B: GitHub Pages + PWA |
|---|---|---|
| **大陆访问速度** | ✅ 50-100ms | ❌ 800ms+ |
| **国际访问速度** | ✅ 20-50ms | ⚠️ 100-300ms |
| **部署耗时** | 30 分钟 | 3-5 天 |
| **技术复杂度** | 中 | 低 |
| **用户体验改善** | ✅ 3x 速度提升 | ⚠️ 离线+推送 |
| **核心痛点解决** | ✅ 解决大陆慢 | ❌ 未解决 |
| **可扩展性** | ✅ Cloudflare Workers | ❌ 无 |
| **维护负担** | 中（检查优选IP） | 低（SW 版本管理） |
| **风险** | 低（有 GitHub Pages 回退） | 低 |
| **首年成本** | ¥0 | ¥0 |

---

## 决策建议

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  推荐：选项 A（Cloudflare Pages + 优选IP）                  │
│                                                              │
│  核心理由：                                                  │
│  1. 解决核心痛点（大陆访问慢）                              │
│  2. 30 分钟完成，无需备案                                   │
│  3. 无限流量，零成本                                        │
│  4. GitHub Pages 保持作为永久备用                            │
│  5. 可渐进扩展（Workers/KV/D1）                              │
│                                                              │
│  不推荐选项 B：                                              │
│  - 大陆速度无改善（核心痛点未解决）                          │
│  - PWA 的离线/推送价值有限（社区项目需在线互动）             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 已修复的维护风险

✅ **SRI 维护炸弹已修复**（commit `b0ad948`）

[scripts/build-phase2.mjs](file:///c:/Users/lenovo/CURSOR/Snow/scripts/build-phase2.mjs) 现在会在每次构建后自动更新 HTML 中的 `integrity` 属性并验证一致性，不再需要手动修改。

---

## 下一步

请选择：

- **A**：我来执行 Cloudflare Pages 部署（需要你提供 Cloudflare 账号）
- **B**：我来实施 PWA 渐进增强（3-5 天）
- **其他**：有其他想法或疑问
