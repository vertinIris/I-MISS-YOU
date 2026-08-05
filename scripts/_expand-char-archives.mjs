/**
 * One-shot: expand character archive modules with source-tiered lore.
 * Run: node scripts/_expand-char-archives.mjs
 *
 * WARN 保护校标 HTML（2026-08-06 起强制）：
 * - 本脚本为一次性批量生成器；characters 下各角色 index.html 已由人工 / 回归官方校标。
 * - 默认禁止覆写：除非设置环境变量 FORCE_EXPAND_CHAR_ARCHIVES=1。
 * - 需要改文案时，请直接编辑对应角色 HTML，勿再靠本脚本整页覆盖。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

if (process.env.FORCE_EXPAND_CHAR_ARCHIVES !== '1') {
  console.error(
    '[protect] Refusing to overwrite calibrated characters/*/index.html.\n' +
      'Set FORCE_EXPAND_CHAR_ARCHIVES=1 only if you intentionally regenerate from this script.'
  );
  process.exit(1);
}
const t = (kind, label) =>
  `<span class="source-tier source-tier--${kind}">【${label}】</span>`;
const OFF = t('official', '官方');
const CON = t('consensus', '同人共识');
const ORI = t('original', '本站原创');

function wrapMain(inner) {
  return `<main class="zone-modules">\n\n${inner}\n\n    </main>`;
}

function mod(icon, title, body, open = false) {
  return `        <details class="module"${open ? ' open' : ''}>
            <summary><svg class="module-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#${icon}"/></svg>${title}<span class="module-chevron" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></span></summary>
            <div class="module-body">
${body}
            </div>
        </details>`;
}

function era(title, html) {
  return `                    <div class="archive-timeline-item">
                        <div class="archive-timeline-era">${title}</div>
                        <p class="archive-timeline-text">${html}</p>
                    </div>`;
}

function trait(strong, rest) {
  return `                    <li class="archive-trait-item"><strong>${strong}</strong>：${rest}</li>`;
}

function abil(label, val) {
  return `                    <div class="archive-ability-row"><span class="archive-ability-label">${label}</span><span class="archive-ability-value">${val}</span></div>`;
}

function rel(name, desc) {
  return `                <div class="archive-relation">
                    <span class="archive-relation-name">${name}</span>
                    <span class="archive-relation-desc">${desc}</span>
                </div>`;
}

function relic(name, desc) {
  return `                <div class="archive-relic">
                    <span class="archive-relic-name">${name}</span>
                    <p class="archive-relic-desc">${desc}</p>
                </div>`;
}

function anchor(key, val) {
  return `                <div class="archive-anchor">
                    <span class="archive-anchor-key">${key}</span>
                    <span class="archive-anchor-val">${val}</span>
                </div>`;
}

function music(icon, title, desc) {
  return `                    <div class="archive-music-item">
                        <svg class="archive-music-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#${icon}"/></svg>
                        <div class="archive-music-info"><div class="archive-music-title">${title}</div><div class="archive-music-desc">${desc}</div></div>
                    </div>`;
}

function quote(text, source) {
  return `                <div class="archive-quote-item">
                    <p class="archive-quote-text">${text}</p>
                    <p class="archive-quote-source">${source}</p>
                </div>`;
}

function sub(title, body) {
  return `                <details class="archive-subdetails">
                    <summary>${title}</summary>
                    <div class="archive-subbody">${body}</div>
                </details>`;
}

const chars = {};

