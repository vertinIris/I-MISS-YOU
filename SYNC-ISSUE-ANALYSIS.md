# 飞行雪绒站点同步问题根因与解决方案分析

> 版本：基于当前代码库（v7.6 / v10.1 迁移已执行）
> 问题截图：`clipboard-2026-08-02T15-08-39-612Z-c34682d7.jpg`
> 错误提示：`同步失败：Cannot set properties of undefined (setting 'id')`

---

## 0. 结论速览（TL;DR）

| 问题 | 结论 |
|------|------|
| 是否**必须**开启 Supabase Anonymous Sign-ins 才能消除这个 TypeError？ | **不是必须**。TypeError 本身是代码对「未拿到会话对象」的防御不足导致的，可以通过加 null/undefined 校验修复。 |
| 是否必须开启 Anonymous Sign-ins 才能使用跨设备云端同步？ | **在当前架构下是**。所有写入 Supabase 的操作都必须经过 RLS（Row Level Security）校验，必须有一个合法 `author_id`；匿名登录是当前获取会话的最简方式。 |
| 该问题属于哪种同步机制？ | **数据同步（Data Sync）**，具体是用户生成内容（评论、投稿）在本地 localStorage 与云端 Supabase PostgreSQL 之间的双向同步，并附带 Realtime 广播与离线队列。 |
| 推荐的最快修复？ | 1) 在 Supabase Dashboard 启用 Anonymous Sign-ins；2) 同时在代码层加固空值检查，避免同样的错误在弱网、会话过期、服务端策略变更时再次出现。 |

---

## 1. 问题背景与原因分析

### 1.1 观察到的现象

用户点击同步按钮后，页面顶部弹出 Toast：

```
同步失败：Cannot set properties of undefined (setting 'id')
```

该 Toast 来自 `js/main.js` 中 `performFullCloudSync()` 的外层 `.catch`（第 3866 行）：

```js
}).catch(function(err) {
    if (err && err.message !== 'not_authenticated') {
        console.warn('[Sync] 全量同步失败:', err);
        showSubmitToast('❌ 同步失败：' + (err.message || '未知错误'), 5000);
    }
}).finally(...);
```

这说明同步流程在 `ensureCloudConnected()` 之后、最终渲染之前抛出了未捕获的 TypeError，而不是预期的「未认证」提示。

### 1.2 直接原因：对 undefined 对象赋值 `.id`

代码中存在多处 `X.id = ...` 赋值：

- `js/main.js:2506` — 评论云端返回后补全乐观项 ID：
  ```js
  comments[i].id = cloudRow.id;
  ```
- `js/main.js:2849` — 投稿云端返回后补全乐观项 ID：
  ```js
  latest[pi].id = cloudRow.id;
  ```
- `js/repository.js:276` — 补传本地-only 评论后回写 ID：
  ```js
  list[idx].id = row.id;
  ```
- `js/repository.js:538 / 540` — 合并投稿列表时写入云端 ID：
  ```js
  existing.id = incoming.id;
  ```

正常流程中这些赋值都有前置条件保护。但当 **匿名登录失败、会话对象不存在** 时，某些中间对象（如 `cloudRow`、`existing`、`comments[i]`）可能变为 `undefined`，而调用栈继续向下执行，最终在上述某一行触发了 `undefined.id = ...`。

### 1.3 根本原因：匿名认证是云端写入的“硬门槛”

站点使用 Supabase 作为云端后端。Supabase 的 RLS 策略要求：

```sql
-- comments / submissions 的写入策略示例（简化）
WITH CHECK (auth.role() = 'anon' OR auth.role() = 'authenticated')
```

因此，**任何写入都必须先拿到一个 auth session**。当前实现通过 `supabase.auth.signInAnonymously()` 在后台静默获取会话（见 `js/supabase-adapter.js:246`）：

