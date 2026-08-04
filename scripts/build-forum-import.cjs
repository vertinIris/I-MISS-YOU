#!/usr/bin/env node
/**
 * build-forum-import.js
 * --------------------------------------------------
 * 把「论坛内容/二创内容库/*.md」解析为论坛种子数据，
 * 输出 forum/js/forum-import-data.js（window.StarTorchImportSeed）。
 *
 * 这是《论坛功能缺失汇报》P0 的落地：md → forum 数据管线。
 * 生成的是「本地种子」，渲染时由 forum-data.js 合并进社区列表，
 * 不强制写入云端（用户可在 Supabase Dashboard 跑 migration 后再批量上云）。
 *
 * 容错策略：
 *   - 脏数据（回复列表里混进的 meta 行 / 正文前的 blockquote 元信息）一律跳过
 *   - 正文只取「### 正文」与「### 回复列表」之间的真实内容
 *   - 字段缺失时用安全默认值兜底
 *
 * 「论坛内容/」为离线源稿（不部署、默认不入 git）；其中「技术参考/」是旧快照，勿覆盖现网 js/forum。
 *
 * 用法：node scripts/build-forum-import.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '..', '论坛内容', '二创内容库');
const OUT_FILE = path.resolve(__dirname, '..', 'forum', 'js', 'forum-import-data.js');

// 文件名 -> 角色/分类标签 + 主题色
const CATEGORY = {
    '女漂泊者-A线': { tag: '女漂泊者', color: '#A8D8FF' },
    '女漂泊者-B线': { tag: '女漂泊者', color: '#A8D8FF' },
    '拉海洛与巴德尔': { tag: '拉海洛', color: '#7FD99E' },
    '爱弥斯-A线': { tag: '爱弥斯', color: '#FF6B9D' },
    '爱弥斯-B线': { tag: '爱弥斯', color: '#FF6B9D' },
    '罗伊人文化': { tag: '罗伊人', color: '#E8C56A' },
    '西格莉卡': { tag: '西格莉卡', color: '#7FD99E' },
    '跨角色与论坛运营': { tag: '跨角色', color: '#B66BFF' },
    '辛吉勒姆': { tag: '辛吉勒姆', color: '#FF6B5B' },
    '配角群像': { tag: '配角', color: '#B98CFF' }
};

const TYPE_MAP = {
    '短篇故事': 'story', '场景描写': 'story', '对话补全': 'story',
    '人物对话补全': 'story', '关系扩展': 'story',
    '短视频脚本': 'video', '短视频分镜': 'video', '短视频口播': 'video',
    '图文配文': 'art', '图文混排草案': 'art', '配图文字说明': 'art',
    '同人创作·绘画': 'art',
    '设定考据': 'lore', '考据分析': 'lore', '人设补完': 'lore',
    '角色小传': 'lore', '二创活动': 'lore', '角色小传/设定补完': 'lore',
    '二创脑洞': 'text', '论坛贴文模板': 'text', '论坛帖子': 'text',
    '日常闲聊': 'text', '闲聊脑洞': 'text', '论坛贴文模板/日常闲聊': 'text',
    '活动专区内容': 'text', '活动专区': 'text', '问答求助': 'text'
};

function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0);
}

const HEADING_RE = /^##\s+([A-Za-z]+-\d+)\s+(.+?)\s*$/;
const CELL_RE = /^\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*$/;

function parseFile(filePath, category) {
    const text = fs.readFileSync(filePath, 'utf8');
    const lines = text.split(/\r?\n/);
    const entries = [];
    let cur = null;
    let state = 'idle';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const heading = line.match(HEADING_RE);
        if (heading) {
            if (cur && cur.content && cur.content.trim()) entries.push(cur);
            cur = {
                id: heading[1],
                title: heading[2].trim(),
                meta: {},
                content: ''
            };
            state = 'meta';
            continue;
        }
        if (/^###\s+/.test(line)) {
            if (/正文/.test(line)) state = 'body';
            else if (/回复/.test(line)) state = 'replies';
            else state = 'idle';
            continue;
        }
        if (!cur) continue;
        if (state === 'meta') {
            const m = line.match(CELL_RE);
            if (m) {
                const key = m[1].trim();
                const val = m[2].trim();
                if (key && key !== '字段') cur.meta[key] = val;
            }
        } else if (state === 'body') {
            // 跳过正文前/中的 blockquote 元信息行
            if (/^\s*>/.test(line)) continue;
            if (line.trim() === '') {
                // 连续空行不无限累加，但保留段落；用换行连接
                if (cur.content && !cur.content.endsWith('\n')) cur.content += '\n';
                continue;
            }
            cur.content += line + '\n';
        }
        // replies 状态：忽略（脏数据，论坛评论另行产生）
    }
    if (cur && cur.content && cur.content.trim()) entries.push(cur);

    return entries.map(function (e) {
        const meta = e.meta || {};
        const typeRaw = (meta['类型'] || '').trim();
        const type = TYPE_MAP[typeRaw] || 'text';
        const name = (meta['作者'] || '').trim() || '匿名信号源';
        const role = (meta['角色'] || '').trim();
        const section = (meta['适用板块'] || '').trim();
        const timeStr = (meta['发布时间'] || '').trim() || '2026-08-03';
        const rawTags = [category.tag];
        if (role) rawTags.push(role);
        if (section) rawTags.push(section);
        // 去重（分类标签常与角色/板块字段撞名）
        const seen = {};
        const tags = rawTags.filter(function (t) { if (seen[t]) return false; seen[t] = true; return true; });
        return {
            id: 'imp_' + e.id,
            name: name,
            type: type,
            title: e.title,
            realm: 'startorch',
            tags: tags,
            content: e.content.trim(),
            timeStr: timeStr,
            likes: hashStr(e.id) % 61,
            liked: false,
            color: category.color
        };
    });
}

function main() {
    if (!fs.existsSync(SRC_DIR)) {
        console.error('[build-forum-import] 源目录不存在: ' + SRC_DIR);
        process.exit(1);
    }
    const files = fs.readdirSync(SRC_DIR).filter(function (f) {
        return /\.md$/i.test(f) && CATEGORY[f.replace(/\.md$/i, '')];
    });
    let all = [];
    files.forEach(function (f) {
        const cat = CATEGORY[f.replace(/\.md$/i, '')];
        const parsed = parseFile(path.join(SRC_DIR, f), cat);
        console.log('  · ' + f + ' → ' + parsed.length + ' 条');
        all = all.concat(parsed);
    });

    const out = '// AUTO-GENERATED by scripts/build-forum-import.js — 请勿手改\n'
        + '// 数据来源：论坛内容/二创内容库/*.md（二创内容资产，未纳入 git）\n'
        + '// 字段对齐 forum/js/forum-data.js 的 SEED_SUBMISSIONS\n'
        + 'window.StarTorchImportSeed = ' + JSON.stringify(all, null, 0) + ';\n';

    fs.writeFileSync(OUT_FILE, out, 'utf8');
    console.log('\n✅ 共生成 ' + all.length + ' 条二创种子 → ' + path.relative(process.cwd(), OUT_FILE));
}

main();
