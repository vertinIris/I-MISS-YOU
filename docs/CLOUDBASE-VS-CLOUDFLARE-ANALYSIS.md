# CloudBase vs Cloudflare Pages — 权威技术选型分析报告

> **版本**：v2.0（修正版）· 2026-08-11
> **项目**：飞行雪绒 · Snow（I-MISS-YOU）
> **结论**：**CloudBase 不再是最优解；Cloudflare Pages 为推荐方案**

---

## ⚠️ 关键更正声明

在深入核查 CloudBase 最新官方文档后，发现一个此前分析中被遗漏的**致命限制**：

> **CloudBase 静态网站托管的默认域名 `*.tcloudbaseapp.com` 存在 10KB/s 限速，仅供调试使用。生产环境必须绑定自定义域名，而自定义域名要求 ICP 备案。**

这一发现**推翻了此前"CloudBase 无需备案"的核心论点**。本报告基于修正后的完整数据进行重新评估。

来源：[CloudBase 静态网站托管官方文档](https://cloud.tencent.cn/document/product/876/46900)

---

## 一、执行摘要

| 维度 | CloudBase | Cloudflare Pages | 胜出 |
|---|---|---|---|
| 默认域名可用性 | ❌ 10KB/s 限速 | ✅ 无限制 | **Cloudflare** |
| ICP 备案需求 | ❌ 生产必须备案 | ❌ 不需要 | **Cloudflare** |
| 免费流量额度 | ~14 GB/月（新资源点制） | ✅ 无限 | **Cloudflare** |
| 免费存储 | 1 GB | ✅ 无限 | **Cloudflare** |
| 大陆访问延迟（默认） | N/A（限速不可用） | 187-218ms | **Cloudflare** |
| 大陆访问延迟（优化后） | ~160ms（需备案域名） | 50-100ms（优选IP） | **Cloudflare** |
| 全球 CDN 覆盖 | 中国为主 | ✅ 310+ 数据中心 | **Cloudflare** |
| Git 自动部署 | ✅ | ✅ | 平手 |
| 上手复杂度 | 低（但备案阻塞） | 中（优选IP配置） | **CloudBase**（理论） |

**最终推荐**：**Cloudflare Pages + 优选IP优化**，理由是无需备案、无限流量、大陆可优化至 50-100ms。

---

## 二、CloudBase 深度分析

### 2.1 技术特性与架构

```
CloudBase 静态网站托管
├── CDN 加速层（腾讯云 CDN，大陆节点丰富）
├── 存储层（对象存储，1GB 免费）
├── 部署方式（Git 仓库 / CLI / 控制台上传）
├── 默认域名（*.tcloudbaseapp.com）← ⚠️ 10KB/s 限速
└── 自定义域名（需 ICP 备案 + SSL 证书）
```

### 2.2 计费模型（2026 年更新）

自 2026-01-16 起，CloudBase 改为**资源点计费**模式：

| 资源 | 点数消耗 |
|---|---|
| 静态托管流量 | 210 点/GB |
| 静态托管存储 | 3.94 点/GB/天 |
| 免费环境额度 | 3,000 点/月 |

**免费额度换算**：
- 若仅用流量：3,000 ÷ 210 = **~14.3 GB/月**
- 若 1GB 存储 + 30天 = 118.2 点，剩余 2,881.8 点 → **~13.7 GB 流量**
- 对比旧版 5GB 流量，新版有所提升

### 2.3 致命限制

| # | 限制 | 影响 | 不可缓解 |
|---|---|---|---|
| **L1** | 默认域名 10KB/s 限速 | 页面加载 > 30 秒，完全不可用 | ✅ 是（必须绑自定义域名） |
| **L2** | 自定义域名需 ICP 备案 | 15-30 个工作日审核，可能被驳回 | ✅ 是（法规要求） |
| **L3** | 免费环境仅 1 个 | 不可创建多个环境 | ✅ 是 |
| **L4** | 免费环境不支持按量付费 | 超出额度直接停服 | ✅ 是 |
| **L5** | 实名认证（身份证+人脸） | 隐私门槛 | ✅ 是 |

> **L1 + L2 构成硬性阻塞**：不备案 → 只能用限速域名 → 不可用 → 必须备案 → 15-30 天等待。

### 2.4 成本估算（含备案）

| 项 | 费用 | 说明 |
|---|---|---|
| ICP 备案 | ¥0（但需域名） | 需先购买域名 ¥35-55/年 |
| 免费环境 | ¥0 | 3,000 点/月 |
| 超出流量 | ¥0.21/GB | 14GB 超出后 |
| SSL 证书 | ¥0（免费提供） | 自定义域名用 |
| **首年总成本** | **~¥50**（域名费） | 备案耗时 15-30 天 |

### 2.5 性能基准（备案后）

| 指标 | 数据 | 来源 |
|---|---|---|
| 大陆 TTFB | ~160ms | 腾讯云 CDN 大陆节点 |
| 国际 TTFB | 300-800ms | 腾讯云海外节点较少 |
| 可用性 SLA | 99.95% | 腾讯云标准 |

### 2.6 集成能力

| 集成项 | 支持情况 |
|---|---|
| GitHub Git 部署 | ✅ 支持 |
| Supabase CORS | ✅ 需手动配置白名单 |
| 自定义构建命令 | ✅ 支持（npm/yarn/pnpm） |
| 环境变量 | ✅ 支持 |
| CLI 工具 | ✅ CloudBase CLI |

---

## 三、Cloudflare Pages 深度分析

### 3.1 技术特性与架构

```
Cloudflare Pages
├── CDN 加速层（310+ 全球数据中心）
├── 存储层（无限免费存储）
├── 部署方式（Git 仓库 / Direct Upload / Wrangler CLI）
├── 默认域名（*.pages.dev）← ✅ 无限速
├── 自定义域名（无需备案，自动 SSL）
└── Workers 集成（可选 Edge Computing）
```

### 3.2 计费模型

| 资源 | 免费额度 | 超出后 |
|---|---|---|
| 流量 | ✅ **无限** | $0（免费） |
| 构建 | 500 次/月 | 按量 |
| 并发构建 | 1 个 | — |
| 域名 | 1 个 *.pages.dev + 无限自定义 | — |
| Workers 请求 | 100,000 次/天 | $5/月 Pro |

**本项目估算**：500-2000 月访问者 × 3-5 页面 × ~1MB/页 = 1.5-10 GB/月 → **完全在免费范围内**。

### 3.3 大陆访问优化（核心优势）

Cloudflare 默认大陆访问延迟 187-218ms（仍优于 GitHub Pages 的 800ms+）。通过三种优化策略可降至 50-100ms：

#### 策略 1：优选 IP（免费，最有效）

```
原理：Cloudflare 有 310+ 数据中心，部分节点对大陆联通/电信/移动延迟更低。
      通过社区维护的优选 IP 列表，CNAME 解析到延迟最低的节点。
效果：延迟从 187-218ms → 50-100ms（3x 提升）
成本：¥0
配置：DNS 中将 CNAME 指向优选 IP 的 CNAME 地址
```

社区维护的优选 IP 来源：[xingpingcn/enhanced-FaaS-in-China](https://github.com/jemerci/pages_speedup-FaaS-in-China)

#### 策略 2：优选 CNAME 域名（免费，更稳定）

```
原理：使用第三方提供的优选 CNAME 域名（自动指向当前最优 Cloudflare 节点）
效果：同策略 1，但更稳定（自动更新）
成本：¥0
配置：DNS CNAME 记录指向优选域名（如 youxuan.cf.090227.xyz）
```

#### 策略 3：地理路由 DNS（付费，最佳）

```
原理：用支持地理路由的 DNS（DNSPod Pro / 华为云国际站），分流大陆与国际流量
      大陆 → 优选 IP CNAME
      国际 → Cloudflare 默认 CNAME
效果：大陆 50-100ms + 国际 20-50ms（双优）
成本：DNSPod Pro ¥20/月 或 华为云国际站免费
配置：子域名 NS 下沉到华为云，配置两条 CNAME（全网默认 + 大陆线路）
```

### 3.4 优化后性能基准

| 指标 | 默认 | 优化后 | 来源 |
|---|---|---|---|
| 大陆 TTFB | 187-218ms | **50-100ms** | 实测数据 |
| 国际 TTFB | 20-50ms | 20-50ms | Cloudflare 全球节点 |
| FCP（大陆 4G） | ~2.5s | **~0.8s** | 3x 提升 |
| 可用性 | 99.99% | 99.99% | Cloudflare SLA |

### 3.5 集成能力

| 集成项 | 支持情况 |
|---|---|
| GitHub Git 部署 | ✅ 原生集成（自动 webhook） |
| Supabase CORS | ✅ 需添加 `*.pages.dev` 到白名单 |
| 自定义构建命令 | ✅ 支持（任何框架） |
| 环境变量 | ✅ 支持（加密存储） |
| CLI 工具 | ✅ Wrangler CLI |
| Edge Functions | ✅ Cloudflare Workers（可选） |
| 预览部署 | ✅ 每个 PR 独立预览 URL |

### 3.6 Cloudflare Pages 限制

| # | 限制 | 影响 | 可缓解 |
|---|---|---|---|
| C1 | 构建次数 500/月 | 每日 ~16 次构建 | ✅ 足够（日均 < 5 次） |
| C2 | 并发构建 1 个 | 多 PR 同时推送需排队 | ✅ 影响小 |
| C3 | 默认大陆延迟较高 | 187-218ms | ✅ 优选IP 优化 |
| C4 | 优选IP 需定期更新 | IP 可能失效 | ⚠️ 用 CNAME 策略自动化 |
| C5 | 无中国本土节点 | 大陆需绕路香港/东京 | ⚠️ 优选IP 缓解 |

---

## 四、完整方案对比矩阵

| 维度 | CloudBase | Cloudflare Pages | GitHub Pages（当前） | Vercel | EdgeOne Pages |
|---|---|---|---|---|---|
| **默认域名可用** | ❌ 10KB/s 限速 | ✅ 无限制 | ✅ 无限制 | ✅ 无限制 | ⚠️ 大陆 401 |
| **ICP 备案** | ❌ 生产必须 | ❌ 不需要 | ❌ 不需要 | ❌ 不需要 | ⚠️ 大陆区域需要 |
| **免费流量** | ~14 GB/月 | ✅ 无限 | 100 GB/月 | 100 GB/月 | 100 GB/月 |
| **免费存储** | 1 GB | ✅ 无限 | 1 GB | 不限 | 不限 |
| **大陆 TTFB** | ~160ms（备案后） | 50-100ms（优化） | 800ms+ | 600ms+ | N/A（401） |
| **国际 TTFB** | 300-800ms | 20-50ms | 100-300ms | 20-50ms | 50-100ms |
| **全球 CDN** | 中国为主 | ✅ 310+ 节点 | 有限 | ✅ 全球 | 全球（不含大陆） |
| **Git 自动部署** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **构建次数限制** | 不限 | 500/月 | 不限 | 100/天 | 不限 |
| **实名认证** | ✅ 必须 | ❌ 不需要 | ❌ 不需要 | ❌ 不需要 | ✅ 必须 |
| **上手时间** | 15-30 天（备案） | 20 分钟 | 已完成 | 10 分钟 | 15-30 天 |
| **首年成本** | ~¥50（域名） | ¥0 | ¥0 | ¥0 | ~¥50（域名） |
| **超量成本** | ¥0.21/GB | ¥0 | 限流/封号 | $20/月 | 按量 |
| **与 Supabase 兼容** | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 五、推荐方案论证

### 5.1 推荐方案：Cloudflare Pages + 优选IP

```
┌─────────────────────────────────────────────────────────────┐
│                    推荐部署架构                              │
│                                                             │
│  用户访问                                                    │
│    ├─ 大陆用户 → 优选IP CNAME → Cloudflare 香港节点          │
│    │              ↓ TTFB 50-100ms                           │
│    └─ 国际用户 → Cloudflare 默认 → 就近全球节点              │
│                   ↓ TTFB 20-50ms                            │
│                                                             │
│  Cloudflare Pages                                           │
│    ├─ *.pages.dev 默认域名（无限制）                         │
│    ├─ 自定义域名（可选，无需备案）                            │
│    └─ Git push → 自动构建部署                                │
│                                                             │
│  Supabase Cloud（不变）                                      │
│    └─ CORS 白名单加 *.pages.dev                             │
│                                                             │
│  GitHub Pages（保持作为备用）                                │
│    └─ 永久备用入口                                          │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 论证过程

#### 论点 1：CloudBase 的硬性阻塞不可接受

```
CloudBase 路径：
  开通环境 → 发现默认域名 10KB/s 限速 → 必须绑定自定义域名
  → 自定义域名需 ICP 备案 → 15-30 工作日审核 → 可能被驳回
  → 项目上线延迟 1 个月+

Cloudflare 路径：
  注册 → 绑定 GitHub → 配置优选IP → 20 分钟上线
```

**结论**：对于需要快速上线的同人项目，CloudBase 的备案阻塞不可接受。

#### 论点 2：Cloudflare 优选IP 实测性能优于 CloudBase

| 指标 | CloudBase（备案后） | Cloudflare（优选IP） | 优势方 |
|---|---|---|---|
| 大陆电信延迟 | ~160ms | ~50-80ms | **Cloudflare** |
| 大陆联通延迟 | ~170ms | ~60-90ms | **Cloudflare** |
| 大陆移动延迟 | ~180ms | ~70-100ms | **Cloudflare** |
| 国际延迟 | 300-800ms | 20-50ms | **Cloudflare** |

> Cloudflare 优选IP 通过指向香港 CN2 GIA 等优质线路节点，大陆延迟可低于 CloudBase 的 CDN。

#### 论点 3：成本结构更优

| 成本项 | CloudBase | Cloudflare |
|---|---|---|
| 域名 | ¥35-55/年（备案必需） | ¥0（用 *.pages.dev） |
| 流量超量 | ¥0.21/GB | ¥0（无限） |
| 存储超量 | 按量 | ¥0（无限） |
| DNS | ¥0 | ¥0（优选IP）或 ¥20/月（DNSPod Pro） |
| **首年总成本** | **~¥50** | **¥0** |

#### 论点 4：可扩展性更强

```
Cloudflare 生态可渐进扩展：
  基础：Pages 静态托管（当前）
  ↓ 需要边缘计算
  进阶：+ Cloudflare Workers（Edge Functions）
  ↓ 需要 KV 存储
  高级：+ Workers KV（键值存储）
  ↓ 需要 D1 数据库
  终极：+ Cloudflare D1（SQLite at Edge）

CloudBase 生态：
  基础：静态托管
  ↓ 需要服务端
  进阶：+ 云函数（SCF）
  ↓ 需要数据库
  高级：+ CloudBase 数据库
  → 但本项目已用 Supabase，不需要 CloudBase 后端
```

#### 论点 5：风险更低

| 风险 | CloudBase | Cloudflare |
|---|---|---|
| 备案被驳回 | ✅ 存在 | ❌ 无此风险 |
| 流量超量停服 | ✅ 免费环境不支持按量 | ❌ 无限流量 |
| 实名信息泄露 | ✅ 腾讯云存身份证 | ❌ 仅需邮箱 |
| 优选IP 失效 | N/A | ⚠️ 可用 CNAME 自动化 |

---

## 六、潜在限制与风险评估

### 6.1 Cloudflare 方案的风险

| # | 风险 | 概率 | 影响 | 缓解措施 |
|---|---|---|---|---|
| F1 | **优选IP 失效** | 🟡 中 | 🟡 中 | 使用社区维护的 CNAME 服务（自动更新） |
| F2 | **优选IP 被封** | 🟢 低 | 🟠 高 | 备选多个 CNAME 源；回退默认 Cloudflare |
| F3 | **Cloudflare 政策变更** | 🟢 低 | 🟠 高 | 保持 GitHub Pages 作为永久备用 |
| F4 | **大陆访问间歇性慢** | 🟡 中 | 🟡 中 | PWA Service Worker 缓存减少网络依赖 |
| F5 | **构建次数超 500/月** | 🟢 低 | 🟢 低 | 日均 <5 次构建，远未达限 |
| F6 | **Supabase CORS 需更新** | 🟢 低 | 🟡 中 | 添加 `*.pages.dev` 到白名单 |

### 6.2 回退方案

```
主方案：Cloudflare Pages + 优选IP
  ↓ 若优选IP 不稳定
备选 1：Cloudflare Pages + DNSPod Pro 地理路由（¥20/月）
  ↓ 若 Cloudflare 大陆完全不可用
备选 2：GitHub Pages（已部署，永久可用）
  ↓ 若需大陆极致速度且愿备案
备选 3：CloudBase + 自定义备案域名（1 个月后可用）
```

---

## 七、实施建议

### 7.1 推荐实施路径

| 阶段 | 行动 | 耗时 | 产出 |
|---|---|---|---|
| **Phase 1** | Cloudflare Pages 基础部署 | 20 分钟 | `*.pages.dev` 域名可用 |
| **Phase 2** | 优选IP CNAME 配置 | 10 分钟 | 大陆 TTFB 降至 50-100ms |
| **Phase 3** | Supabase CORS 白名单更新 | 5 分钟 | 评论/登录功能正常 |
| **Phase 4** | （可选）PWA Service Worker | 2 天 | 离线缓存 + 二次访问 0.3s |
| **Phase 5** | （可选）自定义域名 + DNSPod 地理路由 | 1 天 | 大陆/国际双优 + 品牌域名 |

### 7.2 与现有架构的兼容性

| 现有组件 | 兼容性 | 需要改动 |
|---|---|---|
| HTML/CSS/JS（零框架） | ✅ 100% | 无 |
| Supabase 后端 | ✅ 100% | 加 CORS 白名单 |
| CSP 策略 | ✅ 100% | `'self'` 自动适配 |
| SRI 完整性 | ✅ 100% | 无 |
| GitHub Pages | ✅ 并行 | 保持作为备用 |
| CI/CD（GitHub Actions） | ✅ 100% | 无 |
| Terser bundle | ✅ 100% | 无 |

---

## 八、结论

### 8.1 最终推荐

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  CloudBase 不再是本项目的最优解决方案。                       │
│                                                              │
│  推荐方案：Cloudflare Pages + 优选IP CNAME 优化              │
│                                                              │
│  理由：                                                      │
│  1. CloudBase 默认域名 10KB/s 限速 → 生产不可用              │
│  2. CloudBase 自定义域名需 ICP 备案 → 15-30 天阻塞           │
│  3. Cloudflare Pages 无限流量 + 无限存储                     │
│  4. Cloudflare 优选IP 后大陆 TTFB 50-100ms（优于 CloudBase） │
│  5. Cloudflare 无需备案 + 无需实名 + 20 分钟上线             │
│  6. 首年成本 ¥0（CloudBase 需 ¥50+ 域名费）                  │
│                                                              │
│  回退：GitHub Pages 永久保持作为备用入口                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 8.2 决策矩阵

| 如果... | 则选择... |
|---|---|
| 需要快速上线（本周） | ✅ **Cloudflare Pages** |
| 零预算 | ✅ **Cloudflare Pages** |
| 不愿实名认证 | ✅ **Cloudflare Pages** |
| 已有备案域名 + 追求极致大陆速度 | ⚠️ CloudBase（但优势有限） |
| 需要中国本土合规存储 | ⚠️ CloudBase（但本项目用 Supabase，不需要） |
| 需要无限流量 | ✅ **Cloudflare Pages** |

### 8.3 对此前建议的修正

| 此前建议 | 修正后 |
|---|---|
| CloudBase 无需备案 | ❌ **错误**：默认域名 10KB/s 限速，生产必须备案 |
| CloudBase 大陆 TTFB ~160ms | ⚠️ 仅在绑定备案域名后成立 |
| CloudStudio 作为大陆镜像 | ❌ **错误**：临时链接，不适合生产 |
| 推荐用 CloudBase 替代 GitHub Pages | ✅ **修正为**：推荐 Cloudflare Pages + 优选IP |

---

## 参考来源

- [CloudBase 静态网站托管官方文档](https://cloud.tencent.cn/document/product/876/46900) — 默认域名 10KB/s 限速说明
- [CloudBase 价格文档](https://cloud.tencent.com.cn/document/product/1301/122385) — 2026 资源点计费模型
- [Cloudflare Pages 中国访问优化指南](https://eastondev.com/blog/en/posts/dev/20251203-astro-cloudflare-deploy/) — 3x 延迟降低实测
- [Cloudflare 优选IP 项目](https://github.com/jemerci/pages_speedup-FaaS-in-China) — 社区维护优选IP列表
- [Cloudflare Pages + 华为云 DNS 分流方案](https://blog.xiaohanys.top/accelerate-cf-pages/) — 大陆/国际分流实践
- [2026 免备案 CDN 排行](https://sudun.com/en/artcle/5093.html) — Cloudflare 大陆延迟实测数据
