/**
 * 星炬学院主论坛 · 独立数据层
 * 与飞行雪绒站（fxre_*）完全隔离，键前缀 stf_*
 */
(function () {
    'use strict';

    /* v1.3：档案向 type:lore 不再进入讨论区本地种子 / 云端 upsert */
    var SEED_VERSION = 'v1.3';
    var DISCUSSION_SEED_TYPES = {
        story: 1, poem: 1, art: 1, text: 1, video: 1
    };

    function isDiscussionSeedType(type) {
        return !!DISCUSSION_SEED_TYPES[String(type || '').toLowerCase()];
    }

    var SEED_SUBMISSIONS = [
        {
            id: 'stf_1', name: '达妮娅', type: 'poem', title: '泡泡',
            realm: 'startorch', tags: ['达妮娅'],
            content: '我吹了一个泡泡\n它是圆的，透明的，漂亮的\n光线穿过它的时候\n会变成彩虹\n\n它飘啊飘\n碰到墙壁也不破\n因为我的泡泡\n比墙壁还硬\n\n可是你伸出手的时候\n它就碎了\n\n不是因为你的手太重\n是因为泡泡本来就\n一碰就碎\n\n就像我',
            timeStr: '2026-07-05 14:20', likes: 23, liked: false, color: '#FFB6D9'
        },
        {
            id: 'stf_2', name: '西格莉卡', type: 'story', title: '第三个符文',
            realm: 'startorch', tags: ['西格莉卡'],
            content: '罗伊冰原的夜晚很安静。安静到能听见自己血液流动的声音。\n\n我蹲在雪地上，用匕首在空气中画第三个符文。刀尖很稳——我练了很多年，手不会抖。笔画也对——我背过所有符文的形态，一笔不差。\n\n但它没有亮。\n\n后来我想了很久，终于明白：那个符文的意思是「守护」。不是防御的守护，是那种——你明知道守护的东西终将失去，却依然选择站在它面前的守护。\n\n那时候的我，还没有失去过什么。所以符文不认我。\n\n现在，我好像快要失去什么了。可符文依然没有亮。\n\n也许是因为，我还不敢承认。',
            timeStr: '2026-07-03 23:15', likes: 31, liked: false, color: '#7FD99E'
        },
        {
            id: 'stf_4', name: '达妮娅', type: 'story', title: '最后一个生日',
            realm: 'startorch', tags: ['达妮娅', '西格莉卡'],
            content: '今天我过生日。\n\n其实不是真的。但漂泊者没有拆穿我，我就当是真的了。\n\n我带她去了天文台。那里的穹顶可以看到整片天空。我想记住星星的位置，这样以后就算看不见了，也能在脑子里画出来。\n\n我去了训练场。站在中间哼了一首歌。那首歌是我自己编的，没有歌词，只有旋律。以前在西格莉卡面前哼过一次，她说好听。我说是随便哼的，其实练了很多遍。\n\n我去了花园。那棵老树下面，是我和西格莉卡第一次一起做课题的地方。树皮比以前粗糙了。我也比以前粗糙了。\n\n我去了图书馆露台。夕阳被云遮住了。我假装没关系，说「下次再来看」。其实我知道没有下次了。\n\n漂泊者一直在旁边看着，什么也没说。她说「生日快乐」的时候，声音很轻。像是怕说重了，这个生日就会碎掉。\n\n谢谢你。今天。\n\n这是我过得最好的一个生日。虽然它是假的。但开心是真的。',
            timeStr: '2026-06-30 21:00', likes: 42, liked: false, color: '#FFB6D9'
        },
        {
            id: 'stf_5', name: '西格莉卡', type: 'poem', title: '写给娅娅的信',
            realm: 'startorch', tags: ['西格莉卡', '达妮娅'],
            content: '娅娅：\n\n这封信我写了很多遍，但一次也没有寄出去。\n\n因为每次写到一半，我就会发现：我写的不是信，是遗书。而你还活着。你还站在我面前，笑着说「没事呀」。\n\n所以我把信收起来，告诉自己：等她好了，我再寄。等她好了，我当面念给她听。\n\n可是娅娅，你什么时候才能好呢？\n\n你上次来花园看我的时候，手在发抖。你以为我没看到，但我看到了。你笑的时候，嘴角是歪的——不是平时那种可爱的歪，是在用力的歪。好像不用力，笑容就会掉下来。\n\n我想抓住你的手。但我的手也在抖。\n\n天赋告诉我你在消失。可我宁愿相信你说的「没事」。\n\n因为如果你真的在消失，那我这些年来学的所有符文、解的所有谜题、拼了命也要成为的昭日者——有什么用呢？\n\n我连一个人都守护不了。\n\n第三个符文，还是没有亮。\n\n——你的西西',
            timeStr: '2026-07-02 01:30', likes: 38, liked: false, color: '#7FD99E'
        },
        {
            id: 'stf_7', name: '达妮娅×西格莉卡', type: 'art', title: '花园里的两个影子',
            realm: 'startorch', tags: ['达妮娅', '西格莉卡'],
            content: '【画作构思】\n\n画面中央是一座花园。阳光从右侧斜照进来，将花圃切成明暗两半。\n\n左侧阴影中，一个女孩背对画面坐着。白发渐变成浅紫色，长发散落在草地上。她手里抱着一只小熊玩偶。她的周围飘着几个透明的泡泡，折射出淡淡的虹光。\n\n右侧阳光中，另一个女孩面朝阴影站着。她穿着星炬学院的制服，花型头饰在阳光下几乎透明。她伸出手，像是要触碰阴影中的人，但手指停在半空——差一点点，就能碰到了。\n\n两个人之间，有一道光与影的分界线。\n\n画的标题是：「差一点点」。\n\n——有时候，差一点点，就是一辈子。',
            timeStr: '2026-07-04 16:45', likes: 35, liked: false, color: '#D4A0FF'
        },
        {
            id: 'stf_8', name: '莫宁', type: 'text', title: '星枢演构课笔记',
            realm: 'startorch', tags: ['莫宁', '星炬学院'],
            content: '今日星枢演构课记录：\n\n1. 共鸣模态的稳定性与隧者情感波动呈负相关。样本数据显示，当个体处于「被需要」状态时，模态输出功率提升约 12%。\n2. 深空联合提供的「换日仪式」资料中，关于拉海洛的部分存在 17 处关键数据缺失。建议学生不要据此做结课论文。\n3. 琳奈同学的预实验报告写得不错，但光学迷彩部分的功耗计算少了一个数量级。已批注。\n\n课后有学生问我：「教授，您相信电子幽灵吗？」\n\n我回答：「我相信数据。而当数据无法解释某个现象时，我会先检查仪器，再检查自己。」\n\n但我没有说的是——\n\n有些仪器，是检查不了人心的。',
            timeStr: '2026-07-06 11:20', likes: 18, liked: false, color: '#FF6B5B'
        },
        {
            id: 'stf_9', name: '洛瑟菈', type: 'story', title: '校长办公室的午后',
            realm: 'startorch', tags: ['洛瑟菈', '星炬学院'],
            content: '下午三点十七分，阳光从百叶窗的缝隙里照进来，落在办公桌上那盆干掉的薄荷上。\n\n我给它浇了一点水。\n\n凯尔梅尔以前总说，养植物和养学生一样——不能浇太多，也不能太少。要让它自己学会往下扎根。\n\n我有时会在深夜打开学生档案，看看那些已经不在的人。不是怀念，是确认。确认自己曾经记得他们，确认自己没有因为他们的离开而变得麻木。\n\n今天翻到的是一张 smiling face。照片里的女孩扎着歪马尾，眼睛很亮，像是随时会说出什么让人接不住的话。\n\n我把档案合上，起身拉开窗帘。\n\n星炬学院的钟楼还在。学生们还在走廊上跑。\n\n这就够了。\n\n只要学院还在，他们就还在某个地方。',
            timeStr: '2026-07-02 16:00', likes: 26, liked: false, color: '#E8C56A'
        },
        /* —— v1.1：自飞行雪绒站迁入（该站收敛为爱弥斯本人频道）—— */
        {
            id: 'stf_10', name: '漂泊者', type: 'text', title: '来自黑海岸的信号',
            realm: 'startorch', tags: ['漂泊者', '爱弥斯'],
            content: '在黑海岸值夜的时候，收到了一段不明信号。\n\n频率：9072Hz\n持续时间：0.3秒\n间隔：不规律\n\n信号内容被噪音覆盖了大半，但有一段能勉强辨识——像是一个人唱歌的声音。不是完整的旋律，只有几个音符，反复出现。\n\n我把那几个音符记了下来。如果你在星炬学院听到有人哼同样的调子，请告诉我。\n\n我在找一个声音的主人。也许她不知道自己被听见了。',
            timeStr: '2026-07-01 02:40', likes: 19, liked: false, color: '#A8D8FF'
        },
        {
            id: 'stf_11', name: '漂泊者信使', type: 'story', title: '信号塔守望者',
            realm: 'startorch', tags: ['漂泊者', '爱弥斯'],
            content: '我在信号塔上等了三个小时。\n\n不是因为职责。是因为她说「今晚的星星会很亮」。后来信号塔的灯真的亮了，但那不是星星，是有人在模拟舱里偷偷调的天文台投影。\n\n我知道是谁。只有她会把星星的频率调到9072。\n\n我没有上去找她。有些歌，只有在没有人听的时候才唱得出来。有些星星，只有在没有人看的时候才亮得起来。\n\n我只是在塔下站了一会儿，抬头看了看那片假星空。\n\n——虽然不是真的，但很美。\n\n谢谢你让我看到了。',
            timeStr: '2026-06-28 23:15', likes: 27, liked: false, color: '#FFD700'
        },
        {
            id: 'stf_12', name: '琳奈', type: 'story', title: '关于爱弥斯同学的一些事',
            realm: 'startorch', tags: ['琳奈', '爱弥斯', '星炬学院'],
            content: '我是星炬学院拉贝尔学部的学生，和爱弥斯同学同班。\n\n我想写一些关于她的事，因为她已经不在了。\n\n爱弥斯同学很开朗。真的很开朗。不是那种硬撑出来的开朗，是那种——好像世界上所有的好事都会发生一样的开朗。她会在走廊上跟所有人打招呼，包括不认识的。她会在别人的生日会上唱最大声的歌，虽然跑调跑得离谱。\n\n她送过我一个隧者手办。很小的那种，自己做的，用的材料我认不出来。她说："琳奈，总有一天我们一起去看真正的星空。"\n\n我说好呀。\n\n然后她就失踪了。\n\n校长洛瑟菈女士把她的档案调走了。我问过辅导员，辅导员说"不清楚"。我问过同班的千咲，千咲说她最后一次见爱弥斯是在隧者训练场，那天爱弥斯说要去试一个新的共鸣模态。\n\n后来我在网上看到一个叫"飞行雪绒"的歌手。声音很像她。歌里有一些只有我们班才知道的梗——比如"渐湖的冰面下面有鱼"。\n\n我不确定是不是她。但如果真的是的话：\n\n爱弥斯同学，星空还在。你看到了吗？',
            timeStr: '2026-07-03 18:30', likes: 29, liked: false, color: '#B98CFF'
        }
    ];

    var SEED_COMMENTS = {
        'stf_2': [
            { name: '达妮娅', text: '西西，符文不亮也没关系。你亮着就够了。', timeStr: '7月4日 00:10', color: '#FFB6D9' }
        ],
        'stf_5': [
            { name: '达妮娅', text: '我收下了。等我们都好了，你念给我听。', timeStr: '7月2日 08:00', color: '#FFB6D9' }
        ],
        'stf_8': [
            { name: '琳奈', text: '教授，那个数量级我已经改好了！下次课交。', timeStr: '7月6日 14:30', color: '#B98CFF' }
        ]
    };

    function safeGet(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }

    function safeSet(key, value) {
        try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
    }

    /**
     * v1.2: 在 v1.1「增量合并」基础上，额外合并《论坛内容》二创库导入种子
     * （forum-import-data.js → window.StarTorchImportSeed，由 scripts/build-forum-import.cjs 生成）。
     * 导入种子用 imp_ 前缀，与官方 stf_ 种子互不冲突。
     * 注意：导入种子仅作为「本地种子」写入 stf_submissions，渲染时可见；
     *       云端播种（ensureCloudSeed）仍只推送官方 12 条，避免 573 次 upsert。
     */
    function readJSON(key, fallback) {
        try {
            var raw = safeGet(key);
            if (!raw) return fallback;
            var parsed = JSON.parse(raw);
            return parsed == null ? fallback : parsed;
        } catch (e) { return fallback; }
    }

    function getImportSeed() {
        try {
            var s = (typeof window !== 'undefined') && window.StarTorchImportSeed;
            if (!(s && Array.isArray(s))) return [];
            /* 档案向 lore 不进讨论区种子（构建侧也会分流；此处双保险） */
            return s.filter(function (item) {
                return item && item.id && isDiscussionSeedType(item.type);
            });
        } catch (e) { return []; }
    }

    function ensureSeedData() {
        var key = 'stf_seed_version';
        if (safeGet(key) === SEED_VERSION) return;

        for (var targetId in SEED_COMMENTS) {
            if (!safeGet('stf_comments_' + targetId)) {
                safeSet('stf_comments_' + targetId, JSON.stringify(SEED_COMMENTS[targetId]));
            }
        }

        var existing = readJSON('stf_submissions', []);
        if (!Array.isArray(existing)) existing = [];

        /* 清掉历史误入讨论区的档案 lore（imp_* 或 type=lore） */
        var beforePurge = existing.length;
        existing = existing.filter(function (s) {
            if (!s || !s.id) return false;
            if (String(s.type || '').toLowerCase() === 'lore') return false;
            return true;
        });
        var purged = beforePurge - existing.length;

        var known = {};
        existing.forEach(function (s) { if (s && s.id) known[s.id] = true; });

        var tombstones = readJSON('stf_seed_removed', []);
        var removed = {};
        if (Array.isArray(tombstones)) {
            tombstones.forEach(function (id) { removed[id] = true; });
        }

        var allSeeds = SEED_SUBMISSIONS.concat(getImportSeed());
        var added = 0;
        allSeeds.forEach(function (s) {
            if (!s || !s.id || !isDiscussionSeedType(s.type)) return;
            if (known[s.id] || removed[s.id]) return;
            existing.push(s);
            added++;
        });

        if (added > 0 || purged > 0 || existing.length === 0) {
            /* 按时间倒序，保证新并入的帖子落到正确位置 */
            existing.sort(function (a, b) {
                return String((b && b.timeStr) || '').localeCompare(String((a && a.timeStr) || ''));
            });
            safeSet('stf_submissions', JSON.stringify(existing));
        }

        safeSet(key, SEED_VERSION);
    }

    /** 记录被删除的种子帖，避免下次播种复活 */
    function markSeedRemoved(id) {
        if (!id) return;
        var list = readJSON('stf_seed_removed', []);
        if (!Array.isArray(list)) list = [];
        if (list.indexOf(id) === -1) {
            list.push(id);
            safeSet('stf_seed_removed', JSON.stringify(list));
        }
    }

    function getSubmissions() {
        try {
            var data = safeGet('stf_submissions');
            var all = data ? JSON.parse(data) : [];
            return all.filter(function (s) { return s.realm === 'startorch'; });
        } catch (e) { return []; }
    }

    function saveSubmissions(list) {
        safeSet('stf_submissions', JSON.stringify(list));
    }

    function getComments(targetId) {
        try {
            var data = safeGet('stf_comments_' + targetId);
            return data ? JSON.parse(data) : [];
        } catch (e) { return []; }
    }

    function saveComments(targetId, list) {
        safeSet('stf_comments_' + targetId, JSON.stringify(list));
    }

    function getNickname() {
        return safeGet('stf_nickname') || '';
    }

    function setNickname(name) {
        safeSet('stf_nickname', name);
    }

    window.StarTorchData = {
        ensureSeedData: ensureSeedData,
        getSeedSubmissions: function () { return SEED_SUBMISSIONS; },
        getSubmissions: getSubmissions,
        saveSubmissions: saveSubmissions,
        markSeedRemoved: markSeedRemoved,
        getComments: getComments,
        saveComments: saveComments,
        getNickname: getNickname,
        setNickname: setNickname
    };
})();