```js
function ensureAuth() {
    if (!isReady) return Promise.resolve(null);
    return client.auth.getSession().then(function(result) {
        if (result.data && result.data.session) {
            currentUser = result.data.session.user;
            return currentUser;
        }
        /* 无现有会话 → 匿名登录 */
        return client.auth.signInAnonymously().then(function(signInResult) {
            if (signInResult.error) {
                console.warn('[SupabaseAdapter] 匿名登录失败:', signInResult.error.message);
                return null;
            }
            currentUser = signInResult.data.user;
            console.log('[SupabaseAdapter] 匿名登录成功, uid:', currentUser.id);
            return currentUser;
        });
    });
}
```

当 Supabase Dashboard 中 **Authentication → Anonymous Sign-ins 未启用** 时，`signInAnonymously()` 会返回错误，`currentUser` 保持 `null/undefined`。后续流程：

1. `DataRepository.fullCloudSync()` → `SupabaseAdapter.ensureAuth()` 返回 `null`；
2. `SupabaseAdapter.syncPendingQueue()` 继续执行（只检查了 `currentUser` 是否存在，没有直接终止整个流程）；
3. `addComment` / `addSubmission` 内部会把写入加入 `pendingSync` 队列并返回 `null`；
4. 合并、补传、渲染等下游代码没有充分处理「返回值为 undefined/null」或「数组项缺失」的情况，于是触发了 `Cannot set properties of undefined (setting 'id')`。

简言之：

> **表面是 TypeError，根因是认证失败；认证失败的根因是 Anonymous Sign-ins 未启用。**

---

## 2. 当前同步机制的工作原理

### 2.1 机制类型：数据同步（Data Sync）

本问题涉及的是 **数据同步**，不是状态同步（UI 状态如菜单开关、主题模式），也不是配置同步（站点设置）。同步的数据实体包括：

- 评论（comments）：6 个动态区 + 3 篇日志的评论区
- 投稿（submissions）：社区论坛中的文字/故事/诗歌/插画/音乐投稿
- 点赞数、删除令牌、昵称等元数据

这些数据需要：

1. **持久化**：用户刷新页面后内容不丢失；
2. **跨设备一致**：同一用户在不同浏览器/手机上看到相同评论与投稿；
3. **实时传播**：A 设备发表评论后，B 设备尽快收到；
4. **离线可用**：弱网或无网时仍可本地发布，恢复后自动补传。

### 2.2 整体架构（文本图示）

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              浏览器端                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌───────────┐ │
│  │   main.js    │   │ repository.js│   │supabase-     │   │sync-      │ │
│  │  UI / 业务   │◄──┤  数据抽象层  │◄──┤adapter.js   │◄──┤manager.js │ │
│  │  乐观渲染    │   │  合并/持久化 │   │Supabase 包装 │   │Realtime/  │ │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └─────┬─────┘ │
│         │                  │                  │                 │       │
│         ▼                  ▼                  ▼                 ▼       │
│   localStorage ◄────────────────────►  Supabase Auth / Postgres / Realtime│
│   (fxre_comments_*                       (匿名登录 / RLS / 行级订阅)      │
│    fxre_submissions                                                     │
│    fxre_pending_sync)                                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 核心模块职责

#### 2.3.1 `js/supabase-adapter.js`

- 封装 Supabase 客户端；
- 初始化时尝试匿名登录（`ensureAuth` / `ensureAuthWithTimeout`）；
- 提供 `addComment`、`addSubmission`、`getComments`、`getSubmissions`、`deleteComment` 等 CRUD；
- 维护 `pendingSync` 离线队列：`queuePending()`、`syncPendingQueue()`；
- 写入失败且非配额错误时，把任务入队，等待下次同步重试。

#### 2.3.2 `js/repository.js`

- 统一数据访问接口，业务代码只调用 `DataRepository`；
- `initCloud()` 初始化云端，成功后切到 `provider = 'supabase'`；
- 双写策略：`addComment` / `addSubmission` 先写云端，失败则本地保留；
- `mergeComments()` / `mergeSubmissions()`：云端优先合并，v10.1 新增“云端权威剔除”逻辑，删除远端已删的本地记录；
- `syncLocalOnlyComments()`：把仅存在本地（无 id）的评论补传到云端。

