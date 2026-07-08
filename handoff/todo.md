# 飞行雪绒 v9.0 待续任务

> **接手工具**: Cursor (或其他 AI 编程助手)  
> **设计文档**: `docs/comment-system-design-v9.0.md`  
> **进度文档**: `handoff/progress.md`

---

## 任务概览

基础设施已全部就绪（4 个 migration + 4 个新 JS 模块 + adapter 更新 + CSS 样式），  
**核心剩余工作是 `main.js` 集成** — 将新模块接入现有交互流程。

---

## Task 1: main.js 集成 AuthManager + SyncManager [P0]

### 1.1 初始化（在 DOMContentLoaded 或现有 init 函数中）

```javascript
// 在现有初始化代码末尾添加：
AuthManager.init();
SyncManager.createSyncIndicator();
```

### 1.2 替换评论 Realtime 订阅

**当前代码位置**: 搜索 `subscribeComments` 调用  
**替换为**:
```javascript
SyncManager.connectComments(targetId, {
    onNewComment: function(comment) {
        // 去重检查（按 comment.id）
        // 追加到评论列表
        // 更新评论计数
    },
    onUpdateComment: function(newData, oldData) {
        // 如果 is_hidden 变为 true，从列表移除
        // 否则更新评论内容
    },
    onDeleteComment: function(oldData) {
        // 从列表移除该评论
    }
});
```

### 1.3 评论提交流程修改

**当前代码位置**: `handleCommentSubmit()` 函数  
**修改**:
```javascript
function handleCommentSubmit(targetId) {
    // ... 现有获取文本逻辑 ...
    
    // v9.0: 客户端限流
    var check = ClientRateLimiter.canSendComment(text);
    if (!check.allowed) {
        showToast(check.reason, 'warning');
        return;
    }
    
    // v9.0: 生成删除令牌
    var deleteToken = AuthManager.generateToken();
    
    // 提交到 Supabase（附带 delete_token）
    SupabaseAdapter.addComment(targetId, text, authorName, {
        delete_token: deleteToken
    }).then(function(result) {
        // 存储删除令牌
        AuthManager.storeDeleteToken(result.id, deleteToken);
        ClientRateLimiter.recordCommentSent(text);
        // ... 现有 UI 更新 ...
    });
}
```

### 1.4 评论删除流程修改

**当前代码位置**: `handleDeleteComment()` 函数  
**修改**:
```javascript
function handleDeleteComment(commentId) {
    var token = AuthManager.getDeleteToken(commentId);
    
    if (token) {
        // 匿名用户：令牌删除
        SupabaseAdapter.deleteCommentWithToken(commentId, token)
            .then(function(success) {
                if (success) {
                    AuthManager.removeDeleteToken(commentId);
                    // 移除 UI + 更新计数
                }
            });
    } else if (AuthManager.session.uid) {
        // 注册用户：身份删除（软删除 UPDATE）
        // 需要通过 RPC 或直接 UPDATE is_hidden
    } else if (AuthManager.canHideComment()) {
        // 版主操作
        SupabaseAdapter.moderateComment(commentId, 'hide', '版主隐藏')
            .then(function(success) { /* ... */ });
    }
}
```

### 1.5 评论渲染添加删除按钮

**当前代码位置**: `_renderCommentsList()` 函数  
**修改**: 每条评论渲染时检查权限：
```javascript
if (AuthManager.canDeleteComment(comment)) {
    // 添加删除按钮
}
if (AuthManager.canHideComment()) {
    // 添加隐藏按钮（版主）
}
```

### 1.6 替换旧同步按钮

**当前代码位置**: `#sync-now-btn` 事件监听  
**修改**: 保留按钮但改用 SyncManager.manualRefresh()：
```javascript
document.getElementById('sync-now-btn').addEventListener('click', function() {
    SyncManager.manualRefresh(currentTargetId);
});
```

---

## Task 2: repository.js 支持新字段 [P0]

### 2.1 mergeComments 过滤隐藏评论

```javascript
function mergeComments(localComments, cloudComments, targetId) {
    // ... 现有合并逻辑 ...
    
    // v9.0: 过滤已隐藏评论
    merged = merged.filter(function(c) {
        return c.is_hidden !== true;
    });
    
    return merged;
}
```

### 2.2 mergeSubmissions 过滤隐藏投稿

