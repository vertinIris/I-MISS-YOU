/**
 * 星炬学院主论坛 · 通行证系统（双轨身份版）
 * ----------------------------------------------------
 * 复用飞行雪绒主站同一 Supabase 项目（lmlyfyjffaaddysiliht）。
 *
 * 【两种身份路径，共用同一套账号存储与数据出口】
 *   A. 真实邮箱（authMode='email'）
 *      - 注册/登录直接用用户填写的邮箱；
 *      - 与飞行雪绒主站同套账号体系，同域会话自动互认；
 *      - 可被 forum_admins 命中 → 获得管理员权限；
 *      - 支持口令找回（Supabase 原生邮件流程）。
 *   B. 昵称 / 匿名口令（authMode='nickname'）
 *      - 用户只填「昵称 + 口令」，不暴露任何真实邮箱；
 *      - 昵称经 **确定性哈希** 映射为保留域合成邮箱
 *        stf_<hash>@startorch.example.com（RFC 2606 保留域，不会投递到真人）；
 *      - 哈希纯函数、不依赖 localStorage → 换设备 / 换浏览器仍可用同一昵称登录；
 *      - 昵称唯一性由 Supabase 邮箱唯一约束天然保证；
 *      - 合成邮箱永远不可能命中 forum_admins → 天然无法提权。
 *
 * 两条路径最终都汇入 applyUser()，产出形状完全一致的 current 对象，
 * 因此 forum.js / forum-cloud.js 无需区分身份来源（数据一致性保证）。
 *
 * 公开 API（对 forum.js 保持向后兼容）：
 *   getUser() -> { key:uid, name, color, joined, posts, email, authMode }
 *   register(payload) / login(payload) —— payload 为对象；
 *     亦兼容旧式位置参数 register(email, nickname, pwd) / login(email, pwd)
 *   logout / onChange / isForumAdmin / bumpPostCount / openPanel
 *
 * 降级：若 supabaseClient 未就绪（CDN 失败/离线），register/login 明确报错，
 *      但「匿名身份发帖」路径（forum.js 中 user 为 null 时）仍可用。
 *
 * 【双套 Auth 边界 · 勿大重构】
 *   主站 AuthManager（js/auth-manager.js）与本模块分属两套 UI/镜像键；
 *   权威会话是同项目 Supabase GoTrue（同域 persistSession 共享）。
 *   主站镜像 `fxre_auth_session` ≠ 论坛镜像 `stf_session`；显式退出用
 *   `stf_explicit_logout`。合并两套仅当产品要求统一 UI，现状以文档约定为准。
 */