/* ========== AIMISI ========== */
chars.aimisi = wrapMain([
  mod('ic-book', '背景故事', `
                <div class="archive-timeline">
${era('幼年 · 拉海洛冰原', `${OFF}（3.1 主线）爱弥斯的父母是磁暴研究员。一次考察中遭遇虚质磁暴，两人被吞噬；受虚质影响，父母在她记忆里的痕迹逐渐消褪。${CON}「笔记与录音」等物件为演绎归纳。${OFF}档案公开短文未逐字收录幼年；硬文本以 3.1 主线为准。`)}
${era('渐湖 · 与漂泊者相遇', `${OFF}（3.1 主线）为找回记忆，她独自前往渐湖——父母曾生活的小屋。失足坠入湖中，被漂泊者救出；同住小屋。她将漂泊者视为家人，并萌生成为英雄的梦想。${CON}「第一个感到被在乎」等情感措辞为归纳。`)}
${era('星炬学院 · 拉贝尔学部', `${OFF}长大后她进入星炬学院拉贝尔学部，成为隧者适格者；官方简介称其「在星海轻歌的电子幽灵」，性格活泼俏皮。${OFF}（剧情）同步率拔尖；以「飞行雪绒」为化名成为校园神秘歌手。${CON}串门社团、多平台官号等属企划外延。`)}
${era('隧门事件 · 牺牲', `${OFF}拉海洛深处隧门被破坏，鸣式阿列夫试图吞噬城市。本为驾驶课，模拟舱外却是真灾难。她突破神经同步安全阈值，与隧者超频共鸣：隧者被短暂唤醒，鸣式被封印回隧门之后。代价是肉体在超频中被撕碎，学生档案变成数据错误。学院登记其为「失踪的适格者」，材料上报洛瑟菈校长。`)}
${era('电子幽灵 · 现状', `${OFF}她依附隧者炉芯残余能量，以电子幽灵形态留存——自由漂浮、可进入数据系统内部，多数人看不见她。${ORI}飞行雪绒官号停更后，她仍在调频 9072 的深夜广播里轻歌。${OFF}后从隧门之后重返拉海洛；隧者离前赠予部分力量——现可显化隧者兵装、切换机兵形态参战。`)}
                </div>
${sub('展开 · 适格者与「人的本质」', `${OFF}适格者从索拉里斯各地选拔，借助外置装置与巨型机体「隧者」建立意识连接。星炬学院设拉贝尔学部专事培养。${OFF}（角色故事）同学曾讨论「人的本质」：爱、记忆、自我、信仰……爱弥斯后来只能理解为——人的本质是频率。`)}
                <p class="archive-note">${OFF}核心履历对齐档案公开「长航的星辉」、鉴定报告与 3.1 主线（父母/虚质磁暴/渐湖）。${ORI}调频 9072、站内夜电台频道为本站演绎，不改写官方宇宙规则。</p>
`, true),

  mod('ic-sparkles', '性格特征', `
                <ul class="archive-trait-list">
${trait('开朗阳光', `${OFF}走到哪都带着笑声；成了电子幽灵也照样在走廊飘来飘去，当隐形观众。`)}
${trait('活泼俏皮', `${OFF}爱搞怪、起昵称；给机兵写自运转逻辑时还配上带表情包的使用说明。`)}
${trait('温柔共情', `${CON}对他人情绪敏感。有人难过时不讲大道理，只在旁边默默飘着，偶尔哼歌。`)}
${trait('为他人着想', `${OFF}目标规划课上写下「拯救世界」，全班笑过——后来她真的做了。`)}
${trait('「要轻松快乐地活着」', `${CON}口头禅与社团串门的理由；背后藏着只有自己知道的沉重。`)}
${trait('英雄执念', `${OFF}战斗宣言「我会消灭，意图毁灭的恶」；希望让重要的人为她骄傲。`)}
                </ul>
`),

  mod('ic-bolt', '能力与战斗', `
                <div class="archive-ability">
${abil('共鸣属性', `${OFF}<strong>热熔</strong> · 武器：迅刀`)}
${abil('共鸣力', `${OFF}<strong>长航的星辉</strong>。使用共鸣能力时显化隧者兵装并融合，变身高机动机兵形态，化作星辉于夜色中飞行。`)}
${abil('声痕', `${OFF}胸口。生前拉贝尔曲线稳定上升，自然型共鸣者；电子幽灵后声痕变化，状态不算稳定。`)}
${abil('双形态', `${OFF}<strong>爱弥斯形态</strong>（迅刀近战）/ <strong>机兵形态</strong>（隧者兵装·双翼飞行），构型切换。`)}
${abil('共鸣模态', `${OFF}<strong>震谐</strong>（对单强化）/ <strong>聚爆</strong>（对群引爆）。`)}
${abil('核心技能', `${OFF}构型切换、光翼共奏、星辉破界而来（过载→终结）、流光突进等。`)}
${abil('专武', `${OFF}<strong>永远的启明星（逐星）</strong>。「你在寂静的星海中飞行，星屑在身侧崩解，时间在身后消亡。」`)}
${abil('电子幽灵', `${OFF}可进入数据系统、自由漂浮；无法像普通人干涉生者，但能观测。`)}
                </div>
`),

  mod('ic-link', '人物关系', `
${rel('漂泊者', `${OFF}家人。渐湖救命、冰原共度；唯一能稳定看见电子幽灵态爱弥斯的御者侧锚点。`)}
${rel('琳奈', `${OFF}学院同学。曾赠小型隧者手办，期望共赴「真正的星空」。`)}
${rel('西格莉卡 / 达妮娅 / 千咲', `${OFF}星炬学院同期或同辈；校园群像中的同学与助教圈。`)}
${rel('洛瑟菈', `${OFF}校长。失踪档案上报至她处；「那孩子明明看起来那么开朗……」`)}
${rel('隧者 / 拉海洛', `${OFF}外源性共鸣对象与载具语境；力量与存在形态的来源。`)}
`),

  mod('ic-star', '信物与意象', `
                <div class="archive-relic-list">
${relic('永远的启明星·逐星', `${OFF}专属迅刀。星海飞行的诗意锚点，战斗与自我认知的外化。`)}
${relic('隧者兵装 / 机兵双翼', `${OFF}共鸣显化物。变身后光炮与自运转逻辑，是她「还能战斗」的证明。`)}
${relic('飞行雪绒账号', `${OFF}官方角色设定中的歌手化名。${ORI}本站将其延展为夜电台与社区频道。`)}
${relic('冰原小屋与父母笔记', `${CON}渐湖旧居、录音与笔记——记忆流失主题的核心意象。`)}
${relic('调频 9072', `${ORI}本站深夜广播频率；凌晨一点信号最清晰的叙事约定。`)}
                </div>
`),

  mod('ic-music', '音乐 · 频率 · 广播', `
                <div class="archive-music-list">
${music('ic-mic', '飞行雪绒', `${OFF}校园人气神秘歌手。微博/B站等平台有角色官号运营（企划外延）。`)}
${music('ic-broadcast', '调频 9072', `${ORI}专属深夜频率；电子幽灵态下仍用歌声确认「我还在」。`)}
${music('ic-disc', 'EP《靛青宇宙》《纸飞机》', `${CON}企划向音乐作品；机甲·歌姬意象，同人可引用为频道歌单。`)}
${music('ic-star', '《那颗星梦见的春日》', `${OFF}远航星剧情相关曲目语境；学院广播立体声源的同人衔接点。`)}
                </div>
`),

  mod('ic-quote', '经典语录', `
                <div class="archive-quote-list">
${quote('「但愿我会让你感到骄傲，但愿我没有让你失望。」', '—— 爱弥斯 · 官方简介')}
${quote('「你，看见我了？」', '—— 登场问候 · 官方')}
${quote('「我会消灭，意图毁灭的恶。」', '—— 战斗宣言 · 官方')}
${quote('「现在的我，是电子幽灵哦~」', '—— 档案公开补充口吻 · 官方')}
                </div>
`),

  mod('ic-book', '官方锚点对照', `
                <div class="archive-anchor-list">
${anchor('版本', `${OFF}3.1「赠予雪中的你 / 长航的星辉」实装；3.0 短片初登场。`)}
${anchor('简介句', `${OFF}「星炬学院拉贝尔学部的隧者适格者，如今已成为在星海轻歌的电子幽灵。」`)}
${anchor('属性武器', `${OFF}热熔 · 迅刀 · 声痕胸口。`)}
${anchor('宇宙规则', `${OFF}对齐悲鸣/海蚀/共鸣者/鸣式等，见 docs/WORLDVIEW.md；禁止私设改写。`)}
${anchor('本站原创', `${ORI}调频 9072、I Miss You 频道结构、结契人（须另标 AO3）。`)}
                </div>
`),
].join('\n\n'));