#### 2.3.3 `js/sync-manager.js`

- 管理同步状态机：`REALTIME`、`POLLING`、`OFFLINE`、`RECONNECTING`、`SYNCING`；
- 为每个 `target_id` 建立 Realtime 通道监听 `postgres_changes`（INSERT/UPDATE/DELETE）；
- Realtime 不可用时降级为 15 秒轮询；
- 提供右下角同步指示器。

#### 2.3.4 `js/main.js`

- 处理用户提交评论/投稿；
- 乐观更新：先写本地并渲染，再异步写云端；
- 云端返回后通过 `patchList` / 投稿循环补全 `id`；
- `performFullCloudSync()`：手动同步入口，负责协调认证、上传 pending、拉取、刷新 UI。

### 2.4 写入流程示例（评论）

1. 用户点击发送；
2. `main.js:handleCommentSubmit()` 生成本地乐观评论 `newComment`（无 `id`，仅有 `time`）；
3. 先 `saveComments(targetId, comments)` 到 localStorage 并渲染；
4. 调用 `DataRepository.addComment(targetId, {author, color, text}, extraFields)`；
5. `DataRepository` 调用 `SupabaseAdapter.addComment()`；
6. 如果已登录：`doInsert()` 直接 INSERT；
7. 如果未登录：`ensureAuth()` → `signInAnonymously()`；
   - 成功：拿到 `currentUser`，继续 INSERT；
   - 失败：`queuePending()`，返回 `null`；
8. 云端返回后，`main.js` 的 `.then(function(cloudRow) { ... })` 把本地乐观项的 `id` 补为 `cloudRow.id`。

### 2.5 离线队列机制

`fxre_pending_sync` 中存储待同步任务：

```json
[
  { "action": "addComment", "targetId": "post_1", "comment": {...}, "timestamp": "..." },
  { "action": "addSubmission", "submission": {...}, "timestamp": "..." }
]
```

`syncPendingQueue()` 会批量重试：

- 每条任务调用 `addComment` / `addSubmission`；
- 成功 `synced++`；
- 失败（非配额）重新入队；
- 最终返回 `{synced, failed, remaining, quotaSkipped, errors}`。

---

## 3. 是否必须开启匿名模式？

### 3.1 直接回答

- **消除 TypeError 本身**：不是必须。只要对同步链路中的 `undefined`/`null` 做好防御，即使 Anonymous Sign-ins 关闭，也可以优雅降级为“仅本地模式”，不再抛错。
- **启用跨设备云端同步**：在当前 Supabase + RLS 架构下，**必须**有一种认证方式让服务端识别写入者。Anonymous Sign-ins 是当前选定的认证方式；关闭它之后，没有任何替代机制能创建合法会话，因此云端写入必然失败。

### 3.2 匿名模式的局限性

即使开启 Anonymous Sign-ins，也需要清楚它的限制：

| 局限 | 说明 |
|------|------|
| **会话易丢失** | 匿名会话存储在浏览器 localStorage / cookie 中，用户清除缓存、换浏览器、隐私模式、卸载重装后，会话与历史数据归属会丢失。 |
| **无跨浏览器身份** | 同一用户在手机、PC、平板上会被识别为不同的 `anon` 用户，无法形成统一身份。 |
| ** Supabase 配额** | Free Tier 对 MAU（月活用户）和请求数有限制，每个匿名用户都占一个 MAU；高并发或恶意刷接口会快速消耗配额。 |
| **权限管理复杂** | RLS 需要同时兼容 `anon` 和 `authenticated` 角色，策略写错会导致“谁都写不了”或“谁都能删”。 |
| **升级到注册用户的摩擦** | `upgradeToRegistered()` 依赖 `updateUser`，需要邮件确认；如果用户长期以匿名身份活跃，一旦会话丢失就无法认领历史内容。 |
| **安全边界有限** | 匿名 ID 可被伪造请求复用（如果 RLS 不够严格），不适合高敏感度内容。 |

