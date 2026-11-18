# 审美类 Skill 安装报告（2026-11-18）

> 来源：用户提供的小红书榜单截图「审美篇·Codex TOP 4」
> 安装位置：用户级 `C:\Users\lenovo\.workbuddy\skills\`（跨项目可用）

---

## 一、来源核实

图中星数（截于 2026-10-30）经 GitHub API 核实**全部真实**，且截至今日又涨了一截：

| 仓库 | 图中星数 | 今日实测 | 作者/用途 |
|---|---|---|---|
| `Leonxlnx/taste-skill` | 103.8k | **118,083** | 给编码 agent 装艺术指导：先找参考图定方向，做完用浏览器自查 |
| `pbakaus/impeccable` | 90.8k | **112,565** | 设计词汇表：`polish` / `bolder` / `critique` / `audit` 等 24 个命令 |
| `cathrynlavery/diagram-design` | 62.7k | **68,077** | 45 种图表类型，输出 HTML/SVG，明确拒绝 Mermaid 模板味 |
| `Nutlope/hallmark` | 39.3k | **57,218** | 反 AI slop：专治紫渐变/圆角卡片/千篇一律气质 |

---

## 二、安装结果

| Skill 目录 | 触发名（`name`） | 版本 | 文件数 | 体积 | 状态 |
|---|---|---|---|---|---|
| `skills/taste-skill/` | `design-taste-frontend` | 2.5.1 | 1,631 | 38 MB | ✅ 已识别 |
| `skills/impeccable/` | `impeccable` | 4.9.2 | 69 | 3 MB | ✅ 已安装（显示待刷新） |
| `skills/diagram-design/` | `diagram-design` | 2.6 | 317 | 7 MB | ✅ 已识别 |
| `skills/hallmark/` | `hallmark` | 2.0.0 | 187 | 8 MB | ✅ 已识别 |

**合计**：约 56 MB，2,204 个文件。

### impeccable 的特殊处理

用户级目录中**原本已有一个 impeccable**（7 月 3 日装的 SkillHub 旧版，10KB SKILL.md）。本次操作：

1. 旧版备份 → `C:\Users\lenovo\.workbuddy\skills-backup\impeccable-20261118\`（已移出 skills 扫描目录，避免同名冲突）
2. 新版采用仓库自带的**预生成通用 agent 版** `.agents/skills/impeccable/`，而非源模板 `skill/SKILL.src.md`
   - 原因：源模板含 `{{scripts_path}}`、`{{command_prefix}}` 等占位符，须经官方构建脚本替换才能用；预生成版 **0 个残留占位符**，自带 `scripts/impeccable.cmd`（Windows 适配）
3. 新版描述与命令表完整（24 个命令 + detector 引擎 + hooks）

⚠️ 技能列表首次显示的是**旧版缓存**；移走备份后新版记录消失 —— 文件本身已就位且 frontmatter 合法，**重启会话后即会重新索引**。

---

## 三、安全审查

下载的是完整仓库 zip（合计 ~143MB），只提取 `skills/<name>/` 子目录。对其中 `.sh/.js/.ts/.py/.ps1/.cmd/.md` 扫了危险模式（`curl|sh`、`eval(`、`rm -rf`、`sudo`、`Invoke-Expression` 等）：

| Skill | 命中 | 判定 |
|---|---|---|
| taste-skill | 0 | 干净 |
| hallmark | 0 | 干净 |
| impeccable | 2 | `hermes-plugin/__init__.py` 的 `subprocess.run` —— 官方插件启动器，非注入逻辑 |
| diagram-design | 2 | `doctor.md` 提到 headless Chromium；`mermaid_extract.py` 中 `"subprocess"` 是字符串字面量 —— 均为误报 |

无恶意代码。四个 SKILL.md 的 YAML frontmatter 均合法，0 占位符残留。

---

## 四、怎么用（触发方式）

这四个都是**描述驱动**的技能，不需要手动 `/` 命令，正常说话即可触发：

| 想做什么 | 怎么说 |
|---|---|
| 改造本站视觉、重做落地页 | 「用 taste-skill 重新设计主站首页」或「这个页面太 AI 味了，用 design-taste-frontend 改一遍」 |
|  critique / 精修现有 UI | 「用 impeccable critique 当前论坛投稿弹窗」/ `polish` / `bolder` / `quieter` / `audit` |
| 画架构图/流程图 | 「用 diagram-design 画一张双站数据流图，输出 SVG」 |
| 全新页面、拒绝 AI 脸 | 「用 hallmark 给日志页做一个新视觉」 |

⚠️ **hallmark 的特殊约束**：它明确写在描述里 —— 只在**新建**设计时使用；对已有设计，除非你点名 `/hallmark redesign <path>`，否则不应触发。

**与飞行雪绒现有设计系统的关系**：这四个技能都带「反 AI slop」倾向，和本项目 `redesign/refined.css` + `css/site-v2.css` 的「反 AI 味编辑式」路线一致。但它们**不认识**本站的硬约束（玫白蓝三色、禁 color-mix/oklch、夜电台页脚彩蛋全集、双站文案岔开、SW CACHE_VERSION bump）。让它们改本站代码时，必须把这些约束显式写在指令里，否则可能产出「好看但破坏红线」的改动。

---

## 五、下载与安装明细（可复现）

```bash
# 下载（本机 schannel 需 --ssl-no-revoke，否则 CRYPT_E_NO_REVOCATION_CHECK）
curl --ssl-no-revoke -L -o taste-skill.zip \
  https://codeload.github.com/Leonxlnx/taste-skill/zip/refs/heads/main
# ... 其余三个同理

# 安装（用户级）
cp -r <repo>/skills/taste-skill   ~/.workbuddy/skills/taste-skill
cp -r <repo>/.agents/skills/impeccable  ~/.workbuddy/skills/impeccable
cp -r <repo>/skills/diagram-design ~/.workbuddy/skills/diagram-design
cp -r <repo>/skills/hallmark      ~/.workbuddy/skills/hallmark
```

临时 zip 与解压目录：`C:\Users\lenovo\AppData\Local\Temp\wb-skills-20261118\`（约 300MB，可自行清理）。