/* ========== DENIA ========== */
chars.denia = wrapMain([
  mod('ic-book', '背景故事', `
                <div class="archive-timeline">
${era('造物与实验 · 「容器」', `${OFF}达妮娅自有记忆起便处于残星会实验与折磨之中，被当作鸣式阿列夫一的容器试验对象——可持续为阿列夫提供索拉里斯坐标，构成潜在浩劫。${CON}安插进星炬学院后，她才第一次过上「像普通人」的生活。`)}
${era('名字与生日', `${CON}名字取自俄语「再见」与「生日快乐」的叠合意象——告别与生日并置，呼应「天之弱 / 天邪鬼」般口是心非的性格。`)}
${era('双重身份 · 伪装', `${OFF}表面：学院里慵懒偷睡、可被甜点收买「蒙对」方向的好学生；暗面：残星会成员兼实验体、鸣式预备共鸣者。设计核心即「矛盾」：无害好学生 vs 预备容器。`)}
${era('频率流失与生日外出', `${OFF}患「频率持续流失」绝症态。深空联合提出协助治疗，她拒绝援助，仅以「生日外出」为条件与漂泊者同行——用漫游记住学院的每一个角落。`)}
${era('暗面 · 影下不落的黄金', `${OFF}3.2 主线暗面事件末：她与娜波摩（斯瓦茨洛）出现在罗伊冰原。她质问对方违背「不伤害西格莉卡等学生」的约定；对方称她们已「没用」，并警告弃子命运。`)}
${era('归于尽 · 失踪', `${OFF}得知体内实验与鸣式碎片真相后，她破坏相关设施，与阿列夫一同放逐虚质空间，切断阿列夫一与拉海洛的联系。${CON}站内口径：确认失踪，现有情报未显示对学院构成直接威胁。`)}
                </div>
                <p class="archive-note">${OFF}剧情对齐「影下不落的黄金」、角色 PV「人类伪装指南」、鉴定与成就「天之弱」。勿将同人评价写成官方定论。</p>
`, true),

  mod('ic-sparkles', '性格特征', `
                <ul class="archive-trait-list">
${trait('慵懒外壳', `${OFF}课堂随时可能偷睡——泡泡温度刚好是犯困的度数。`)}
${trait('矛盾 / 天之弱', `${OFF}渴望被拯救却主动拒绝救赎；口是心非（天邪鬼/天之弱）。`)}
${trait('软心肠', `${CON}甜点就能换来帮忙；替人采数据时会笑着劝「最好别问从哪来」。`)}
${trait('伪装艺术家', `${OFF}PV 假笑致敬《DARKER THAN BLACK》基尔西；「已同步」出自《银翼杀手 2049》。`)}
${trait('对西西的偏执温柔', `${OFF}西格莉卡不只是朋友，而是「带来生命光芒的存在」（日配访谈共识转述官方桥段）。互称娅娅/西西。`)}
${trait('对漂泊者', `${OFF}「最讨厌的那种人」——嘴上嫌弃，行动上仍选择同行与托付。`)}
                </ul>
`),

  mod('ic-bolt', '能力与战斗', `
                <div class="archive-ability">
${abil('共鸣属性', `${OFF}<strong>热熔</strong> · 武器：音感仪 · 声痕胸口`)}
${abil('共鸣能力', `${OFF}<strong>泡影视阈</strong>——制造隔绝虚质、提供防护的泡泡（故可不穿校服仍有防护）。`)}
${abil('双形态', `${OFF}<em>伪装形态</em>：泡影祈望；<em>真正形态</em>：鸣式侵蚀后，深邃寂静的太空意象（阿列夫相关）。`)}
${abil('专武', `${OFF}<strong>赝作的矮星</strong>`)}
${abil('战斗定位', `${OFF}快速协奏 · 共鸣解放伤害 · 牵引 · 集谐 · 谐度破坏 · 聚爆`)}
${abil('隐患', `${OFF}作为容器会持续提供坐标；阻止阿列夫的路径之一是牺牲容器本身。`)}
                </div>
`),

  mod('ic-link', '人物关系', `
${rel('西格莉卡（西西）', `${OFF}挚友。生命之光；柳橙蛋糕与生日桥段的情感核心。`)}
${rel('漂泊者', `${OFF}「最讨厌的那种人」；生日漫游的同行者。`)}
${rel('斯瓦茨洛 / 娜波摩', `${OFF}残星会侧创造者/上级语境；暗面事件中的弃子威胁。`)}
${rel('阿列夫一', `${OFF}鸣式；最终与之切断拉海洛联系。`)}
${rel('绯雪', `${OFF}设定资料中标注的相关人士。`)}
${rel('爱弥斯', `${CON}同校英雄前辈；社区常将两人悲剧对照，非官方「黑暗面」定论。`)}
`),

  mod('ic-star', '信物与意象', `
                <div class="archive-relic-list">
${relic('泡泡', `${OFF}能力与性格外化：隔绝虚质，也隔绝真心话。`)}
${relic('赝作的矮星', `${OFF}专属音感仪——与世界保持距离的「乐器」。`)}
${relic('柳橙蛋糕', `${OFF}为西格莉卡准备的生日意象；「官方怎么会写这种桥段」级催泪点。`)}
${relic('学院漫游路线', `${CON}天文台、训练场、图书馆露台、老树——用脚步完成的告别。`)}
${relic('虚质空间', `${OFF}最终放逐之地；站内「失踪」状态的物理锚点。`)}
                </div>
`),

  mod('ic-music', '演绎 · 频率气质', `
                <div class="archive-music-list">
${music('ic-music', 'PV「人类伪装指南」', `${OFF}2026-05-19。假笑、收声、「已同步」等文化致敬已公开说明。`)}
${music('ic-broadcast', '低频沉默', `${ORI}若接入站内调频叙事：她更像「关掉话筒的那一侧」——偶尔漏一句反话。`)}
${music('ic-star', '设计核「矛盾」', `${OFF}双身份 + 双形态战斗，外化表里冲突。`)}
                </div>
`),

  mod('ic-quote', '经典语录', `
                <div class="archive-quote-list">
${quote('「校服的主要作用是提供虚质防护吧？但我登记的能力就是制造防护泡泡……是不是很意外。」', '—— 官方相关台词语境')}
${quote('「西西……」', '—— 对西格莉卡')}
${quote('「好呀。」', '—— 对下次一起吃甜点的约定（可能没有下次）')}
                </div>
`),

  mod('ic-book', '官方锚点对照', `
                <div class="archive-anchor-list">
${anchor('登场', `${OFF}3.2「影下不落的黄金」；后续版本实装唤取「予明日以谎言」。`)}
${anchor('简介', `${OFF}星炬学院学生 · 残星会实验体 · 泡影视阈。`)}
${anchor('状态', `${OFF}剧情归于尽/虚质放逐；${CON}站内标注失踪、无直接威胁。`)}
${anchor('别称', `${CON}社群梗「达达尼昂」等截图误读，正式名以「达妮娅」为准。`)}
                </div>
`),
].join('\n\n'));

