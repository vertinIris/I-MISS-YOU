/**
 * Build css/forum-shared.css + css/archive-subset.css from style.css line ranges.
 */
import fs from 'fs';

const lines = fs.readFileSync('css/style.css', 'utf8').split(/\n/);
const take = (a, b) => lines.slice(a - 1, b).join('\n');

const BANNER = `/* AUTO-EXTRACTED subset from css/style.css — do not hand-edit large blocks;
 * re-run: node scripts/extract-css-subsets.mjs
 * .reveal must remain for initScrollReveal / worldview visibility.
 */
`;

const RESET = `*,
*::before,
*::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
body {
  font-family: var(--font-sans, "Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif);
  color: var(--text-primary, #faf8ff);
  background: var(--bg-primary, #0a0a12);
  line-height: 1.6;
  overflow-x: hidden;
  min-height: 100vh;
}
img, svg { display: block; max-width: 100%; }
a { color: inherit; text-decoration: none; }
button, input, textarea, select { font: inherit; color: inherit; }
ul, ol { list-style: none; }
.icon-sprite { position: absolute; width: 0; height: 0; overflow: hidden; }
.icon { width: 1.1em; height: 1.1em; display: inline-block; vertical-align: -0.15em; flex-shrink: 0; }
`;

const forum = [
  BANNER,
  '/* ---- reset ---- */',
  RESET,
  '/* ---- glass ---- */',
  take(710, 747),
  '/* ---- nav ---- */',
  take(878, 1314),
  '/* ---- buttons ---- */',
  take(1389, 1884),
  '/* ---- section headers ---- */',
  take(1885, 1937),
  '/* ---- reveal (KEEP) ---- */',
  take(3373, 3384),
  '/* ---- responsive nav bits ---- */',
  take(3385, 3527),
  '/* ---- reduced motion (keep reveal visible) ---- */',
  take(3581, 3612),
  '/* ---- forms ---- */',
  take(3861, 3956),
  '/* ---- tags ---- */',
  take(4528, 4581),
  '/* ---- submission tag selector ---- */',
  take(4756, 4813),
  '/* ---- character archive cards (forum hub) ---- */',
  take(5700, 6146),
  '/* ---- zone/archive shared used by forum lore cards if any ---- */',
  take(6028, 6146),
].join('\n\n');

const archive = [
  BANNER,
  '/* ---- reset ---- */',
  RESET,
  '/* ---- reveal (KEEP for consistency) ---- */',
  take(3373, 3384),
  take(3581, 3612),
  '/* ---- character archive + zone layout ---- */',
  take(5700, 6529),
].join('\n\n');

fs.writeFileSync('css/forum-shared.css', forum);
fs.writeFileSync('css/archive-subset.css', archive);
console.log('forum-shared', (forum.length / 1024).toFixed(1) + 'KB');
console.log('archive-subset', (archive.length / 1024).toFixed(1) + 'KB');
console.log('vs style.css', (fs.readFileSync('css/style.css').length / 1024).toFixed(1) + 'KB');
