# vendor/ — 自托管第三方运行时库

> 所有库均从官方 GitHub 仓库或 npm registry 下载预编译版本，本地自托管。
> 规避 CDN 单点故障风险（R-08），Cloudflare Pages 部署零外部依赖。

## 清单

| 库 | 版本 | 用途 | 优先级 |
|---|---|---|---|
| DOMPurify | 3.2.7 | XSS 防护 — UGC innerHTML 前消毒 | P0 必装 |
| Notyf | 3.10.0 | Toast 通知 — 统一操作反馈 | P0 必装 |
| lazysizes | 5.3.2 | 图片懒加载 — 首屏 LCP/CLS 优化 | P1 推荐 |
| marked | 14.1.3 | Markdown 渲染 — 评论/帖子格式化 | P1 推荐 |
| highlight.js | 11.11.2 | 代码语法高亮 — 论坛代码块 | P1 推荐 |
| PhotoSwipe | 5.4.4 | 图片灯箱画廊 — 手势缩放浏览 | P1 推荐 |
| Just-Validate | 4.3.0 | 表单验证 — 登录/注册/发帖 | P1 推荐 |

完整元数据（含 SRI 哈希、集成代码片段、使用示例）见 `manifest.json`。

## 集成方法

### 1. P0 必装（立即可接入 index.html / forum/index.html）

```html
<!-- DOMPurify（head 内，bundle 之前） -->
<script src="vendor/dompurify/purify.min.js"
        integrity="sha384-2m6jHxAbjK2Ek09HQz6ZgdZJUHtgE5lCktvnidnOVD5ecaGIpi67pb29q2cv5IGG"
        crossorigin="anonymous"></script>

<!-- Notyf（head 内） -->
<link rel="stylesheet" href="vendor/notyf/notyf.min.css"
      integrity="sha384-snpJ3knpH6avB6cP1vPkNdmRzCYaCpom/3TNOyvo189BiogXYXQfXkyYpZ2/xADs"
      crossorigin="anonymous">
<script src="vendor/notyf/notyf.min.js"
        integrity="sha384-uuNfwJfjOG2ukYi4eAB11/t3lP4Zjf75a3UhgkLzEpiX8JpJfacpG7Ye+0tiVMxT"
        crossorigin="anonymous"></script>
```

### 2. P1 推荐（按功能模块接入）

```html
<!-- lazysizes（head 内，async） -->
<script src="vendor/lazysizes/lazysizes.min.js"
        integrity="sha384-3gT/vsepWkfz/ff7PpWNUeMzeWoH3cDhm/A8jM7ouoAK0/fP/9bcHHR5kHq2nf+e"
        crossorigin="anonymous" async></script>

<!-- marked + highlight.js（论坛/评论区页面） -->
<script src="vendor/marked/marked.min.js"
        integrity="sha384-k8o8HikHweyzW55Wd3wl18ovJj6vHVYNQeQbeSM0fxx+0WiH4TcccOG9uz8Xd2JR"
        crossorigin="anonymous"></script>
<link rel="stylesheet" href="vendor/highlight.js/github.min.css"
      integrity="sha384-eXhR3uCUc39mn7jqQ6P/DUclSePvUlwhHmYpNNWZIbcdBaj7ekw2VYxf3q89+sjr"
      crossorigin="anonymous">
<script src="vendor/highlight.js/highlight.min.js"
        integrity="sha384-pA3mpJvEhf/IyTTsw12TX+ddwHnNWAKnzCciMJXDDhSTuLoG2WOwZF90suJw6hk5"
        crossorigin="anonymous"></script>

<!-- Just-Validate（含表单的页面） -->
<script src="vendor/just-validate/just-validate.production.min.js"
        integrity="sha384-MTEqTcTyVLHVQNcumujWT8ThfE2tAm0jR8FP+YSLHn3KRydBdxTYaiK9USgsaU5e"
        crossorigin="anonymous"></script>

<!-- PhotoSwipe（含画廊的页面，ESM 模块） -->
<link rel="stylesheet" href="vendor/photoswipe/photoswipe.min.css">
<script type="module">
  import PhotoSwipeLightbox from './vendor/photoswipe/photoswipe-lightbox.esm.min.js';
  const lightbox = new PhotoSwipeLightbox({
    gallery: '#gallery',
    children: 'a',
    pswpModule: () => import('./vendor/photoswipe/photoswipe.esm.min.js')
  });
  lightbox.init();
</script>
```

## CSP 适配

在 `_headers` 文件（Cloudflare Pages 根目录）的 CSP 中，`script-src` 和 `style-src` 已含 `'self'`，本地 vendor/ 路径自动放行，无需额外白名单。

## 版本更新

```powershell
# 更新单个库（以 DOMPurify 为例）
Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/cure53/DOMPurify/main/dist/purify.min.js' -OutFile 'vendor\dompurify\purify.min.js'

# 重新生成 SRI 哈希
$bytes = [System.IO.File]::ReadAllBytes('vendor\dompurify\purify.min.js')
$hash = [Convert]::ToBase64String([System.Security.Cryptography.SHA384]::Create().ComputeHash($bytes))
Write-Output "sha384-$hash"

# 更新 manifest.json 中的 sri 字段 + HTML 中的 integrity 属性
```

## 许可证

各库许可证见 `manifest.json`。所有库均允许非商业项目使用。