/* ========== SIGRICA ========== */
chars.sigrica = wrapMain([
  mod('ic-book', '背景故事', `
                <div class="archive-timeline">
${era('罗伊族 · 提前成年', `${OFF}罗伊符文共鸣者。身上印记来自成年礼日光祝福；因获部落认可提前三年成年。${CON}橙发造型令社群亲昵称「耙耙柑」。`)}
${era('昭日者之路', `${OFF}星炬学院在读学生。为成为合格昭日者，面对迷茫与痛苦仍全力以赴，揭开每一个谜底。「想被大家需要」的认真，连洛瑟菈都心疼。`)}
${era('助教与符文', `${CON}常以助教姿态批改符文作业；强调「守护」与「禁锢」不可混淆——天赋给翻译，理解要自己悟。`)}
${era('换日庆典 · 学院暗面', `${OFF}3.2「于影中启明的决心」。洛瑟菈于暗面发现不属于学院的频率；西格莉卡与漂泊者偶遇，共同挖掘残星会相关谜题。`)}
${era('与达妮娅', `${OFF}挚友，互称西西/娅娅。在达妮娅矛盾一生中，她是「能带来生命光芒的存在」。达妮娅失踪后，这份光成为她继续前行的重量。`)}
                </div>
                <p class="archive-note">${OFF}对齐 3.2 版本说明与角色展示。音乐短片等企划属官方外延，可作气质参考。</p>
`, true),

  mod('ic-sparkles', '性格特征', `
                <ul class="archive-trait-list">
${trait('淳朴真诚', `${OFF}洛瑟菈：「多可爱的小姑娘啊，淳朴又真诚。」`)}
${trait('认真负责', `${OFF}努力像大人一样背负使命，力有不逮也用尽全力。`)}
${trait('坚韧努力', `${OFF}为满足期待从不敷衍；昭日者是自我要求，不是标签。`)}
${trait('惹人疼', `${CON}认真到笨拙，身边人都想护着她。`)}
${trait('珍视羁绊', `${OFF}把娅娅视作生命里的光；友谊是最柔软也最坚定的部分。`)}
                </ul>
`),

  mod('ic-bolt', '能力与战斗', `
                <div class="archive-ability">
${abil('共鸣属性', `${OFF}<strong>气动</strong> · 武器：臂铠`)}
${abil('符文', `${OFF}<strong>罗伊符文</strong>共鸣者`)}
${abil('专武', `${OFF}<strong>昭日译注</strong>。「所有的阳光照耀着你，于是答案呼之欲出。」`)}
${abil('战斗风格', `${OFF}主力输出 · 牵引 · 声骸技能伤害`)}
${abil('共鸣解放', `${OFF}昭日之力倾泻气动伤害，呼应「近日的端点」意象。`)}
                </div>
`),

  mod('ic-link', '人物关系', `
${rel('达妮娅（娅娅）', `${OFF}挚友与生命之光。`)}
${rel('洛瑟菈', `${OFF}校长；暗面异变中的守护者。`)}
${rel('漂泊者', `${OFF}暗面调查伙伴。`)}
${rel('爱弥斯 / 琳奈 / 莫宁', `${OFF}学院同辈与师长圈。`)}
${rel('陆·赫斯', `${OFF}医务室老师等教职员语境。`)}
`),

  mod('ic-star', '信物与意象', `
                <div class="archive-relic-list">
${relic('昭日译注', `${OFF}专属臂铠；阳光与答案的隐喻。`)}
${relic('日光刻印', `${OFF}成年礼祝福印记；罗伊认同的外在证明。`)}
${relic('符文笔记批注', `${CON}「守护/禁锢」——她成长的方法论。`)}
${relic('柳橙 / 阳光色', `${CON}社群视觉共识，非正式设定。`)}
                </div>
`),

  mod('ic-music', '演绎 · 频率气质', `
                <div class="archive-music-list">
${music('ic-star', '3.2「于影中启明的决心」', `${OFF}5 星实装；唤取「符文烁醒之刻」。`)}
${music('ic-broadcast', '白昼频率', `${ORI}相对 9072 的夜电台：她更像白昼助教广播——清晰、用力、偶尔破音。`)}
${music('ic-sparkles', '设计核「昭日者」', `${OFF}用尽全力的纯粹，外化淳朴弧光。`)}
                </div>
`),

  mod('ic-quote', '经典语录', `
                <div class="archive-quote-list">
${quote('「为了满足大家的期待，为了成为一位合格的昭日者，她总是用尽全力。」', '—— 官方介绍语境')}
${quote('「嗨，我是西格莉卡！想了解符文的含义？有事情需要帮忙？那找我就好啦！」', '—— 角色展示')}
${quote('「守护」和「禁锢」分清楚。', '—— 助教批注 · 同人站日志衔接')}
                </div>
`),

  mod('ic-book', '官方锚点对照', `
                <div class="archive-anchor-list">
${anchor('版本', `${OFF}3.2 实装；3.0 立绘群像亮相。`)}
${anchor('属性', `${OFF}气动 · 臂铠 · 罗伊符文。`)}
${anchor('别称', `${CON}截图误读「百倍利卡」等，正式名「西格莉卡」。`)}
                </div>
`),
].join('\n\n'));

