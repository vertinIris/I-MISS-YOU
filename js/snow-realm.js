/**
 * 飞行雪绒 ↔ 星炬学院 · 地址 / realm 共享配置与跨页同步
 * storage: snowfluff-location + snowfluff-realm
 * 通道: BroadcastChannel('snowfluff-realm-sync') + window storage 事件
 */
(function (global) {
    'use strict';

    var KEY_LOCATION = 'snowfluff-location';
    var KEY_REALM = 'snowfluff-realm';
    var CHANNEL = 'snowfluff-realm-sync';

    var LOCATIONS = [
        {
            location: '星炬学院',
            realm: 'startorch',
            desc: '拉贝尔学部所在地 · 日常训练与学习'
        },
        {
            location: '拉贝尔学部',
            realm: 'labelle',
            desc: '隧者适格者的训练与研究'
        },
        {
            location: '拉海洛',
            realm: 'lahairo',
            desc: '故乡的冰雪与极光'
        },
        {
            location: '雪原小屋',
            realm: 'snow-cabin',
            desc: '拉海洛冰原上的小屋 · 与家人共度的冬天'
        },
        {
            location: '电子海',
            realm: 'digital-sea',
            desc: '电子幽灵的游荡之处'
        }
    ];

    var LOC_TO_REALM = {};
    var REALM_TO_LOC = {};
    for (var i = 0; i < LOCATIONS.length; i++) {
        LOC_TO_REALM[LOCATIONS[i].location] = LOCATIONS[i].realm;
        REALM_TO_LOC[LOCATIONS[i].realm] = LOCATIONS[i].location;
    }

    /* 学院向 hero 文案：研讨 / 训练 / 公共频道，避免深夜电台私语感 */
    var FORUM_COPY = {
        startorch: {
            label: 'STARTORCH · ARCHIVE',
            title: '公共研讨频段',
            sub: '研讨厅已开门。共鸣者注疏与训练笔记，在讨论区公开沉淀。'
        },
        labelle: {
            label: 'LABELLE · TRAINING',
            title: '学部训练频段',
            sub: '拉贝尔训练场课表还挂着。适格笔记与同步率记录，在学部公共频道继续往下写。'
        },
        lahairo: {
            label: 'LAHAIRO · AURORA',
            title: '外勤观察频段',
            sub: '拉海洛外勤点已接通。冰原气象与故乡笔记，可汇总进研讨厅公开研读。'
        },
        'snow-cabin': {
            label: 'SNOW CABIN · HOME',
            title: '休整站频段',
            sub: '雪原小屋作外勤休整站。短记与冬日观察，同样归入公共研讨档。'
        },
        'digital-sea': {
            label: 'DIGITAL SEA · SIGNAL',
            title: '信号台频段',
            sub: '电子海信号台已接入学院频段。未署名回声可供研讨厅调阅标注。'
        }
    };

    function safeGet(key) {
        try { return localStorage.getItem(key); } catch(_) { return null; }
    }

    function safeSet(key, value) {
        try { localStorage.setItem(key, value); return true; } catch(_) { return false; }
    }

    function resolve(loc, realm) {
        var locationName = loc || safeGet(KEY_LOCATION) || '星炬学院';
        var slug = realm || safeGet(KEY_REALM) || LOC_TO_REALM[locationName] || 'startorch';
        if (!LOC_TO_REALM[locationName] && REALM_TO_LOC[slug]) {
            locationName = REALM_TO_LOC[slug];
        }
        if (!REALM_TO_LOC[slug] && LOC_TO_REALM[locationName]) {
            slug = LOC_TO_REALM[locationName];
        }
        if (!LOC_TO_REALM[locationName]) locationName = '星炬学院';
        if (!REALM_TO_LOC[slug]) slug = 'startorch';
        return { location: locationName, realm: slug };
    }

    function read() {
        return resolve(safeGet(KEY_LOCATION), safeGet(KEY_REALM));
    }

    function applyDocumentAttrs(loc, realm) {
        var state = resolve(loc, realm);
        try {
            document.documentElement.setAttribute('data-realm', state.realm);
            document.documentElement.setAttribute('data-location', state.location);
            if (document.body) {
                document.body.setAttribute('data-realm', state.realm);
                document.body.setAttribute('data-location', state.location);
            }
        } catch(_) { /* ignore */ }
        return state;
    }

    var bc = null;
    var listeners = [];
    var lastWritten = '';

    function notify(state, source) {
        var payload = {
            location: state.location,
            realm: state.realm,
            source: source || 'local'
        };
        for (var i = 0; i < listeners.length; i++) {
            try { listeners[i](payload); } catch(_) { /* ignore */ }
        }
    }

    function write(loc, realm, options) {
        var opts = options || {};
        var state = resolve(loc, realm);
        var fingerprint = state.location + '|' + state.realm;
        var unchanged = fingerprint === lastWritten &&
            safeGet(KEY_LOCATION) === state.location &&
            safeGet(KEY_REALM) === state.realm;

        safeSet(KEY_LOCATION, state.location);
        safeSet(KEY_REALM, state.realm);
        lastWritten = fingerprint;

        if (!opts.skipAttrs) applyDocumentAttrs(state.location, state.realm);

        if (!opts.fromRemote && !unchanged) {
            try {
                if (!bc && typeof BroadcastChannel !== 'undefined') {
                    bc = new BroadcastChannel(CHANNEL);
                }
                if (bc) bc.postMessage({ location: state.location, realm: state.realm });
            } catch(_) { /* ignore */ }
        }

        if (!opts.silent) notify(state, opts.fromRemote ? (opts.source || 'remote') : 'local');
        return state;
    }

    function subscribe(handler) {
        if (typeof handler !== 'function') return function () {};
        listeners.push(handler);
        return function unsubscribe() {
            var idx = listeners.indexOf(handler);
            if (idx >= 0) listeners.splice(idx, 1);
        };
    }

    function onRemoteState(loc, realm, source) {
        var state = resolve(loc, realm);
        var fingerprint = state.location + '|' + state.realm;
        if (fingerprint === lastWritten &&
            safeGet(KEY_LOCATION) === state.location &&
            safeGet(KEY_REALM) === state.realm) {
            return;
        }
        write(state.location, state.realm, {
            fromRemote: true,
            source: source,
            silent: false,
            skipAttrs: false
        });
    }

    function initSync() {
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                bc = new BroadcastChannel(CHANNEL);
                bc.onmessage = function (ev) {
                    var data = (ev && ev.data) || {};
                    if (!data.location && !data.realm) return;
                    onRemoteState(data.location, data.realm, 'broadcast');
                };
            } catch(_) { bc = null; }
        }

        global.addEventListener('storage', function (ev) {
            if (!ev) return;
            if (ev.key !== KEY_LOCATION && ev.key !== KEY_REALM) return;
            var next = read();
            onRemoteState(next.location, next.realm, 'storage');
        });
    }

    initSync();

    global.SnowRealm = {
        KEY_LOCATION: KEY_LOCATION,
        KEY_REALM: KEY_REALM,
        CHANNEL: CHANNEL,
        LOCATIONS: LOCATIONS,
        LOC_TO_REALM: LOC_TO_REALM,
        REALM_TO_LOC: REALM_TO_LOC,
        FORUM_COPY: FORUM_COPY,
        resolve: resolve,
        read: read,
        write: write,
        applyDocumentAttrs: applyDocumentAttrs,
        subscribe: subscribe,
        getForumCopy: function (realm) {
            return FORUM_COPY[realm] || FORUM_COPY.startorch;
        }
    };
})(typeof window !== 'undefined' ? window : this);
