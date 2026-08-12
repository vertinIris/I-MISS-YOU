# 飞行雪绒 · Snow

> 「我知道，只要抬头，那颗星总能找到我」

鸣潮角色爱弥斯（Aemeath）的秘密歌手身份「飞行雪绒」的同人社交账号体验站，附独立论坛「星炬学院」。  
非商业同人创作：叙事、音乐合成、社区互动与角色档案。

**当前版本**: **v10.0**（见 [`docs/STATUS.md`](docs/STATUS.md)）  
**线上（主）**: https://i-miss-you-bcu.pages.dev/ （Cloudflare Pages，大陆访问更稳）  
**线上（备）**: https://vertiniris.github.io/I-MISS-YOU/ （GitHub Pages 源站）  
**`package.json`**: `10.0.0`

---

## 文档入口（先读这些）

| 文档 | 说明 |
|------|------|
| [**docs/README.md**](docs/README.md) | 文档索引 |
| [**docs/STATUS.md**](docs/STATUS.md) | 现状速览、版本、migration 要点 |
| [**docs/CONTENT-PIPELINE.md**](docs/CONTENT-PIPELINE.md) | 论坛内容构建管线 |
| [**docs/WORLDVIEW.md**](docs/WORLDVIEW.md) | 世界观设定与考据 |

---

## 项目结构（摘要）

```
Snow/
├── index.html                 # 主站（飞行雪绒）
├── forum/                     # 星炬学院论坛
├── characters/                # 角色专区档案页
├── css/                       # tokens + style + archive/forum 子集
├── js/                        # 主站逻辑 / Supabase 适配
├── db/                        # migration-001 … 028+
├── docs/                      # STATUS / CONTENT-PIPELINE / WORLDVIEW …
└── scripts/                   # smoke-check、内容构建等
```

---

## 快速开始

```bash
cd Snow
npm run serve          # 或双击「打开本地预览.bat」/ .\run.ps1
# 浏览器打开 http://localhost:8848
```

> 勿用 `file://` 直接打开：CDN / 云端同步可能失败。

冒烟检查：`npm run smoke-check`

云端：在 Supabase SQL Editor 按 `docs/STATUS.md` 与 `npm run db:migrate-*` 指引执行迁移；anon 配置见 `js/supabase-adapter.js`。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | HTML5 + CSS3 + 原生 JS（零框架） |
| 后端 | Supabase（PostgreSQL + Auth + Realtime + RLS） |
| 音频 | Web Audio API |
| 部署 | Cloudflare Pages（主）+ GitHub Pages（备） |

字体：Noto Sans/Serif SC（Google Fonts 非阻塞加载）→ 系统 CJK 回退（PingFang / 微软雅黑 / 宋体）。

---

## 许可

非商业同人创作。角色与设定版权归《鸣潮》及其开发商所有。代码可自由使用、修改、分发。