/* ========== LINNE ========== */
chars.linne = wrapMain([
  mod('ic-book', '背景故事', `
                <div class="archive-timeline">
${era('新联邦出身', `${OFF}出生新联邦，后入星炬学院。天生对可见光敏感，迷恋复杂罕见色彩。`)}
${era('预科 · 「我们生而眺望」', `${OFF}3.0 登场的预科学生。外表张扬，内里充满活力与力量；逃课记录堪称冒险日志，却常以出格方式完成心中「正确」。`)}
${era('折光溢彩觉醒', `${OFF}先天型共鸣者，声痕在左侧大腿后方。能通过「颜料罐」改变小范围可见光波长/频率，调制喷涂用「颜料」——实为非实体光学投影。`)}
${era('莫宁门下', `${OFF}隧者工学部教授莫宁的学生。${CON}机械直觉与导师「星枢演构」隐隐呼应；检讨照写，眼睛却悄悄弯起来。`)}
${era('愿望', `${OFF}自由飙车、挥洒色彩；愿平和美好的学院生活一直继续。${CON}曾在爱弥斯生日赠小型隧者手办，期望共赴真正星空。`)}
                </div>
                <p class="archive-note">${OFF}对齐鉴定报告「折光溢彩」与 3.0 版本资料。适格者资质：否。</p>
`, true),

  mod('ic-sparkles', '性格特征', `
                <ul class="archive-trait-list">
${trait('张扬外放', `${OFF}从不掩饰个性，永远冲在前面。`)}
${trait('活力充沛', `${OFF}用不完的精力，感染周围人。`)}
${trait('不服输', `${CON}越难越来劲；涂鸦与光学迷彩都是态度。`)}
${trait('可靠', `${OFF}关键时刻顶得上；张扬底下是扎实实力。`)}
${trait('洒脱不羁', `${OFF}不甘束缚，又珍惜录取通知书开启的自由归所。`)}
                </ul>
`),

  mod('ic-bolt', '能力与战斗', `
                <div class="archive-ability">
${abil('共鸣属性', `${OFF}<strong>衍射</strong> · 武器：佩枪`)}
${abil('共鸣能力', `${OFF}<strong>折光溢彩</strong>——调波长造光学投影，近乎隐身的光学迷彩。`)}
${abil('战斗技', `${OFF}光学迷彩隐藏 + 辅助机・射击支援。`)}
${abil('专武', `${OFF}<strong>溢彩荧辉</strong>。「斑斓荧辉在指间跃动，虹色划过炫目的光迹。」`)}
${abil('定位', `${OFF}快速协奏 · 普攻伤害 · 伤害加深 · 震谐/集谐 · 谐度破坏`)}
${abil('声痕', `${OFF}左侧大腿后方 · 先天型 · 稳定性高`)}
                </div>
`),

  mod('ic-link', '人物关系', `
${rel('莫宁', `${OFF}导师；深空联合学者 / 隧者工学部教授。`)}
${rel('爱弥斯', `${OFF}前辈同学；生日手办与「真正的星空」。`)}
${rel('西格莉卡 / 千咲', `${OFF}学院同辈。`)}
${rel('漂泊者', `${OFF}莫宁侧前辈语境；仰望的开拓者。`)}
${rel('洛瑟菈', `${OFF}校长；见证学生挑战天空。`)}
`),

  mod('ic-star', '信物与意象', `
                <div class="archive-relic-list">
${relic('溢彩荧辉', `${OFF}专属佩枪。`)}
${relic('颜料罐 / 光学投影', `${OFF}共鸣外化；喷涂即折光。`)}
${relic('录取通知书', `${OFF}正式成为星炬学生的节点物。`)}
${relic('炫彩妙妙杯面', `${OFF}特殊料理设定。`)}
${relic('小型隧者手办', `${CON}赠爱弥斯的心意锚点。`)}
                </div>
`),

  mod('ic-music', '演绎 · 频率气质', `
                <div class="archive-music-list">
${music('ic-star', '3.0「我们生而眺望」', `${OFF}唤取「非定义光谱」。`)}
${music('ic-sparkles', 'PV「幻彩」', `${OFF}光与影、隐与现的视觉宣言。`)}
${music('ic-broadcast', '频谱噪声', `${ORI}站内若串台：她是最吵、最亮的那一段载波。`)}
                </div>
`),

  mod('ic-quote', '经典语录', `
                <div class="archive-quote-list">
${quote('「群青、炽橙、明黄、新绿……猜猜看，接下来的色彩会是什么？」', '—— 官方角色语')}
${quote('「个性张扬的外表下，充满活力与力量。」', '—— 官方简介')}
${quote('「……但是，检讨还是要写的哦。」「好……」', '—— 角色故事语境')}
                </div>
`),

  mod('ic-book', '官方锚点对照', `
                <div class="archive-anchor-list">
${anchor('版本', `${OFF}3.0 实装。`)}
${anchor('别称', `${CON}截图误读「维奈」，正式名「琳奈」。`)}
${anchor('共鸣名', `${OFF}折光溢彩（非仅玩法标签「光学迷彩」）。`)}
                </div>
`),
].join('\n\n'));