---

## 4. 可行的解决方式

### 4.1 方案 A：开启 Anonymous Sign-ins + 代码加固（推荐，成本最低）

**步骤：**

1. 登录 Supabase Dashboard → Authentication → Providers → Anonymous Sign-ins → **Enable**；
2. 确保 RLS 策略允许 `anon` 角色插入 / 删除自己的记录；
3. 在代码层加固空值检查，防止同样的 TypeError 在其他异常路径复现。

**建议补丁位置：**

```js
// js/main.js:2483 附近
DataRepository.addComment(...)
    .then(function(cloudRow) {
        if (!cloudRow) {
            // 云端未返回：已加入 pending，不需要报错
            return;
        }
        if (cloudRow._error) {
            showSubmitToast('评论已显示，但云端同步失败：' + cloudRow._error, 6000);
            updateSyncStatus();
            return;
        }
        if (cloudRow.id) {
            // ... 补全 id
        }
    })
    .catch(function(err) { ... });
```

```js
// js/repository.js:syncLocalOnlyComments 内部
.then(function(row) {
    if (row && row.id) {
        // 再次确认 list[idx] 仍存在
        if (list[idx]) {
            list[idx].id = row.id;
            list[idx].authorId = row.author_id || '';
        }
    }
})
```

```js
// js/main.js:performFullCloudSync 外层
// 把 showSubmitToast('❌ 同步失败：' + err.message) 中的 err 做脱敏处理，
// 避免把 Supabase 内部错误直接暴露给用户。
```

### 4.2 方案 B：保留本地优先，关闭云端同步（彻底回避）

如果不追求跨设备同步，可以直接：

- 在 `js/repository.js` 中默认 `provider = 'localStorage'` 且不调 `initCloud()`；
- 隐藏右下角同步指示器；
- 所有评论/投稿仅本地存储。

**优点**：无外部依赖、无认证、无配额。
**缺点**：无跨设备、无实时、数据随浏览器丢失。

### 4.3 方案 C：替换为邮箱/密码或 OAuth 登录

把匿名登录改为显式登录：

- 用户评论/投稿前必须登录；
- 使用 `supabase.auth.signInWithPassword()` 或 OAuth；
- 历史内容归属稳定，支持跨设备身份。

**优点**：身份持久、权限清晰、便于版主管理。
**缺点**：提高了使用门槛，与“零 friction”的同人站体验冲突。

### 4.4 方案 D：Serverless 代理写入（去 RLS 依赖）

新增一个 Cloudflare Workers / Vercel Edge / Supabase Edge Function 作为代理：

```
浏览器 ──HTTP POST──► Edge Function ──service_role key──► Supabase
```

- 浏览器不再需要登录，只需一个匿名指纹（fingerprint）或临时 token；
- Edge Function 负责校验内容长度、频率、黑名单，然后用 `service_role` 写入；
- RLS 对 service_role 开放，或对代理函数使用 Postgres 角色绕过。

**优点**：彻底摆脱匿名登录；可精确控制配额与风控。
**缺点**：引入额外基础设施与成本；需要维护代理代码。

### 4.5 方案 E：只读云端 + 本地写入（单向同步）

- 云端只作为“广播源”：管理员或种子脚本写入；
- 普通用户评论/投稿仅保存在本地；
- 所有用户都能读取云端的种子/官方内容。

**优点**：不需要任何用户认证；部署简单。
**缺点**：用户之间无法看到彼此的评论/投稿，社区功能名存实亡。

---

## 5. 完整替代方案设计（如需推翻重设计）

如果决定放弃当前「Supabase 匿名用户 + RLS + 双写」的架构，推荐以下替代设计，兼顾匿名体验、跨设备同步与可维护性。