```javascript
function mergeSubmissions(localSubs, cloudSubs, typeFilter) {
    // ... 现有 byKey 合并逻辑 ...
    
    // v9.0: 过滤已隐藏投稿
    merged = merged.filter(function(s) {
        return s.is_hidden !== true;
    });
    
    return merged;
}
```

---

## Task 3: index.html 补充 UI 元素 [P0]

### 3.1 投稿区域添加拖拽上传区

在现有投稿表单中添加：
```html
<div class="upload-drop-zone" id="upload-drop-zone">
    <div class="upload-icon">📂</div>
    <div class="upload-hint">拖拽文件到此处，或点击选择文件</div>
    <div class="upload-formats">支持: .txt .md .jpg .png .gif | 限制: 文本 10MB / 图片 5MB</div>
</div>
<input type="file" id="upload-file-input" style="display:none;" accept=".txt,.md,.jpg,.png,.gif">
<div class="upload-progress" id="upload-progress">
    <div class="progress-fill"></div>
    <span class="progress-text">0%</span>
</div>
```

### 3.2 投稿区域添加标签选择器

```html
<div class="tag-filter-bar" id="submission-tag-bar">
    <span class="tag-category-label">角色</span>
    <!-- 动态填充角色标签 -->
    <span class="tag-category-label">类型</span>
    <!-- 动态填充类型标签 -->
    <span class="tag-category-label">自由标签</span>
    <!-- 动态填充自由标签 -->
</div>
```

### 3.3 社区投稿列表添加书签按钮

每条投稿卡片中添加：
```html
<button class="bookmark-btn" data-submission-id="${sub.id}" onclick="toggleBookmark(${sub.id})">
    🔖 收藏
</button>
```

### 3.4 认证升级表单

在合适位置（如导航栏或投稿区域上方）添加：
```html
<div class="auth-status-bar" id="auth-status">
    <span id="auth-status-text">匿名用户</span>
    <button onclick="toggleUpgradeForm()">升级账号</button>
</div>
<div class="auth-upgrade-form" id="auth-upgrade-form">
    <input type="email" id="upgrade-email" placeholder="邮箱">
    <input type="password" id="upgrade-password" placeholder="密码">
    <button onclick="performUpgrade()">升级</button>
</div>
```

---

## Task 4: Supabase 迁移执行 [P0]

在 Supabase Dashboard → SQL Editor 依次执行：
1. `db/migration-006-comment-moderation.sql`
2. `db/migration-007-rate-limit-v2.sql`
3. `db/migration-008-tags-bookmarks.sql`
4. `db/migration-009-storage-bucket.sql`

执行后设置管理员：
```sql
UPDATE profiles SET role = 'admin' WHERE id = '你的 auth.uid';
```

---

## Task 5: addComment 支持 delete_token 参数 [P0]

**当前问题**: `supabase-adapter.js` 的 `addComment()` 函数可能不支持传入 `delete_token`  
**修改**: 检查 `addComment()` 函数签名，添加可选参数：

```javascript
function addComment(targetId, content, authorName, extraFields) {
    // ... 现有逻辑 ...
    
    var insertData = {
        target_id: targetId,
        content: content,
        author_name: authorName || '匿名',
        // ... 其他字段 ...
    };
    
    // v9.0: 附带删除令牌
    if (extraFields && extraFields.delete_token) {
        insertData.delete_token = extraFields.delete_token;
    }
    
    return client.from('comments').insert(insertData).select().single()
        .then(function(result) { /* ... */ });
}
```

---

## Task 6: 测试清单 [P1]

- [ ] 匿名用户发评论 → 生成令牌 → 删除评论（令牌校验）
- [ ] 注册用户发评论 → 身份删除
- [ ] 版主隐藏/恢复评论
- [ ] 管理员永久删除评论
- [ ] Realtime 新评论实时显示
- [ ] Realtime 评论隐藏实时移除
- [ ] 断网后轮询降级 → 恢复后停止轮询
- [ ] 客户端限流（3秒冷却 + 重复检测）
- [ ] 投稿拖拽上传 .txt → 内容自动填入
- [ ] 投稿拖拽上传 .jpg → Storage URL 返回
- [ ] 标签筛选投稿
- [ ] 书签收藏/取消
- [ ] 匿名→注册升级（UID 不变）
- [ ] 深色/浅色主题新组件样式正确