/* ========== MORNYE ========== */
chars.mornye = wrapMain([
  mod('ic-book', '背景故事', `
                <div class="archive-timeline">
${era('深空联合 · 工程师', `${OFF}深空联合研究院学者/工程师，星炬学院隧者工学部教授。思维敏捷却不善言辞；对目标有惊人坚持。`)}
${era('星枢演构', `${OFF}异能力：调度精密操控屏，计算、推演、修正，直接操控范围内精细机械元件——「被仰望的星空尽在掌握」。`)}
${era('群星点亮时', `${OFF}个人 PV 展现对星空与真理的执着；认为星空是人类好奇的起源。${OFF}2026-01 曾为《鸣潮》×上海天文馆观星直播联动角色。`)}
${era('师生与牌友', `${OFF}学生：琳奈、朽叶千咲、漂泊者（前辈）。与校长洛瑟菈是领导亦曾是牌友——被拉着打荣耀之丘，牌技大成后发现对方在培养对手，遂放弃。`)}
${era('祈愿', `${OFF}期望跨越时空鸿沟，以双手触碰世界的宏大与美丽。内核常被概括为：科学家 · 探索者 · 牺牲者 · 逐星者。`)}
                </div>
                <p class="archive-note">${OFF}对齐 3.0「我们生而眺望」与共鸣者展示文案。</p>
`, true),

  mod('ic-sparkles', '性格特征', `
                <ul class="archive-trait-list">
${trait('思维敏捷', `${OFF}瞬间完成复杂推演。`)}
${trait('不善言辞', `${OFF}嘴笨，行动把事做到极致；「如果你需要，我会为你留出时间。」`)}
${trait('惊人坚持', `${OFF}对目标近乎偏执。`)}
${trait('低调内敛', `${CON}不在意被看见，在意是否触到更远一点。`)}
${trait('甘于牺牲', `${CON}愿为答案与学生押上自己。`)}
                </ul>
`),

  mod('ic-bolt', '能力与战斗', `
                <div class="archive-ability">
${abil('共鸣属性', `${OFF}<strong>热熔</strong> · 武器：长刃`)}
${abil('异能力', `${OFF}<strong>星枢演构</strong>`)}
${abil('专武', `${OFF}<strong>宙算仪轨</strong>`)}
${abil('定位', `${OFF}生存治疗 · 伤害加深 · 震谐/集谐 · 偏谐值累积`)}
${abil('机械义肢意象', `${CON}立绘机械腿等为广为人知的设计特征，写作时可作视觉锚，勿杜撰未公开机能参数。`)}
                </div>
`),

  mod('ic-link', '人物关系', `
${rel('洛瑟菈', `${OFF}领导、前牌友。`)}
${rel('琳奈 / 千咲', `${OFF}学生。`)}
${rel('漂泊者', `${OFF}前辈；毕业祝贺短信：「通往冰原的路上……」`)}
${rel('爱弥斯 / 西格莉卡', `${OFF}守护的学生一代。`)}
`),

  mod('ic-star', '信物与意象', `
                <div class="archive-relic-list">
${relic('宙算仪轨', `${OFF}专属长刃。`)}
${relic('操控屏阵列', `${OFF}星枢演构的视觉与战斗外化。`)}
${relic('星空 / 天文馆', `${OFF}好奇起源；联动强化的公共意象。`)}
${relic('毕业短信', `${OFF}与漂泊者羁绊的文字信物。`)}
                </div>
`),

  mod('ic-music', '演绎 · 频率气质', `
                <div class="archive-music-list">
${music('ic-star', '唤取「纵使星光于无穷远」', `${OFF}3.0 实装。`)}
${music('ic-sparkles', 'PV「群星点亮时」', `${OFF}星与机械并置。`)}
${music('ic-broadcast', '低频演算脉冲', `${ORI}站内串台：少言，只有仪表盘嘀嗒与偶尔一句「明白了」。`)}
                </div>
`),

  mod('ic-quote', '经典语录', `
                <div class="archive-quote-list">
${quote('「我是莫宁，深空联合研究院的工程师，星炬学院的教授。如果你需要，我会为你留出时间。」', '—— 角色展示')}
${quote('「她期望跨越那时空的鸿沟，以双手触碰世界的宏大与美丽。」', '—— 官方介绍语境')}
                </div>
`),

  mod('ic-book', '官方锚点对照', `
                <div class="archive-anchor-list">
${anchor('版本', `${OFF}3.0。`)}
${anchor('所属', `${OFF}深空联合研究院 + 星炬学院隧者工学部。`)}
${anchor('深空联合', `${OFF}角色侧表述充分；完整法理见 WORLDVIEW「待核实」。`)}
                </div>
`),
].join('\n\n'));

