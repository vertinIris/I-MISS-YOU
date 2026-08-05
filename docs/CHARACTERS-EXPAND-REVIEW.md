# 角色档案扩写 · 评审记录（回归官方 · 双轮自审）

> 日期：2026-08-06  
> 指令：「回归官方，但是务必保证最新结果以及全面」  
> 范围：`characters/{aimisi,denia,sigrica,linne,mornye,lucilla,drifter}/index.html` + `docs/WORLDVIEW.md` + `docs/worldview-glossary.json` + `论坛内容/事实卷宗/卷九-索拉里斯世界观.md` + `scripts/_expand-char-archives.mjs`  
> Codex MCP：环境中 **无 Codex 工具**，按用户规则执行**同等双轮自审**并落盘本记录。  
> 资料优先级：【官方】→【同人共识】→【本站原创】；**主线任务文本与档案公开短文同等官方权重**。  
> 线上对照：https://vertiniris.github.io/I-MISS-YOU/ ——若与本地差，**以本地校标为准**。

---

## 一轮评审（结构化问题清单）

| # | 文件路径 + 位置 | 风险等级 | 整改思路 |
|---|-----------------|----------|----------|
| 1 | `characters/aimisi/index.html` · 幼年「磁暴研究员父母」曾降为【同人共识】 | **高** | 2026 再检索：3.1 主线硬文本 + 萌百/百科一致写明父母=磁暴研究员、虚质磁暴吞噬、记忆消褪。**升回【官方 · 3.1 主线】**；注明档案公开短文未收录幼年≠非官方；「笔记与录音」物件仍【同人共识】。 |
| 2 | `characters/aimisi/index.html` · 渐湖小屋 / 家人 / 英雄梦想 | **高** | 主线与角色故事可核对 → 升【官方 · 3.1】；情感修辞句保留【同人共识】。 |
| 3 | `characters/aimisi/index.html` · 同步率拔尖 / 飞行雪绒校园歌手 | **中** | 剧情侧升【官方 · 剧情】；多平台官号等仍【同人共识 / 企划外延】。 |
| 4 | `characters/aimisi/index.html` · 「轻松快乐地活着」/「人的本质是频率」 | **中** | 角色故事有对应表述 → 升【官方】。 |
| 5 | `characters/denia/index.html` · 锚点将「失踪/无威胁」标【同人共识】 | **高** | 官方仅「虚质放逐」；「失踪」「未对学院构成直接威胁」一律【本站原创】；hero/时间线/锚点三处对齐。 |
| 6 | `scripts/_expand-char-archives.mjs` | **中** | 一次性生成器可能覆盖人工校标 → 默认 `process.exit(1)`，需 `FORCE_EXPAND_CHAR_ARCHIVES=1`；脚本内 aimisi 模板同步官方口径。 |
| 7 | `docs/WORLDVIEW.md` / 卷九 / glossary | **中** | 回写爱弥斯幼年与达妮娅原创口径；增补虚质磁暴、渐湖术语；URL 表加主线权重与线上对照说明。 |
| 8 | 其余五角色（西格莉卡/琳奈/莫宁/洛瑟菈/漂泊者） | **低** | 本轮抽样：共鸣力名（语义解现/折光溢彩/星枢演构/记忆宫殿）、学部与势力无降级错误；篇幅模块未变薄，保持。 |

---

## 二轮复核

| 检查项 | 结果 |
|--------|------|
| 爱弥斯幼年/渐湖已标【官方 · 3.1】且注明档案公开短文空白 | ✅ |
| 达妮娅「无威胁」仅【本站原创】，官方句只保留虚质放逐 | ✅ |
| 七页均保留时间线/性格/战斗/关系/信物/频率/语录/锚点折叠结构 | ✅（未删模块） |
| 西格莉卡「语义解现」、达妮娅「虚质科学部」、爱弥斯「长航的星辉」仍在 | ✅ |
| glossary JSON 可解析；含虚质磁暴 / 渐湖；飞行雪绒 tier=official（频道外延在 summary 标明） | ✅ |
| 生成器默认拒写 | ✅（无 FORCE 时 exit 1） |
| Codex | ❌ 不可用 → 本双轮自审等价闭环 |
| git commit | ❌ 未执行（遵用户要求） |

### 验证通过条件

- 一轮高/中风险项均已落地；  
- 无「把共识/原创标成官方」残留于待确认项；  
- **结论：【验证通过】**（无 Codex 前提下的同等双轮自审）。

---

## 合入前一致性补丁（2026-08-06 · 本批 PUSH）

