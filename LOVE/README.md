# 飞行雪绒 ❄️

> 「我知道，只要抬头，那颗星总能找到我」

鸣潮角色 爱弥斯（Aemeath）的秘密歌手身份「飞行雪绒」的同人社交账号页面。

## 项目结构

```
LOVE/
├── index.html          # 主页面
├── css/
│   └── style.css       # 全部样式（含暗色模式、玻璃拟态、动画系统）
└── js/
    ├── main.js          # 核心逻辑（动态/日志/音乐/评论/投稿/彩蛋）
    ├── particles.js     # Three.js 粒子系统
    ├── repository.js    # 数据抽象层（localStorage ↔ Supabase）
    └── supabase-adapter.js  # Supabase 云端同步适配器
```

## 技术栈

- HTML5 + CSS3（玻璃拟态 + 渐变动画 + 响应式）
- 原生 JavaScript（无框架）
- Three.js（粒子背景，CDN 加载）
- Supabase（可选云端同步）
- Web Audio API（音乐合成）

## 本地运行

直接用浏览器打开 `index.html`，或者用任意静态服务器：

```bash
python -m http.server 8080
# 访问 http://localhost:8080
```

## 部署

推送到 GitHub → Settings → Pages → 选择 `main` 分支 → Save，即可通过 `https://用户名.github.io/仓库名/` 访问。
