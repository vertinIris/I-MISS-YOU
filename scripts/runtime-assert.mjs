#!/usr/bin/env node
/**
 * 运行时断言（零依赖）—— 用无头 Chrome 真实执行页面 JS 后校验 DOM。
 *
 * 目的：补上 smoke-check 的短板。smoke-check 只校验「文件存在 + 字符串包含」，
 * 无法发现「JS 跑起来之后才是坏的」这类缺陷（例：投稿卡被 DOMPurify 剥掉、
 * 后台入口不可达）。本脚本内置静态服务器 + 调用本机 Chrome 渲染后断言 DOM。
 *
 * 用法: node scripts/runtime-assert.mjs [--report] [--base=http://127.0.0.1:PORT]
 *   --report  只打印计数不判定失败（用于校准阈值）
 *   --base    复用外部已启动的服务器，不自行启动
 *
 * CI 依赖：runner 预装 Chrome；也可设 CHROME_PATH 指定。
 */
import { spawn, spawnSync } from 'child_process';
import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname, normalize } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const REPORT_ONLY = args.includes('--report');
const externalBase = (args.find(a => a.startsWith('--base=')) || '').split('=')[1];

const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
    '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp3': 'audio/mpeg',
    '.map': 'application/json; charset=utf-8',
};

function startServer(port) {
    return new Promise((resolve, reject) => {
        const srv = createServer(async (req, res) => {
            try {
                let p = decodeURIComponent(req.url.split('?')[0]);
                if (p.endsWith('/')) p += 'index.html';
                const abs = join(root, normalize(p).replace(/^(\.\.[/\\])+/, ''));
                if (!abs.startsWith(root)) { res.writeHead(403).end(); return; }
                const st = await stat(abs);
                if (st.isDirectory()) { res.writeHead(404).end(); return; }
                const body = await readFile(abs);
                res.writeHead(200, { 'Content-Type': MIME[extname(abs).toLowerCase()] || 'application/octet-stream' });
                res.end(body);
            } catch {
                res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404');
            }
        });
        srv.once('error', reject);
        srv.listen(port, '127.0.0.1', () => resolve(srv));
    });
}

function findChrome() {
    if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
    const candidates = process.platform === 'win32'
        ? ['C:/Program Files/Google/Chrome/Application/chrome.exe',
           'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
           'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
           'C:/Program Files/Microsoft/Edge/Application/msedge.exe']
        : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
           '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'];
    for (const c of candidates) {
        if (existsSync(c)) return c;
    }
    const via = spawnSync(process.platform === 'win32' ? 'where' : 'which',
        [process.platform === 'win32' ? 'chrome' : 'google-chrome'], { encoding: 'utf8' });
    const first = (via.stdout || '').split(/\r?\n/).find(Boolean);
    return first || null;
}

function dumpDom(chrome, url) {
    return new Promise((resolve, reject) => {
        const p = spawn(chrome, [
            '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
            '--virtual-time-budget=12000', '--run-all-compositor-stages-before-draw',
            '--dump-dom', url,
        ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
        let out = '', err = '';
        p.stdout.on('data', d => { out += d.toString(); });
        p.stderr.on('data', d => { err += d.toString(); });
        p.on('error', reject);
        p.on('close', code => (code === 0 || out ? resolve(out) : reject(new Error(`chrome exit ${code}: ${err.slice(0, 200)}`))));
        setTimeout(() => { try { p.kill(); } catch { /* ignore */ } }, 90000);
    });
}

const count = (dom, re) => (dom.match(re) || []).length;

// 断言定义：min 为 DOM 中出现次数下限
const CHECKS = [
    {
        path: '/',
        name: '主站首页',
        asserts: [
            { key: 'community-card', re: /class="[^"]*\bcommunity-card"/g, min: 3, desc: '社区投稿卡已渲染（P0 回归）' },
            { key: 'comment-author', re: /class="[^"]*comment-author/g, min: 1, desc: '评论列表已渲染' },
            { key: 'timeline-post', re: /class="post-card/g, min: 3, desc: '时间线内容已渲染' },
            { key: 'version', re: /v11\.\d+\.\d+/g, min: 1, desc: '页脚版本号存在' },
            { key: 'music-track', re: /class="[^"]*track/g, min: 1, desc: '曲目列表已渲染' },
        ],
        forbids: [
            { key: 'orphan-tape', re: /class="sig-tape-corner"/g, maxRatioTo: 'community-card', desc: '无孤立装饰节点（投稿卡未渲染的征兆）' },
        ],
    },
    {
        path: '/forum/',
        name: '论坛页',
        asserts: [
            { key: 'stf-community', re: /id="stf-community"/g, min: 1, desc: '社区区块存在' },
            { key: 'bundle', re: /bundle-forum\.js/g, min: 1, desc: '论坛 bundle 已引用' },
        ],
        forbids: [],
    },
];

async function main() {
    const chrome = findChrome();
    if (!chrome) {
        console.log('❌ 未找到 Chrome，设 CHROME_PATH 指定路径后重试');
        process.exit(1);
    }
    let srv = null, base = externalBase;
    if (!base) {
        const port = 8123;
        srv = await startServer(port);
        base = `http://127.0.0.1:${port}`;
    }
    let failed = 0;
    try {
        for (const c of CHECKS) {
            console.log(`\n=== ${c.name} (${c.path}) ===`);
            let dom;
            try {
                dom = await dumpDom(chrome, base + c.path);
            } catch (e) {
                console.log('FAIL 渲染失败:', e.message);
                failed++;
                continue;
            }
            if (!dom || dom.length < 500) {
                console.log('FAIL DOM 为空（页面未正常渲染）');
                failed++;
                continue;
            }
            const counts = {};
            for (const a of c.asserts) {
                const n = count(dom, a.re);
                counts[a.key] = n;
                if (REPORT_ONLY) { console.log(`   · ${a.key}=${n} (min ${a.min}) ${a.desc}`); continue; }
                if (n >= a.min) console.log(`OK   ${a.desc} (${n})`);
                else { console.log(`FAIL ${a.desc} — 期望 ≥${a.min}，实际 ${n}`); failed++; }
            }
            for (const f of c.forbids || []) {
                const n = count(dom, f.re);
                const baseN = counts[f.maxRatioTo] ?? 0;
                if (REPORT_ONLY) { console.log(`   · forbid ${f.key}=${n} vs ${f.maxRatioTo}=${baseN}`); continue; }
                if (baseN === 0 && n > 0) { console.log(`FAIL ${f.desc} — ${f.key}=${n} 而 ${f.maxRatioTo}=0`); failed++; }
                else console.log(`OK   ${f.desc}`);
            }
        }
    } finally {
        if (srv) srv.close();
    }
    console.log(REPORT_ONLY ? '\n（report 模式，未判定失败）' : (failed ? `\n❌ 运行时断言 ${failed} 项失败` : '\n✅ 运行时断言全部通过'));
    process.exit(REPORT_ONLY ? 0 : (failed ? 1 : 0));
}

main().catch(e => { console.error('运行时断言异常:', e.message); process.exit(1); });