### 5.1 目标

1. 用户无需注册即可评论/投稿；
2. 同一设备/浏览器内的数据持久化；
3. 可选的跨设备同步（通过邮箱验证码或 OAuth 绑定）；
4. 高防刷、反垃圾；
5. 服务端可审计、可回滚。

### 5.2 架构：Local-First + Server-Backed Sync

```
┌────────────────────────────────────────────────────────────────────┐
│                           客户端（浏览器）                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │ 本地 SQLite/IDB │  │  Sync Engine    │  │   Anonymous Token   │ │
│  │ (评论/投稿缓存) │  │ (CRDT / 版本向量)│  │  (device fingerprint)│ │
│  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘ │
│           │                    │                      │            │
│           └────────────────────┼──────────────────────┘            │
│                                ▼                                    │
│                        HTTP/JSON Sync API                          │
└────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│                            服务端                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────┐ │
│  │  API Gateway │──│  Rate Limiter│──│  Sync Worker │──│  Postgres│ │
│  │  (验证 token)│  │  (IP + 设备) │  │  (合并/去重) │  │  (主存)  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────┬────┘ │
│                                                             │      │
│  ┌──────────────────────────────────────────────────────────┘      │
│  │  Event Stream (SSE / WebSocket) — 实时广播给在线客户端            │
│  └─────────────────────────────────────────────────────────────────┘
└────────────────────────────────────────────────────────────────────┘
```

### 5.3 数据模型（简化）

```sql
-- 设备/会话令牌表
CREATE TABLE device_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fingerprint TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    last_seen   TIMESTAMPTZ DEFAULT NOW(),
    is_banned   BOOLEAN DEFAULT FALSE
);

-- 评论表
CREATE TABLE comments (
    id          BIGSERIAL PRIMARY KEY,
    target_id   TEXT NOT NULL,
    device_id   UUID REFERENCES device_tokens(id),
    author_name TEXT NOT NULL,
    author_color TEXT NOT NULL,
    content     TEXT NOT NULL CHECK (LENGTH(content) BETWEEN 2 AND 500),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);
CREATE INDEX idx_comments_target ON comments(target_id, created_at) WHERE deleted_at IS NULL;

-- 投稿表
CREATE TABLE submissions (
    id          BIGSERIAL PRIMARY KEY,
    type        TEXT NOT NULL,
    title       TEXT NOT NULL,
    content     TEXT NOT NULL,
    device_id   UUID REFERENCES device_tokens(id),
    author_name TEXT NOT NULL,
    author_color TEXT NOT NULL,
    likes       INT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

-- 同步游标（支持增量同步）
CREATE TABLE sync_cursors (
    device_id   UUID PRIMARY KEY REFERENCES device_tokens(id),
    last_sync_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.4 核心 API 设计

```http
# 1. 获取或注册设备令牌
POST /api/v1/device/register
Body: { fingerprint: "sha256(...)" }
Response: { deviceToken: "...", expiresIn: 2592000 }

# 2. 增量拉取评论（从 last_sync_at 之后）
GET /api/v1/comments?target=post_1&since=2026-08-01T00:00:00Z
Response: { items: [...], cursor: "2026-08-02T15:10:00Z" }

# 3. 发表评论
POST /api/v1/comments
Headers: Authorization: Bearer <deviceToken>
Body: { target_id: "post_1", author_name: "...", author_color: "...", content: "..." }
Response: { id: 12345, created_at: "..." }

# 4. 删除自己的评论
DELETE /api/v1/comments/12345
Headers: Authorization: Bearer <deviceToken>