/* ========== LUCILLA ========== */
chars.lucilla = wrapMain([
  mod('ic-book', '背景故事', `
                <div class="archive-timeline">
${era('新联邦童年 · 相机', `${OFF}声痕位于右小腿外侧。童年生日宴会收到相机为礼物后觉醒共鸣——记忆系能力的起点。`)}
${era('记忆宫殿', `${OFF}除记忆回溯外，可剥离记忆碎片并实体化，在一定范围内「搭建」曾经历的景象甚至「事件」。复现极不稳定；超频经历多与强行复现回忆相关。档案曾出现超频史记载与二次删除的安保编辑痕迹。`)}
${era('校长 · 守望者', `${OFF}星炬学院校长，泛音社指导老师。脚踏实地的理想主义者：默默守护学生，见证他们挑战天空。「最让学生喜欢、最让大人物头疼」——自称可能是叛逆期。`)}
${era('暗面异变', `${OFF}3.2 换日庆典期间，于学院暗面发现不属于学院的频率，疑与残星会「游戏」相关；飞讯请漂泊者协助调查、保护师生。`)}
${era('母亲凯尔梅尔', `${OFF}档案盒中信件印章：「洛瑟菈的母亲，凯尔梅尔」——新联邦审查官；她口中「不称职的老师」。厌恶过往、删除记忆，却改变不了自己是谁。角色故事「学院来信」「日光落处」等逐步揭晓。`)}
                </div>
                <p class="archive-note">${OFF}对齐教职档案 RA2399-G 与 3.2 主线。莫宁是下属而非学生——关系表勿写反。</p>
`, true),

  mod('ic-sparkles', '性格特征', `
                <ul class="archive-trait-list">
${trait('理想与现实并存', `${OFF}怀抱理想，也清醒看护边界。`)}
${trait('守护者', `${OFF}为学生撑起奔赴理想的自由天地；梦想是「学生的梦想都能实现」。`)}
${trait('叛逆校长', `${OFF}会给大人物制造麻烦；也爱趴在办公室听窗外笑声。`)}
${trait('温柔与距离', `${CON}对漂泊者：老师要你收获力量，朋友私心要你潇洒一些。`)}
${trait('与记忆对峙', `${OFF}记忆是浮板也是风险；自愿原则贯穿她如何对待「宫殿」。`)}
                </ul>
`),

  mod('ic-bolt', '能力与战斗', `
                <div class="archive-ability">
${abil('共鸣属性', `${OFF}<strong>冷凝</strong> · 武器：音感仪`)}
${abil('共鸣能力', `${OFF}<strong>记忆宫殿</strong>`)}
${abil('战斗风格', `${OFF}快速协奏 · 普攻 · 声骸技能 · 霜渐 · 声骸伤害加深`)}
${abil('特殊料理', `${OFF}热烈清晨`)}
${abil('风险', `${OFF}复现不稳定；强行搭建回忆易触发超频相关症状（档案安保层另有删改）。`)}
                </div>
`),

  mod('ic-link', '人物关系', `
${rel('爱弥斯 / 西格莉卡 / 琳奈', `${OFF}学生。评价爱弥斯「比我会当老师」；疼惜西格莉卡淳朴真诚。`)}
${rel('莫宁', `${OFF}下属、牌友（隧者工学部教授）。`)}
${rel('漂泊者', `${OFF}学生与朋友；暗面调查委托人。`)}
${rel('凯尔梅尔', `${OFF}母亲 / 「不称职的老师」。`)}
`),

  mod('ic-star', '信物与意象', `
                <div class="archive-relic-list">
${relic('相机', `${OFF}觉醒信物。`)}
${relic('档案盒与母亲的信', `${OFF}记忆材料；重建宫殿的备选，是否阅读遵自愿原则。`)}
${relic('泛音社', `${OFF}指导教师身份锚点。`)}
${relic('开学日办公室', `${CON}「最爱的时光」场景。`)}
                </div>
`),

  mod('ic-music', '演绎 · 频率气质', `
                <div class="archive-music-list">
${music('ic-star', '3.2 主线核心', `${OFF}「影下不落的黄金」等。`)}
${music('ic-book', '角色故事', `${OFF}学院来信 · 日光落处。`)}
${music('ic-broadcast', '校内广播口吻', `${ORI}沉稳、留白多；偶尔一句叛逆冷幽默。`)}
                </div>
`),

  mod('ic-quote', '经典语录', `
                <div class="archive-quote-list">
${quote('「我现在的梦想，就是希望我学生的梦想都能实现。」', '—— 官方相关')}
${quote('「作为你的老师……作为你的朋友，我的私心还是希望你能过得更潇洒一些。」', '—— 对漂泊者')}
${quote('「那孩子明明看起来那么开朗……」', '—— 对爱弥斯失踪档案的叹息 · 站内衔接')}
                </div>
`),

  mod('ic-book', '官方锚点对照', `
                <div class="archive-anchor-list">
${anchor('版本', `${OFF}3.0 立绘群像；3.x 校长线深耕。`)}
${anchor('别称', `${CON}截图误读「洛瑟琳」，正式名「洛瑟菈」。`)}
${anchor('出生', `${OFF}新联邦。`)}
                </div>
`),
].join('\n\n'));