| 文件路径 + 位置 | 风险等级 | 整改 |
|-----------------|----------|------|
| `characters/*/index.html` · Google Fonts | 中 | 改为 `media=print` + `onload` 非阻塞；失败走 tokens 系统 CJK 栈 |
| `css/tokens-snow.css` / `tokens-stf.css` · `--font-*` | 低 | 补强 PingFang / YaHei / Songti / Consolas 回退 |
| `css/zone-atmosphere.css` · `prefers-reduced-motion` | 低 | 与主站对齐：折叠/顶栏 transition 归零 |
| `css/style.css` · `.source-tier` | 低 | 窄屏允许换行，防徽标撑破 |
| 七页路径 / `#characters-archive` / tokens-snow | — | 结构抽查通过；未 commit `论坛内容/` / `.cursor/skills/` |

**二次复核：验证通过**（smoke + extreme + 落盘评审；无 Codex）。

---

## 论坛挂载与上云边界（结构补丁 · 与世界观轮同步）

| 约定 | 说明 |
|------|------|
| 入口 | 仅 `forum/index.html#characters-archive` → `characters/*/index.html` |
| 扩展层字段 | 页内 `source-tier`（官方 / 同人共识 / 本站原创）；**不**写入 `forum_submissions` |
| 与世界观区 | 宇宙规则长文在 `#worldview` / `docs/WORLDVIEW.md`；档案页不重复地理总典 |
| 美术 | 保持现有档案卡 / orbit；不新增与玫夜·蓝金令牌冲突的分区皮肤 |
| 讨论区卡片文案 | 入口短句可为剧情摘要；完整分层以角色页为准（如达妮娅威胁口径） |


## 本轮新查 / 复核 URL

| URL | 用途 | 层级 |
|-----|------|------|
| https://www.233leyuan.com/post-detail/2018143169989447680 | 爱弥斯档案公开「长航的星辉」 | 官方转载 |
| https://www.233leyuan.com/post-detail/2006787812311240704 | 立绘&档案：电子幽灵 / 长航的星辉 | 官方转载 |
| https://baike.baidu.com/item/爱弥斯/67090098 | 父母虚质磁暴、渐湖、家人线 | 百科交叉 |
| https://zh.moegirl.org.cn/爱弥斯 | 磁暴研究员、渐湖小屋、飞行雪绒剧情归纳 | 萌百交叉 |
| https://zh.moegirl.org.cn/海蚀现象 | 虚质磁暴=拉海洛地域海蚀表现 | 萌百交叉 |
| https://wiki.biligame.com/wutheringwaves/共鸣者/爱弥斯 | 鉴定报告 / 角色故事（人的本质·频率等） | Wiki |
| https://wiki.biligame.com/wutheringwaves/共鸣者/达妮娅 | 虚质科学部 / 泡影视阈 | Wiki |
| https://zh.moegirl.org.cn/达妮娅(鸣潮) | 虚质放逐结局；勿将站内威胁口径混入 | 萌百 |
| https://www.sina.cn/news/detail/5265467746027558 | 西格莉卡官方档案·语义解现 | 官方微博转载 |
| https://wiki.biligame.com/wutheringwaves/共鸣者/西格莉卡 | 语义解现确认 | Wiki |
| https://wiki.biligame.com/wutheringwaves/共鸣者/琳奈 | 折光溢彩交叉 | Wiki |
| https://news.qq.com/rain/a/20260205A05UFU00 | 3.1 试玩：渐湖小屋情感锚点 | 媒体转述 |
| https://draw.market/zh/blog/wuthering-waves-3-1-main-story-emys-analysis-spoilers.html | 3.1 主线解析（交叉，非权威） | 剧情分析 |
| https://vertiniris.github.io/I-MISS-YOU/ | 线上部署对照 | 部署 |

---

## 标注升降一览（本轮）

| 条目 | 变更 |
|------|------|
| 爱弥斯父母 / 虚质磁暴 / 记忆消褪 | 同人共识 → **官方 · 3.1 主线** |
| 渐湖小屋 + 家人/英雄梦想（事实核） | 部分共识 → **官方 · 3.1** |
| 同步率拔尖 / 校园飞行雪绒歌手 | 共识 → **官方 · 剧情** |
| 「轻松快乐地活着」/「人的本质是频率」 | 共识 → **官方** |
| 笔记与录音物件、多平台官号、情感修辞 | 保持 / 明确 **同人共识或企划外延** |
| 达妮娅「失踪 / 无直接威胁」 | 锚点误标共识 → **本站原创**（官方仅虚质放逐） |
| glossary「飞行雪绒」 | project_original → **official**（summary 标明频道原创） |
| 新增 glossary：虚质磁暴、渐湖 | **official** |