window.StarTorchAuth = (function () {
    'use strict';

    var SESSION_MIRROR_KEY = 'stf_session';     // 本地镜像：离线时仍可用 UI

    // 昵称身份的合成邮箱域：RFC 2606 保留域，不存在真实收件人，且 Supabase 接受其格式
    var SYNTHETIC_DOMAIN = 'startorch.example.com';
    var SYNTHETIC_PREFIX = 'stf_';

    // 多管理员：与 db/migration-021 的 forum_admins 表保持一致（前端仅用于 UI 显隐，
    // 真正权限由 Supabase RLS 的 is_forum_admin() 裁定）。增删管理员请改 SQL 表。
    var FORUM_ADMIN_EMAILS = ['2473609011@qq.com', '3604893605@qq.com'];

    var AVATAR_COLORS = ['#FF6B9D', '#6B8AFF', '#B66BFF', '#7FD99E', '#E8C56A', '#A8D8FF', '#FF9E7A'];
    var listeners = [];
    var current = null;

    /* ---------- storage（本地映射 / 镜像，非口令） ---------- */
    function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function safeSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
    function safeRemove(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }

    function randomColor() { return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]; }

    function sanitizeColor(c) {
        if (!c) return '#6B8AFF';
        var s = String(c).trim();
        if (/^#[0-9A-Fa-f]{3,8}$/.test(s)) return s;
        if (/^var\(--[\w-]+\)$/.test(s)) return s;
        if (/^rgb(a?)\([\d\s,.%/]+\)$/.test(s)) return s;
        if (/^hsl(a?)\([\d\s,.%/]+\)$/.test(s)) return s;
        return '#6B8AFF';
    }

    /* ==================================================================
     * 身份解析层（Identity Resolver）
     * 把「用户填了什么」统一翻译成「Supabase 认识的 email + 展示昵称」。
     * 注册与登录共用同一套解析，保证两条路径落到同一账号上（数据一致性）。
     * ================================================================== */

    /* UTF-8 字节序列：保证中文昵称在任何浏览器上得到同一组字节 */
    function utf8Bytes(str) {
        if (typeof TextEncoder === 'function') return new TextEncoder().encode(str);
        var esc = unescape(encodeURIComponent(str)); /* 降级路径：等价 UTF-8 */
        var out = new Array(esc.length);
        for (var i = 0; i < esc.length; i++) out[i] = esc.charCodeAt(i) & 0xff;
        return out;
    }

    function toHex8(n) { return ('00000000' + (n >>> 0).toString(16)).slice(-8); }

    /**
     * 确定性哈希（FNV-1a ×2 + djb2 三通道 → 24 hex）。
     * 选用同步纯函数而非 crypto.subtle：后者是异步且在非安全上下文不可用，
     * 一旦环境差异导致降级，同一昵称会算出两个邮箱 → 账号分裂。
     * 此实现无环境依赖，任何设备/浏览器结果一致。
     */
    function hashHex(str) {
        var bytes = utf8Bytes(str);
        var h1 = 0x811c9dc5, h2 = 0x01000193, h3 = 5381;
        for (var i = 0; i < bytes.length; i++) {
            var b = bytes[i];
            h1 = Math.imul(h1 ^ b, 0x01000193) >>> 0;
            h2 = Math.imul((h2 + b) >>> 0, 0x85ebca6b) >>> 0;
            h2 = (h2 ^ (h2 >>> 13)) >>> 0;
            h3 = ((Math.imul(h3, 33) >>> 0) ^ b) >>> 0;
        }
        /* 混入长度，进一步降低短昵称碰撞概率 */
        h1 = Math.imul(h1 ^ bytes.length, 0x27d4eb2d) >>> 0;
        return toHex8(h1) + toHex8(h2) + toHex8(h3);
    }

    /* 昵称归一化：去首尾空格 + 折叠内部连续空白 + 小写 + Unicode 规范化 */
    function normalizeNick(name) {
        var n = String(name || '').trim().replace(/\s+/g, ' ');
        if (n.normalize) { try { n = n.normalize('NFKC'); } catch (e) { /* ignore */ } }
        return n.toLowerCase();
    }

    /* 昵称 -> 稳定合成邮箱（跨设备一致，无需任何本地映射表） */
    function nickToEmail(name) {
        return SYNTHETIC_PREFIX + hashHex(normalizeNick(name)) + '@' + SYNTHETIC_DOMAIN;
    }

    function isSyntheticEmail(email) {
        return String(email || '').toLowerCase().indexOf('@' + SYNTHETIC_DOMAIN) !== -1;
    }

    function isValidEmail(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
    }

    function normalizeMode(m) { return m === 'nickname' ? 'nickname' : 'email'; }

    /**
     * 统一凭据解析。
     * @param {object} opts  { mode, email, nickname, password }
     * @param {boolean} requireNickname 注册时为 true（邮箱模式也必须有显示名）
     * @returns {{email:string, nickname:string, authMode:string}}
     * @throws {Error} 校验不通过
     */
    function resolveIdentity(opts, requireNickname) {
        var authMode = normalizeMode(opts && opts.mode);

        if (authMode === 'nickname') {
            var nick = String((opts && opts.nickname) || '').trim().replace(/\s+/g, ' ');
            if (nick.length < 2 || nick.length > 20) throw new Error('昵称需 2–20 个字符');
            if (isValidEmail(nick)) throw new Error('昵称不能填邮箱地址 —— 如需邮箱登录请切换到「邮箱」方式');
            return { email: nickToEmail(nick), nickname: nick, authMode: 'nickname' };
        }

        var email = String((opts && opts.email) || '').trim();
        if (!isValidEmail(email)) throw new Error('请输入有效的邮箱地址');
        if (isSyntheticEmail(email)) throw new Error('该域名为系统保留，请换用真实邮箱');
        var nk = String((opts && opts.nickname) || '').trim().replace(/\s+/g, ' ');
        if (requireNickname && (nk.length < 2 || nk.length > 20)) {
            throw new Error('显示名需 2–20 个字符');
        }
        return { email: email.toLowerCase(), nickname: nk, authMode: 'email' };
    }

    /* 兼容旧式位置参数调用：register(email, nickname, pwd) / login(email, pwd) */
    function normalizePayload(args, kind) {
        var first = args[0];
        if (first && typeof first === 'object') return first;
        if (kind === 'register') {
            return { mode: 'email', email: first, nickname: args[1], password: args[2] };
        }
        return { mode: 'email', email: first, password: args[1] };
    }

    /* Supabase 原生英文报错 -> 贴合当前身份模式的中文提示 */
    function friendlyError(rawMsg, authMode, phase) {
        var m = String(rawMsg || '');
        if (/already\s*registered|already\s*exists|duplicate/i.test(m)) {
            return authMode === 'nickname'
                ? '这个昵称已经被占用了，换一个，或直接用它登录'
                : '该邮箱已注册，请直接登录（或使用找回口令）';
        }
        if (/invalid\s*login\s*credentials/i.test(m)) {
            return authMode === 'nickname'
                ? '昵称或口令不正确（没注册过的话请先注册）'
                : '邮箱或口令不正确';
        }
        if (/email.*invalid|invalid.*email/i.test(m)) {
            return authMode === 'nickname'
                ? '这个昵称无法用于建立通行证，换一个试试'
                : '邮箱格式不被服务端接受，请检查后重试';
        }
        if (/password/i.test(m) && /short|least|weak/i.test(m)) return '口令太短，请至少 6 位';
        if (/rate|too many/i.test(m)) return '操作过于频繁，请稍后再试';
        return m || (phase === 'register' ? '注册失败' : '登录失败');
    }

    /* ---------- 当前用户视图 ---------- */
    function emit() {
        listeners.forEach(function (fn) {
            try { fn(current); } catch (e) { /* ignore */ }
        });
    }

    function publicView(uid, name, color, joined, posts, email, authMode, role) {
        return {
            key: uid,
            name: name,
            color: color,
            joined: joined || Date.now(),
            posts: posts || 0,
            email: email || null,
            /* 'email' = 真实邮箱身份；'nickname' = 昵称/匿名口令身份 */
            authMode: authMode || (isSyntheticEmail(email) ? 'nickname' : (email ? 'email' : null)),
            /* 合成邮箱不对外展示（避免用户误以为那是自己的邮箱） */
            displayEmail: (email && !isSyntheticEmail(email)) ? email : null,
            /* profiles.role：user / moderator / admin（论坛管理 UI 用） */
            role: role || 'user'
        };
    }

    function saveMirror(v) { safeSet(SESSION_MIRROR_KEY, JSON.stringify(v)); }
    function loadMirror() { try { return JSON.parse(safeGet(SESSION_MIRROR_KEY)); } catch (e) { return null; } }
    function clearMirror() { safeRemove(SESSION_MIRROR_KEY); }

    /* 主站注册未采集昵称时，profiles.nickname 默认为「匿名信号源」——不得当作真实展示名 */
    function isPlaceholderName(n) {
        var s = String(n || '').trim();
        if (!s) return true;
        return s === '匿名信号源' || s === '星炬学院访客' || s === '匿名' || s === '访客';
    }

    function pickDisplayName(profile, meta, email, synthetic) {
        if (profile && !isPlaceholderName(profile.nickname)) return String(profile.nickname).trim();
        if (meta && !isPlaceholderName(meta.nickname)) return String(meta.nickname).trim();
        if (meta && !isPlaceholderName(meta.full_name)) return String(meta.full_name).trim();
        if (meta && !isPlaceholderName(meta.name)) return String(meta.name).trim();
        if (email && !synthetic) {
            var local = String(email).split('@')[0];
            if (local && !isPlaceholderName(local)) return local;
        }
        /* 匿名会话才用访客文案；真实邮箱账号至少回落到邮箱前缀，上面已处理 */
        return synthetic ? '星炬学院访客' : (email ? String(email).split('@')[0] : '星炬学院访客');
    }

    /**
     * 两条身份路径的唯一数据出口。
     * 优先级：有效 profiles.nickname > 有效 user_metadata > 邮箱前缀 > 兜底文案
     * （显式跳过「匿名信号源」等占位默认值，避免主站真实登录后论坛仍显示匿名）
     */
    /** Supabase 匿名会话：仅供 RLS 写库，不得当作通行证「已登录」 */
    function isAnonymousAuthUser(user) {
        if (!user) return true;
        if (user.is_anonymous === true) return true;
        if (user.app_metadata && user.app_metadata.provider === 'anonymous') return true;
        /* 无邮箱且非已识别用户 → 匿名；昵称通行证带合成邮箱，不算匿名 */
        if (!user.email) return true;
        return false;
    }

    function applyUser(user, profile) {
        if (isAnonymousAuthUser(user)) {
            /* 退出后 ensureSession 可能静默匿名登录——UI 必须保持未登录 */
            clearMirror();
            current = null;
            emit();
            return null;
        }

        var meta = (user && user.user_metadata) || {};
        var email = (user && user.email) ? user.email : null;
        var synthetic = isSyntheticEmail(email);
        var authMode = meta.auth_mode || (synthetic ? 'nickname' : (email ? 'email' : null));

        var name = pickDisplayName(profile, meta, email, synthetic);
        var color = sanitizeColor((profile && profile.avatar_color) || meta.avatar_color);
        var role = (profile && profile.role) || meta.role || 'user';

        var joined = (profile && profile.created_at) ? Date.parse(profile.created_at)
            : (user && user.created_at) ? Date.parse(user.created_at)
            : (current ? current.joined : Date.now());

        try { localStorage.removeItem('stf_explicit_logout'); } catch (e) { /* ignore */ }

        var v = publicView(user.id, name, color, joined,
            current ? current.posts : 0, email, authMode, role);
        current = v;
        saveMirror(v);
        emit();
        return v;
    }

    function loadSession() {
        var mirror = loadMirror();
        if (mirror && mirror.key) {
            /* 带上 email / authMode / role，避免刷新瞬间管理员按钮闪断 */
            current = publicView(mirror.key, mirror.name, mirror.color, mirror.joined,
                mirror.posts, mirror.email, mirror.authMode, mirror.role);
            /* 镜像若仍是占位名，等待云端 hydrate 纠正 */
            if (isPlaceholderName(current.name) && mirror.email && !isSyntheticEmail(mirror.email)) {
                current.name = String(mirror.email).split('@')[0] || current.name;
            }
        } else {
            current = null;
        }
        /* 异步用云端共享会话刷新（识别主站登录态）。
           supabaseClient 可能尚未就绪（CDN async），先轮询再刷新。 */
        refreshFromCloudDeferred();
    }

    function refreshFromCloudDeferred() {
        var tries = 0;
        (function tick() {
            if (window.supabaseClient) { refreshFromCloud(); return; }
            if (tries++ > 60) return; /* ~3s 超时则保持本地镜像 */
            setTimeout(tick, 50);
        })();
    }

    function refreshFromCloud() {
        var client = window.supabaseClient;
        if (!client) return;
        if (!client.auth || !client.auth.getSession) return;
        client.auth.getSession().then(function (res) {
            if (res && res.data && res.data.session && res.data.session.user) {
                if (isAnonymousAuthUser(res.data.session.user)) {
                    clearMirror();
                    current = null;
                    emit();
                } else {
                    hydrate(client, res.data.session.user);
                }
            } else {
                /* 云端无真实会话：清镜像，避免伪登录态 */
                if (current) {
                    clearMirror();
                    current = null;
                    emit();
                }
            }
        }).catch(function () { /* 无会话则保持本地镜像 */ });

        /* 监听主站 / 本页登录态变化，实时刷新顶栏与聊天署名 */
        if (client.auth.onAuthStateChange && !refreshFromCloud._bound) {
            refreshFromCloud._bound = true;
            client.auth.onAuthStateChange(function (event, session) {
                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
                    if (session && session.user) {
                        if (isAnonymousAuthUser(session.user)) {
                            clearMirror();
                            current = null;
                            emit();
                        } else {
                            hydrate(client, session.user);
                        }
                    }
                } else if (event === 'SIGNED_OUT') {
                    clearMirror();
                    current = null;
                    emit();
                }
            });
        }
    }

    /* ---------- 核心：注册 / 登录 / 登出（双轨身份，共用解析层） ---------- */

    /* 登录成功后统一拉取 profiles 补全资料，失败则回落 user_metadata */
    function hydrate(client, user) {
        return client.from('profiles')
            .select('nickname, avatar_color, created_at, role')
            .eq('id', user.id).single()
            .then(function (p) { return applyUser(user, (p && p.data) ? p.data : null); })
            .catch(function () { return applyUser(user, null); });
    }

    /**
     * 注册 —— 同时支持昵称注册与真实邮箱注册。
     * @param {object} payload { mode:'email'|'nickname', email?, nickname, password }
     *        亦兼容旧式 register(email, nickname, password)
     */
    function register() {
        var opts = normalizePayload(arguments, 'register');
        var id;
        try { id = resolveIdentity(opts, true); }
        catch (e) { return Promise.reject(e); }

        var pwd = String(opts.password || '');
        if (pwd.length < 6) return Promise.reject(new Error('口令至少 6 位'));

        var client = window.supabaseClient;
        if (!client) return Promise.reject(new Error('云端未连接，暂无法注册（可先用匿名身份发帖）'));

        var color = randomColor();
        return client.auth.signUp({
            email: id.email,
            password: pwd,
            options: {
                data: {
                    nickname: id.nickname,
                    avatar_color: color,
                    auth_mode: id.authMode,
                    /* 归一化昵称留档：便于后台辨认昵称账号、也便于将来做昵称改名迁移 */
                    nick_key: id.authMode === 'nickname' ? normalizeNick(id.nickname) : null
                }
            }
        }).then(function (res) {
            if (res.error) throw new Error(friendlyError(res.error.message, id.authMode, 'register'));
            if (res.data && res.data.user && res.data.session) {
                return applyUser(res.data.user, {
                    nickname: id.nickname, avatar_color: color, created_at: new Date().toISOString()
                });
            }
            /* 无 session 有两种可能：邮箱确认开着，或该邮箱已存在（Supabase 会做模糊化处理） */
            if (id.authMode === 'nickname') {
                throw new Error('这个昵称可能已被占用，换一个，或直接用它登录');
            }
            throw new Error('注册已提交但未自动登录：若开启了「邮箱确认」请先去邮箱确认，或该邮箱已注册、请直接登录');
        });
    }

    /**
     * 登录 —— 同时支持真实邮箱登录与昵称（匿名口令）登录。
     * @param {object} payload { mode:'email'|'nickname', email?, nickname?, password }
     *        亦兼容旧式 login(email, password)
     */
    function login() {
        var opts = normalizePayload(arguments, 'login');
        var id;
        try { id = resolveIdentity(opts, false); }
        catch (e) { return Promise.reject(e); }

        var client = window.supabaseClient;
        if (!client) return Promise.reject(new Error('云端未连接，无法登录'));

        return client.auth.signInWithPassword({ email: id.email, password: String(opts.password || '') })
            .then(function (res) {
                if (res.error) throw new Error(friendlyError(res.error.message, id.authMode, 'login'));
                if (res.data && res.data.user) return hydrate(client, res.data.user);
                throw new Error(id.authMode === 'nickname' ? '昵称或口令不正确' : '邮箱或口令不正确');
            });
    }

    function logout() {
        try { localStorage.setItem('stf_explicit_logout', '1'); } catch (e) { /* ignore */ }
        clearMirror();
        current = null;
        emit();
        var client = window.supabaseClient;
        if (!client || !client.auth || !client.auth.signOut) {
            return Promise.resolve();
        }
        /* global：清掉与主站共享的持久会话，避免「退出后又自动回来」 */
        return client.auth.signOut({ scope: 'global' }).catch(function () {
            return client.auth.signOut({ scope: 'local' });
        }).catch(function () { /* ignore */ });
    }

    /**
     * 更新显示名（nickname）并写回 profiles + user_metadata。
     * nickname = 发帖/顶栏/聊天署名，不是登录邮箱。
     */
    function updateNickname(raw) {
        /* 按 Unicode 字素近似计数，避免把中文算错；去首尾空白并折叠中间空格 */
        var nick = String(raw || '').trim().replace(/\s+/g, ' ');
        var len = Array.from(nick).length;
        if (len < 2 || len > 20) {
            return Promise.reject(new Error('显示名需 2–20 个字'));
        }
        if (isPlaceholderName(nick)) {
            return Promise.reject(new Error('请换一个更有辨识度的显示名'));
        }
        if (!current || !current.key) {
            return Promise.reject(new Error('请先登录通行证'));
        }
        var client = window.supabaseClient;
        var color = current.color || '#6B8AFF';

        function applyLocal() {
            current.name = nick;
            saveMirror(current);
            emit();
            return current;
        }

        if (!client) {
            applyLocal();
            return Promise.resolve(current);
        }

        /* 只用 UPDATE：profiles 通常无用户 INSERT 策略，upsert 会走 INSERT 触发 RLS「new row violates…」 */
        return client.from('profiles').update({
            nickname: nick,
            avatar_color: color
        }).eq('id', current.key).select('id, nickname').then(function (res) {
            if (res.error) throw new Error(res.error.message || '保存失败');
            var rows = res.data || [];
            if (!rows.length) {
                /* 行缺失时再 upsert（需 migration-027 的 INSERT 策略）；仍失败则至少写 metadata */
                return client.from('profiles').upsert({
                    id: current.key,
                    nickname: nick,
                    avatar_color: color
                }, { onConflict: 'id' }).then(function (up) {
                    if (up.error) {
                        console.warn('[StarTorchAuth] profiles 写入失败，回落 user_metadata:', up.error.message);
                    }
                    if (client.auth && client.auth.updateUser) {
                        return client.auth.updateUser({ data: { nickname: nick } }).then(applyLocal).catch(applyLocal);
                    }
                    return applyLocal();
                });
            }
            if (client.auth && client.auth.updateUser) {
                return client.auth.updateUser({ data: { nickname: nick } }).then(function () {
                    return applyLocal();
                }).catch(function () { return applyLocal(); });
            }
            return applyLocal();
        });
    }

    function bumpPostCount() {
        if (!current) return;
        current.posts = (current.posts || 0) + 1;
        saveMirror(current);
        emit();
    }

    function getUser() { return current; }
    function onChange(fn) { if (typeof fn === 'function') listeners.push(fn); }

    /**
     * 管理员 / 版主判定（仅用于 UI 显隐；写操作由 Supabase RLS 裁定）。
     * - forum_admins 邮箱命中 → admin
     * - profiles.role 为 moderator / admin → 同等管理 UI
     * 昵称身份走合成邮箱，结构上不可能出现在 forum_admins。
     */
    function isForumStaff() {
        if (!current) return false;
        var role = String(current.role || '').toLowerCase();
        if (role === 'admin' || role === 'moderator') return true;
        if (!current.email || isSyntheticEmail(current.email)) return false;
        return FORUM_ADMIN_EMAILS.indexOf(String(current.email).toLowerCase()) !== -1;
    }
    function isForumAdmin() { return isForumStaff(); }

    /* ---------- UI（以下逻辑保持不变） ---------- */
    function $(id) { return document.getElementById(id); }

    function initials(name) {
        var n = String(name || '').trim();
        if (!n) return '?';
        return /[\u4e00-\u9fa5]/.test(n.charAt(0)) ? n.charAt(0) : n.charAt(0).toUpperCase();
    }

    function formatDate(ts) {
        var d = new Date(ts || Date.now());
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function renderEntry() {
        var avatar = $('stf-account-avatar');
        var label = $('stf-account-name');
        var btn = $('stf-account-btn');
        if (!avatar || !label || !btn) return;

        if (current) {
            avatar.textContent = initials(current.name);
            avatar.style.background = current.color;
            avatar.classList.add('is-signed');
            label.textContent = current.name;
            btn.classList.add('is-signed');
            btn.setAttribute('aria-label', '账号：' + current.name);
        } else {
            avatar.textContent = '＋';
            avatar.style.background = '';
            avatar.classList.remove('is-signed');
            label.textContent = '登录';
            btn.classList.remove('is-signed');
            btn.setAttribute('aria-label', '登录或注册星炬学院通行证');
        }
    }

    function renderPanel() {
        var guest = $('stf-account-guest');
        var user = $('stf-account-user');
        if (!guest || !user) return;

        if (current) {
            guest.hidden = true;
            user.hidden = false;
            var av = $('stf-account-card-avatar');
            if (av) { av.textContent = initials(current.name); av.style.background = current.color; }
            var nm = $('stf-account-card-name');
            if (nm) nm.textContent = current.name;
            var meta = $('stf-account-card-meta');
            if (meta) {
                var kind = current.authMode === 'nickname' ? '昵称通行证'
                    : (current.displayEmail ? '邮箱通行证' : '通行证');
                meta.textContent = kind + ' · 加入于 ' + formatDate(current.joined)
                    + ' · 已发布 ' + (current.posts || 0) + ' 篇';
            }
            var nickInput = $('stf-nick-input');
            if (nickInput && !isPlaceholderName(current.name)) nickInput.value = current.name;
            else if (nickInput) nickInput.value = '';
            setError('stf-nick-error', '');
        } else {
            guest.hidden = false;
            user.hidden = true;
        }
    }

    function setError(id, msg) {
        var el = $(id);
        if (!el) return;
        el.textContent = msg || '';
        el.hidden = !msg;
    }

    function openPanel() {
        var modal = $('stf-account-modal');
        if (!modal) return;
        renderPanel();
        modal.hidden = false;
        requestAnimationFrame(function () { modal.classList.add('open'); });
        var btn = $('stf-account-btn');
        if (btn) btn.setAttribute('aria-expanded', 'true');
        var focusTarget = current ? $('stf-logout-btn') : $(firstFieldId('login'));
        if (focusTarget) setTimeout(function () { focusTarget.focus(); }, 120);
    }

    function closePanel() {
        var modal = $('stf-account-modal');
        if (!modal) return;
        modal.classList.remove('open');
        setTimeout(function () { modal.hidden = true; }, 280);
        var btn = $('stf-account-btn');
        if (btn) btn.setAttribute('aria-expanded', 'false');
        setError('stf-login-error', '');
        setError('stf-register-error', '');
    }

    /* ---------- 身份方式切换（登录 / 注册各自独立） ---------- */
    var authModes = { login: 'email', register: 'email' };

    var MODE_HINTS = {
        login: {
            email: '用注册时填写的真实邮箱登录，与飞行雪绒频道共用同一账号。',
            nickname: '只需昵称 + 口令，不涉及邮箱；换设备也能登录同一个通行证。'
        },
        register: {
            email: '邮箱账号可找回口令，并与飞行雪绒频道共用同一套身份。',
            nickname: '不填邮箱，昵称即登录名；换设备可用同一昵称 + 口令登录，但口令遗失无法找回。'
        }
    };

    function setAuthMode(scope, mode) {
        mode = normalizeMode(mode);
        authModes[scope] = mode;

        document.querySelectorAll('[data-mode-scope="' + scope + '"]').forEach(function (b) {
            var on = b.getAttribute('data-mode') === mode;
            b.classList.toggle('active', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });

        /* 隐藏字段必须 disabled，否则浏览器会对不可见的 required 输入报验证错、卡住提交 */
        document.querySelectorAll('[data-mode-field^="' + scope + '-"]').forEach(function (box) {
            var on = box.getAttribute('data-mode-field') === scope + '-' + mode;
            box.hidden = !on;
            box.querySelectorAll('input, select, textarea').forEach(function (f) {
                f.disabled = !on;
                if (on) { f.required = true; } else { f.required = false; f.value = ''; }
            });
        });

        var hint = $(scope === 'login' ? 'stf-login-mode-hint' : 'stf-register-mode-hint');
        if (hint) hint.textContent = (MODE_HINTS[scope] || {})[mode] || '';
        setError(scope === 'login' ? 'stf-login-error' : 'stf-register-error', '');
    }

    /* 当前模式下应聚焦的第一个输入框 */
    function firstFieldId(scope) {
        if (scope === 'login') return authModes.login === 'nickname' ? 'stf-login-nick' : 'stf-login-email';
        return authModes.register === 'nickname' ? 'stf-register-nick' : 'stf-register-email';
    }

    function readValue(id) {
        var el = $(id);
        return el ? el.value : '';
    }

    function switchTab(tab) {
        document.querySelectorAll('.stf-auth-tab').forEach(function (b) {
            var on = b.getAttribute('data-auth-tab') === tab;
            b.classList.toggle('active', on);
            b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        document.querySelectorAll('.stf-auth-module').forEach(function (m) {
            var on = m.getAttribute('data-auth-module') === tab;
            m.classList.toggle('is-active', on);
        });
        var loginForm = $('stf-login-form');
        var regForm = $('stf-register-form');
        if (loginForm) loginForm.hidden = tab !== 'login';
        if (regForm) regForm.hidden = tab !== 'register';
        setError('stf-login-error', '');
        setError('stf-register-error', '');
    }

    function toast(msg) {
        if (window.StarTorchForum && window.StarTorchForum.toast) window.StarTorchForum.toast(msg);
    }

    function bindUI() {
        var btn = $('stf-account-btn');
        if (btn) btn.addEventListener('click', openPanel);

        var modal = $('stf-account-modal');
        if (modal) {
            modal.querySelectorAll('[data-account-close]').forEach(function (el) {
                el.addEventListener('click', closePanel);
            });
            document.addEventListener('keydown', function (e) {
                if (root_close_on_escape(e, modal)) closePanel();
            });
        }

        document.querySelectorAll('.stf-auth-tab').forEach(function (b) {
            b.addEventListener('click', function () { switchTab(b.getAttribute('data-auth-tab')); });
        });

        document.querySelectorAll('[data-mode-scope]').forEach(function (b) {
            b.addEventListener('click', function () {
                var scope = b.getAttribute('data-mode-scope');
                setAuthMode(scope, b.getAttribute('data-mode'));
                var f = $(firstFieldId(scope));
                if (f) f.focus();
            });
        });

        var loginForm = $('stf-login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', function (e) {
                e.preventDefault();
                setError('stf-login-error', '');
                var mode = authModes.login;
                login({
                    mode: mode,
                    email: mode === 'email' ? readValue('stf-login-email') : '',
                    nickname: mode === 'nickname' ? readValue('stf-login-nick') : '',
                    password: readValue('stf-login-pwd')
                })
                    .then(function (u) {
                        loginForm.reset();
                        setAuthMode('login', mode); /* reset() 会清 hidden 状态外的值，重置字段可见性 */
                        closePanel();
                        toast('欢迎回来，' + u.name + ' ✦');
                    })
                    .catch(function (err) { setError('stf-login-error', err.message || '登录失败'); });
            });
        }

        var regForm = $('stf-register-form');
        if (regForm) {
            regForm.addEventListener('submit', function (e) {
                e.preventDefault();
                setError('stf-register-error', '');
                var pwd = readValue('stf-register-pwd');
                if (pwd !== readValue('stf-register-pwd2')) {
                    setError('stf-register-error', '两次输入的口令不一致');
                    return;
                }
                var mode = authModes.register;
                register({
                    mode: mode,
                    email: mode === 'email' ? readValue('stf-register-email') : '',
                    /* 昵称模式下昵称即显示名，两种模式统一交给 nickname 字段 */
                    nickname: mode === 'nickname' ? readValue('stf-register-nick') : readValue('stf-register-name'),
                    password: pwd
                })
                    .then(function (u) {
                        regForm.reset();
                        setAuthMode('register', mode);
                        closePanel();
                        toast('通行证已签发，欢迎加入星炬学院，' + u.name + ' ✦');
                    })
                    .catch(function (err) { setError('stf-register-error', err.message || '注册失败'); });
            });
        }

        var logoutBtn = $('stf-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function () {
                Promise.resolve(logout()).then(function () {
                    closePanel();
                    toast('已退出登录。发帖仍可用访客会话，通行证需重新登录');
                });
            });
        }

        var nickForm = $('stf-nick-form');
        if (nickForm) {
            nickForm.addEventListener('submit', function (e) {
                e.preventDefault();
                setError('stf-nick-error', '');
                updateNickname(readValue('stf-nick-input'))
                    .then(function (u) {
                        toast('显示名已更新为「' + u.name + '」');
                        renderPanel();
                    })
                    .catch(function (err) {
                        setError('stf-nick-error', err.message || '保存失败');
                    });
            });
        }

        onChange(function () { renderEntry(); renderPanel(); });
    }

    function root_close_on_escape(e, modal) {
        return e.key === 'Escape' && !modal.hidden;
    }

    function init() {
        loadSession();
        bindUI();
        /* 同步 DOM 的 hidden/disabled 与默认模式，避免隐藏必填项阻塞提交 */
        setAuthMode('login', authModes.login);
        setAuthMode('register', authModes.register);
        renderEntry();
        emit();
    }

    if (document.readyState !== 'loading') init();
    else document.addEventListener('DOMContentLoaded', init);

    return {
        getUser: getUser,
        register: register,
        login: login,
        logout: logout,
        onChange: onChange,
        isForumAdmin: isForumAdmin,
        isForumStaff: isForumStaff,
        bumpPostCount: bumpPostCount,
        openPanel: openPanel,
        updateNickname: updateNickname,
        isPlaceholderName: isPlaceholderName,
        /* 身份层工具（供调试 / 未来复用；昵称→邮箱为纯函数，可离线推算） */
        nickToEmail: nickToEmail,
        isSyntheticEmail: isSyntheticEmail,
        getAuthMode: function () { return current ? current.authMode : null; }
    };
})();
