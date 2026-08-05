# 角色档案扩写 · 双轮自审记录

> Codex MCP 本环境不可用，按用户规则执行同等双轮自审。  
> 日期：2026-08-05

## 一轮评审（结构化问题清单）

| 文件路径 + 位置 | 风险等级 | 整改思路 |
|----------------|----------|----------|
| `characters/lucilla/index.html` · zone-stats「学生」含莫宁 | 中 | 莫宁为教授/下属，非学生 → 已改为「学生/下属」分列表述 |
| `characters/denia/index.html` · 时间线「归于尽」站内失踪口径标成【同人共识】 | 中 | 站内口径属【本站原创】→ 已改徽标 |
| `characters/*/index.html` · 脚注 HTML 内嵌 source-tier | 低 | 可接受；与正文徽标一致，便于读者辨层 |
| `scripts/_expand-char-archives.mjs` | 低 | 一次性生成器；保留便于复跑，非正式运行时依赖 |
| `css/style.css` · source-tier / relic / anchor | 低 | 仅增样式，无大重构；与既有 details 折叠兼容 |
| 与 `docs/WORLDVIEW.md` | 低 | 抽查：未改悲鸣/海蚀定义；9072/结契人保持原创标注 |

## 二轮复核

- 七角均 8 个折叠模块；背景 5–6 段时间线；含信物、频率气质、官方锚点。
- 无模板残留（`${`）、无 `friendship` 英文漏网。
- 每页 `<main>`/`</main>` 成对；默认仅背景 `open`。
- **验证通过**（无 Codex；自审二轮通过）。

## 本轮新查 URL

1. https://www.233leyuan.com/post-detail/2018143169989447680 （档案公开·爱弥斯）【官方转载】
2. https://wiki.biligame.com/wutheringwaves/共鸣者/爱弥斯 【交叉】
3. https://wutheringwaves.fandom.com/zh/wiki/爱弥斯/鉴定报告与故事 【交叉】
4. https://zh.wikipedia.org/wiki/達妮婭 【交叉】
5. https://mzh.moegirl.org.cn/西格莉卡 【交叉】
6. https://wiki.biligame.com/wutheringwaves/共鸣者/琳奈 【交叉】
7. https://zh.moegirl.tw/洛瑟菈 · https://wiki.biligame.com/.../洛瑟菈 【交叉】
8. https://www.233leyuan.com/post-detail/2010524556466483200 （莫宁展示）【官方转载】
9. https://vertiniris.github.io/I-MISS-YOU/ 【线上核验】
10. 复用 `docs/WORLDVIEW.md` 第七章 WeGame/库洛列表
