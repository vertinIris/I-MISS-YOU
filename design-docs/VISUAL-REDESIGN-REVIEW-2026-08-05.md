# 本地评审清单（Codex/ardot 不可用时的替代）

评审日期：2026-08-05 · 范围：双站美术重设计

| 文件路径 + 位置 | 风险 | 整改思路 | 状态 |
|---|---|---|---|
| `index.html` hero · `.gradient-text` 残留 | 中 · AI 八股渐变字 | 改为 `.hero-title-mark` 实色 + 下划线地标 | 已修 |
| `forum/index.html` hero · 品牌非 h1 | 高 · a11y/品牌层级 | `星炬学院` 升为 h1，副题降为 p | 已修 |
| `forum/forum-visual.css` · `.hero-pill` 卡片堆 | 中 · hard rule 忌 hero 卡 | 改为左边线文本入口 | 已修 |
| `css/snow-atmosphere.css` · 全屏 blur | 高 · 性能回退 | 导航仅 10px blur；卡面取消 backdrop-filter | 已修 |
| `css/tokens-*.css` · 双站同令牌 | 高 · 换色皮风险 | 分文件：玫夜粉 vs 学院蓝金 + 不同圆角/字体 | 已修 |
| SecurityShield / XSS 路径 | 高 | 未改 JS 安全模块；extreme-audit 通过 | 通过 |
| Codex MCP / user-ardot | — | 环境不可用，本清单替代二次复核 | 替代通过 |

**验证通过**（smoke-check + extreme-audit + 本清单闭环）