/* ========== DRIFTER ========== */
chars.drifter = wrapMain([
  mod('ic-book', '背景故事', `
                <div class="archive-timeline">
${era('异乡来客 · 玩家化身', `${OFF}漂泊者即《鸣潮》玩家角色。本站档案只锚定与拉海洛/星炬学院群像相交的官方节点，不虚构未公开个人履历。`)}
${era('渐湖 · 拉起爱弥斯', `${OFF}爱弥斯坠入渐湖时被其拉起；随后在拉海洛停留，陪她住冰原小屋，成为其「家人」羁绊的起点。`)}
${era('御者契约', `${OFF}作为隧者/拉海洛相关御者，与共鸣者爱弥斯、载具结成三方契约语境。${OFF}电子幽灵态爱弥斯——除御者外无人可见：可见性铁律。`)}
${era('频率流失', `${OFF}3.1 等剧情中亦面临频率流失风险，与契约/炉芯张力相关。`)}
${era('星炬学院 · 暗面', `${OFF}受洛瑟菈飞讯协助调查学院暗面；与西格莉卡偶遇共挖谜题；与达妮娅有「生日外出」同行。`)}
${era('前辈与同乡线索', `${OFF}莫宁的前辈，毕业时发去祝贺短信。${CON}与拉海洛共享「禾文明遗物」等身份线索，细节随官方更新。`)}
                </div>
                <p class="archive-note">${OFF}关系与剧情节点以游戏主线为准。${ORI}站内「黑海岸的信号」等标签为频道分类，勿写成官方职务。</p>
`, true),

  mod('ic-sparkles', '考据要点 · 性格接口', `
                <ul class="archive-trait-list">
${trait('玩家化身', `${OFF}不杜撰官方未写的童年/国籍定论。`)}
${trait('可见性铁律', `${OFF}第三人称路人视角不可「看见」电子幽灵爱弥斯。`)}
${trait('行动派倾听者', `${CON}同人常用：少言、伸手、同行——爱弥斯的家人感来自陪伴而非演说。`)}
${trait('频率旅人', `${ORI}本站意象：在黑海岸值夜与拉海洛御者之间切换的叙事接口。`)}
                </ul>
`),

  mod('ic-bolt', '战斗与契约', `
                <div class="archive-ability">
${abil('定位', `${OFF}可切换多属性共鸣者体系的主角；具体配队随版本。`)}
${abil('御者', `${OFF}与隧者/拉海洛驾驶·共鸣契约相关。`)}
${abil('炉芯', `${OFF}剧情中涉及炉芯权限、频率稳定与爱弥斯存在形态。`)}
${abil('注意', `${CON}勿把玩家养成数值写进设定卷宗当世界观物理。`)}
                </div>
`),

  mod('ic-link', '人物关系', `
${rel('爱弥斯', `${OFF}家人；唯一稳定可见电子幽灵态的人。`)}
${rel('拉海洛 / 隧者', `${OFF}御者与载具轴心。`)}
${rel('洛瑟菈', `${OFF}老师与朋友；暗面委托人。`)}
${rel('莫宁', `${OFF}后辈教授眼中的前辈。`)}
${rel('西格莉卡', `${OFF}暗面同行者。`)}
${rel('达妮娅', `${OFF}生日漫游同行；「最讨厌的那种人」的被指称者。`)}
${rel('琳奈', `${OFF}学院后辈同学圈。`)}
`),

  mod('ic-star', '信物与意象', `
                <div class="archive-relic-list">
${relic('渐湖的手', `${OFF}拉起爱弥斯的那一瞬——关系原点。`)}
${relic('毕业短信', `${OFF}致莫宁的文字信物。`)}
${relic('飞讯', `${OFF}洛瑟菈的调查召唤。`)}
${relic('盘古终端', `${OFF}共鸣者通用工具；捕捉残响/声骸。`)}
                </div>
`),

  mod('ic-music', '频率 · 广播接口', `
                <div class="archive-music-list">
${music('ic-broadcast', '可收听 9072', `${ORI}作为少数能「对上频率」的人，是飞行雪绒深夜广播的隐含听众。`)}
${music('ic-star', '黑海岸的信号', `${ORI}主站角色卡副标题；价值观夜守望，非官方官职。`)}
                </div>
`),

  mod('ic-quote', '相关摘录', `
                <div class="archive-quote-list">
${quote('「莫宁，毕业快乐。通往冰原的路上，我总会想起你在星空下的祈愿。」', '—— 旧漂泊者毕业短信')}
${quote('「作为你的老师……作为你的朋友，我的私心还是希望你能过得更潇洒一些。」', '—— 洛瑟菈对漂泊者')}
${quote('「你，看见我了？」', '—— 爱弥斯对御者')}
                </div>
`),

  mod('ic-book', '官方锚点对照', `
                <div class="archive-anchor-list">
${anchor('身份', `${OFF}玩家主角；拉海洛 3.x 核心同行者。`)}
${anchor('铁律', `${OFF}爱弥斯可见性；宇宙规则见 WORLDVIEW.md。`)}
${anchor('更新策略', `${OFF}摘要档：官方剧情推进后优先改关系表与时间线节点。`)}
                </div>
`),
].join('\n\n'));

const footers = {
  aimisi: `<footer class="zone-source">
        <strong>设定考据来源</strong>：${OFF}档案公开「长航的星辉」、BilibiliWiki/Fandom 鉴定报告与故事、游戏内文本。${CON}社区对渐湖家人线的归纳。${ORI}调频 9072、夜电台频道。著作权属广州库洛科技有限公司；同人演绎不代表官方立场。「结契人」若出现须标 AO3 原创。
    </footer>`,
  denia: `<footer class="zone-source">
        <strong>设定考据来源</strong>：${OFF}主线「影下不落的黄金」、PV「人类伪装指南」、维基/百科交叉。${CON}天之弱/天邪鬼性格解读。${ORI}站内失踪口径与频道衔接。著作权属库洛；勿添加未公开数值。
    </footer>`,
  sigrica: `<footer class="zone-source">
        <strong>设定考据来源</strong>：${OFF}3.2 版本说明、角色展示、萌娘百科交叉。${CON}助教符文批注气质。${ORI}白昼频率串台比喻。著作权属库洛。
    </footer>`,
  linne: `<footer class="zone-source">
        <strong>设定考据来源</strong>：${OFF}3.0 资料、折光溢彩鉴定报告、BilibiliWiki。${CON}涂鸦/光学迷彩表现归纳。${ORI}频谱串台比喻。著作权属库洛。
    </footer>`,
  mornye: `<footer class="zone-source">
        <strong>设定考据来源</strong>：${OFF}3.0 共鸣者展示、PV「群星点亮时」、天文馆联动公开信息。${ORI}演算脉冲串台比喻。著作权属库洛。
    </footer>`,
  lucilla: `<footer class="zone-source">
        <strong>设定考据来源</strong>：${OFF}教职档案/记忆宫殿设定、3.2 主线、萌娘百科。${CON}办公室「最爱时光」场景演绎需区分。著作权属库洛。
    </footer>`,
  drifter: `<footer class="zone-source">
        <strong>设定考据来源</strong>：${OFF}主线关系节点（爱弥斯/洛瑟菈/莫宁/西格莉卡/达妮娅）。${ORI}黑海岸信号标签、9072 听众接口。漂泊者为玩家化身；细节以官方为准。
    </footer>`,
};

function patchFile(id) {
  const file = path.join(root, 'characters', id, 'index.html');
  let html = fs.readFileSync(file, 'utf8');
  const mainRe = /<main class="zone-modules">[\s\S]*?<\/main>/;
  if (!mainRe.test(html)) throw new Error(`no main in ${id}`);
  html = html.replace(mainRe, chars[id]);
  const footRe = /<footer class="zone-source">[\s\S]*?<\/footer>/;
  if (!footRe.test(html)) throw new Error(`no footer in ${id}`);
  html = html.replace(footRe, footers[id]);
  // ensure ic-star exists for relic modules (already in sprites for most)
  fs.writeFileSync(file, html, 'utf8');
  const lines = html.split(/\r?\n/).length;
  console.log(`OK ${id}: ${lines} lines`);
}

for (const id of Object.keys(chars)) patchFile(id);
console.log('done');
