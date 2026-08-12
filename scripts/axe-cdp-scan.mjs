import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9222;
const URLs = [
  'http://127.0.0.1:8848/',
  'http://127.0.0.1:8848/forum/'
];

async function cdpList() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  return res.json();
}

async function cdpSend(ws, id, method, params = {}) {
  return new Promise((resolve, reject) => {
    const listener = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) {
        ws.off('message', listener);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };
    ws.on('message', listener);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function scanURL(url) {
  console.log(`\n=== Scanning ${url} ===`);
  let page;
  let attempts = 0;
  while (!page && attempts < 10) {
    const list = await cdpList();
    page = list.find(p => p.url === 'about:blank' || p.type === 'page');
    if (!page) await setTimeout(300);
    attempts++;
  }
  if (!page) throw new Error('No CDP page found');

  const { WebSocket } = await import('ws');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });

  let id = 1;
  const send = (method, params) => cdpSend(ws, id++, method, params);

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url });
  await setTimeout(3000);

  const axeSource = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
  await send('Runtime.evaluate', { expression: axeSource, awaitPromise: false });

  const runAxe = `
    new Promise((resolve, reject) => {
      window.axe.run(document, {
        tags: ['wcag2a', 'wcag2aa', 'wcag21aa']
      }).then(results => resolve(results)).catch(err => reject(err.message));
    })
  `;
  const result = await send('Runtime.evaluate', {
    expression: runAxe,
    awaitPromise: true,
    returnByValue: true
  });

  const outcomes = result.result.value;
  console.log(`Violations: ${outcomes.violations.length}`);
  for (const v of outcomes.violations) {
    console.log(`\n[${v.impact}] ${v.id}: ${v.help}`);
    for (const node of v.nodes) {
      console.log(`  target: ${JSON.stringify(node.target)}`);
      console.log(`  ${node.failureSummary?.replace(/\n/g, '\n  ') || node.html}`);
    }
  }
  ws.close();
  return outcomes;
}

async function main() {
  const chrome = spawn(CHROME, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--user-data-dir=C:/tmp/axe-chrome-profile'
  ], { stdio: 'ignore' });

  await setTimeout(2000);
  try {
    for (const url of URLs) await scanURL(url);
  } finally {
    chrome.kill();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