# 5. 实时事件流
GET /api/v1/events/stream?token=<deviceToken>
# Server-Sent Events: insert / update / delete
```

### 5.5 安全与风控

1. **Rate Limiter**：
   - 每设备每 10 分钟最多 10 条评论；
   - 每 IP 每小时最多 100 次写入；
   - 投稿需要验证码或冷却 1 分钟。
2. **内容审核**：
   - 关键词过滤 + 人工举报；
   - 新设备前 3 条评论需异步审核（延迟显示）。
3. **删除权限**：
   - 仅设备 token 持有者或管理员可删除；
   - 删除后通过事件流广播，所有客户端同步移除。
4. **跨设备绑定（可选）**：
   - 用户输入邮箱 → 服务端发送 6 位验证码 → 两个 device_token 绑定到同一 `user_id`；
   - 历史评论/投稿按 `user_id` 重新归属。

### 5.6 客户端同步引擎（Local-First）

```js
// 伪代码
class SyncEngine {
    async pull(targetId) {
        const since = await idb.get(`cursor:${targetId}`);
        const { items, cursor } = await api.comments.list(targetId, since);
        for (const item of items) await this.merge(item);
        await idb.set(`cursor:${targetId}`, cursor);
    }

    async push(localItem) {
        try {
            const remote = await api.comments.create(localItem);
            localItem.id = remote.id;
            localItem.synced = true;
            await idb.put(localItem);
        } catch (err) {
            localItem.pending = true;
            await idb.put(localItem);
            this.scheduleRetry();
        }
    }

    async merge(remote) {
        const local = await idb.get(remote.client_uuid);
        if (local && local.synced) return; // 已同步，无需覆盖
        await idb.put({ ...local, ...remote, synced: true });
    }
}
```

### 5.7 与现有方案对比

| 维度 | 现有方案（Supabase 匿名） | 替代方案（Local-First + 自建 API） |
|------|--------------------------|-----------------------------------|
| 认证门槛 | 低（自动匿名登录） | 中（设备指纹/token） |
| 跨设备同步 | 难（匿名会话不跨设备） | 易（邮箱验证码绑定） |
| 依赖外部服务 | 强依赖 Supabase | 仅依赖 Postgres + 可选 Workers |
| 风控能力 | 受限于 RLS 与 Supabase 配额 | 完全可控 |
| 开发/运维成本 | 低 | 中 |
| 实时性 | Supabase Realtime | SSE / WebSocket 自建 |

---

## 6. 立即可执行的修复清单

如果只想在当前代码库上快速止血，按优先级执行：

1. **启用 Supabase Anonymous Sign-ins**（必须，否则云端写入永不成功）。
2. **加固 `main.js:2483` 与 `2843` 的 `.then` 回调**：先判断 `cloudRow` 是否存在，再读取 `cloudRow.id`。
3. **加固 `repository.js:syncLocalOnlyComments`**：确保 `list[idx]` 仍存在再赋值。
4. **加固 `repository.js:mergeSubmissions` 的 `mergeEntry`**：即使 `existing` 理论上不会为空，也加一层 `if (!existing || typeof existing !== 'object') return incoming;`。
5. **改进错误提示**：在 `performFullCloudSync` 的 catch 中区分「未认证」「网络错误」「未知 TypeError」，避免把原始 JS 错误文案直接展示给用户。
6. **补充自动化测试**：在 Anonymous Sign-ins 关闭的模拟环境下跑一遍评论提交 + 手动同步，验证无未捕获异常。

---

## 7. 总结

- 截图中的 `Cannot set properties of undefined (setting 'id')` 是 **认证失败后的次生错误**，不是同步机制本身的缺陷。
- 该问题属于 **数据同步（Data Sync）**，对象是评论与投稿。
- **开启 Anonymous Sign-ins 不是消除 TypeError 的唯一办法，但在当前 Supabase + RLS 架构下是实现云端写入的必要条件。**
- 匿名模式的局限主要在于会话脆弱、无法跨设备统一身份、Supabase 配额和权限管理复杂。
- 如果希望彻底摆脱这些限制，建议迁移到 **Local-First + 自建 Sync API** 架构，用设备 token 替代 Supabase 匿名用户，并可选地通过邮箱验证码实现跨设备绑定。
