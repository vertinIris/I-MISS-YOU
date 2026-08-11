/**
 * 星炬学院主论坛 · 投稿附件上传
 * 独立实现，不依赖飞行雪绒站 UploadManager
 *
 * 能力：
 *   - 文本类：直接读入正文（.txt .md .markdown .json .csv .log .srt）
 *   - 图片类：客户端压缩后作为封面随投稿保存（.jpg .png .gif .webp .avif .bmp .svg）
 *   - 音频类：登记文件名与时长，正文追加署名行（浏览器本地存储无法承载音频体积）
 *   - 拖拽 / 点击 / 粘贴三种入口，全部带键盘可达性
 */
window.StarTorchUpload = (function () {
    'use strict';

    /* 上限较改版前提升 3 倍：文本 10MB→30MB，图片 5MB→15MB，并新增音频 30MB */
    var LIMITS = { text: 30 * 1024 * 1024, image: 15 * 1024 * 1024, audio: 30 * 1024 * 1024 };

    var EXT_MAP = {
        txt: 'text', md: 'text', markdown: 'text', json: 'text', csv: 'text', log: 'text', srt: 'text', lrc: 'text',
        jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', avif: 'image', bmp: 'image', svg: 'image',
        mp3: 'audio', wav: 'audio', ogg: 'audio', m4a: 'audio', flac: 'audio', aac: 'audio'
    };

    var ACCEPT = '.txt,.md,.markdown,.json,.csv,.log,.srt,.lrc,' +
                 '.jpg,.jpeg,.png,.gif,.webp,.avif,.bmp,.svg,' +
                 '.mp3,.wav,.ogg,.m4a,.flac,.aac';

    /* 压缩后仍超过该体积的图片不入库，仅本地预览，避免撑爆 localStorage 配额 */
    var STORE_LIMIT = 640 * 1024;

    var store = {};   // prefix -> attachment

    function kindOf(file) {
        var ext = String(file.name || '').split('.').pop().toLowerCase();
        if (EXT_MAP[ext]) return EXT_MAP[ext];
        if (/^image\//.test(file.type)) return 'image';
        if (/^audio\//.test(file.type)) return 'audio';
        if (/^text\//.test(file.type)) return 'text';
        return null;
    }

    function humanSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
        return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    }

    function toast(msg) {
        if (window.StarTorchForum && window.StarTorchForum.toast) window.StarTorchForum.toast(msg);
    }

    function setStatus(prefix, msg, tone) {
        var el = document.getElementById(prefix + '-upload-status');
        if (!el) return;
        el.textContent = msg || '';
        el.hidden = !msg;
        el.className = 'stf-upload-status' + (tone ? ' is-' + tone : '');
    }

    function renderPreview(prefix) {
        var box = document.getElementById(prefix + '-upload-preview');
        if (!box) return;
        var att = store[prefix];
        if (!att) { box.hidden = true; box.innerHTML = ''; return; }

        var thumb = att.dataUrl
            ? '<img class="stf-upload-thumb" src="' + att.dataUrl + '" alt="附件预览">'
            : '<span class="stf-upload-thumb stf-upload-thumb--icon" aria-hidden="true">' +
              (att.kind === 'audio' ? '♪' : '≡') + '</span>';

        box.innerHTML = safeHTML(thumb +
            '<span class="stf-upload-meta">' +
                '<b>' + escapeHTML(att.name) + '</b>' +
                '<span>' + escapeHTML(att.note) + '</span>' +
            '</span>' +
            '<button type="button" class="stf-upload-remove" data-upload-remove aria-label="移除附件">×</button>');
        box.hidden = false;
    }

    function escapeHTML(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    /* T3: 防御性 DOMPurify 消毒（附件预览 UGC innerHTML 渲染点二次防护） */
    function safeHTML(html) {
        if (typeof html !== 'string') return '';
        if (typeof window.sanitizeHTML === 'function') return window.sanitizeHTML(html);
        return html;
    }

    /* 图片压缩：长边收敛到 1280，输出 webp（不支持则 jpeg） */
    function compressImage(file, done) {
        if (/svg/.test(file.type) || /\.svg$/i.test(file.name)) {
            var svgReader = new FileReader();
            svgReader.onload = function () { done(svgReader.result); };
            svgReader.onerror = function () { done(null); };
            svgReader.readAsDataURL(file);
            return;
        }
        var reader = new FileReader();
        reader.onload = function () {
            var img = new Image();
            img.onload = function () {
                var max = 1280;
                var w = img.naturalWidth || img.width;
                var h = img.naturalHeight || img.height;
                var scale = Math.min(1, max / Math.max(w, h));
                var canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(w * scale));
                canvas.height = Math.max(1, Math.round(h * scale));
                try {
                    var ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    var out = canvas.toDataURL('image/webp', 0.82);
                    if (out.indexOf('data:image/webp') !== 0) out = canvas.toDataURL('image/jpeg', 0.82);
                    done(out);
                } catch(_) { done(reader.result); }
            };
            img.onerror = function () { done(null); };
            img.src = reader.result;
        };
        reader.onerror = function () { done(null); };
        reader.readAsDataURL(file);
    }

    function readAudioDuration(file, done) {
        try {
            var url = URL.createObjectURL(file);
            var audio = new Audio();
            var finish = function (sec) { URL.revokeObjectURL(url); done(sec); };
            audio.addEventListener('loadedmetadata', function () { finish(audio.duration); });
            audio.addEventListener('error', function () { finish(0); });
            audio.src = url;
            setTimeout(function () { if (audio.readyState === 0) finish(0); }, 3000);
        } catch(_) { done(0); }
    }

    function processFile(prefix, file) {
        if (!file) return;
        var kind = kindOf(file);
        if (!kind) {
            setStatus(prefix, '不支持的文件类型，请使用文本 / 图片 / 音频格式', 'error');
            return;
        }
        if (file.size > LIMITS[kind]) {
            setStatus(prefix, '文件过大：' + humanSize(file.size) + '，' + kind + ' 上限 ' + humanSize(LIMITS[kind]), 'error');
            return;
        }

        setStatus(prefix, '正在读取 ' + file.name + '…', 'busy');

        if (kind === 'text') {
            var reader = new FileReader();
            reader.onload = function () {
                var textarea = document.getElementById(prefix + '-content');
                var titleInput = document.getElementById(prefix + '-title');
                var text = String(reader.result || '').slice(0, 6000);
                if (textarea) {
                    textarea.value = text;
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                }
                if (titleInput && !titleInput.value.trim()) {
                    titleInput.value = file.name.replace(/\.[^.]+$/, '').slice(0, 300);
                }
                store[prefix] = { kind: 'text', name: file.name, note: humanSize(file.size) + ' · 已载入正文', dataUrl: '' };
                renderPreview(prefix);
                setStatus(prefix, '已载入正文（' + text.length + ' 字）', 'ok');
            };
            reader.onerror = function () { setStatus(prefix, '读取失败，请重试', 'error'); };
            reader.readAsText(file);
            return;
        }

        if (kind === 'image') {
            compressImage(file, function (dataUrl) {
                if (!dataUrl) { setStatus(prefix, '图片解析失败，请换一张', 'error'); return; }
                var approx = Math.round(dataUrl.length * 0.75);
                if (approx > STORE_LIMIT) {
                    store[prefix] = { kind: 'image', name: file.name, note: '仅本地预览（压缩后 ' + humanSize(approx) + '，超出保存上限）', dataUrl: dataUrl, keep: false };
                    setStatus(prefix, '图片过大，仅作预览，不会随投稿保存', 'warn');
                } else {
                    store[prefix] = { kind: 'image', name: file.name, note: '封面图 · ' + humanSize(approx) + '（已压缩）', dataUrl: dataUrl, keep: true };
                    setStatus(prefix, '封面已就绪', 'ok');
                }
                renderPreview(prefix);
            });
            return;
        }

        readAudioDuration(file, function (sec) {
            var mm = Math.floor(sec / 60), ss = Math.floor(sec % 60);
            var dur = sec ? (mm + ':' + String(ss).padStart(2, '0')) : '未知时长';
            store[prefix] = {
                kind: 'audio', name: file.name, dataUrl: '', keep: false,
                note: humanSize(file.size) + ' · ' + dur + ' · 仅登记信息'
            };
            renderPreview(prefix);
            setStatus(prefix, '音频信息已登记，将附在作品末尾', 'ok');
        });
    }

    function clear(prefix) {
        delete store[prefix];
        renderPreview(prefix);
        setStatus(prefix, '');
        var input = document.getElementById(prefix + '-upload-input');
        if (input) input.value = '';
    }

    function getAttachment(prefix) {
        var att = store[prefix];
        if (!att) return null;
        return {
            kind: att.kind,
            name: att.name,
            image: (att.kind === 'image' && att.keep) ? att.dataUrl : ''
        };
    }

    function attach(prefix) {
        var zone = document.getElementById(prefix + '-upload-zone');
        var input = document.getElementById(prefix + '-upload-input');
        if (!zone) return;
        if (input) input.setAttribute('accept', ACCEPT);

        function pick() { if (input) input.click(); }

        zone.addEventListener('click', function (e) {
            if (e.target.closest('[data-upload-remove]')) return;
            pick();
        });
        zone.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
        });
        ['dragenter', 'dragover'].forEach(function (evt) {
            zone.addEventListener(evt, function (e) {
                e.preventDefault(); e.stopPropagation();
                zone.classList.add('is-dragging');
            });
        });
        ['dragleave', 'dragend'].forEach(function (evt) {
            zone.addEventListener(evt, function (e) {
                e.preventDefault(); e.stopPropagation();
                zone.classList.remove('is-dragging');
            });
        });
        zone.addEventListener('drop', function (e) {
            e.preventDefault(); e.stopPropagation();
            zone.classList.remove('is-dragging');
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
                processFile(prefix, e.dataTransfer.files[0]);
            }
        });
        if (input) {
            input.addEventListener('change', function () {
                if (input.files && input.files.length) processFile(prefix, input.files[0]);
            });
        }

        var preview = document.getElementById(prefix + '-upload-preview');
        if (preview) {
            preview.addEventListener('click', function (e) {
                if (e.target.closest('[data-upload-remove]')) { e.stopPropagation(); clear(prefix); }
            });
        }

        /* 粘贴截图直接成为封面 */
        var content = document.getElementById(prefix + '-content');
        if (content) {
            content.addEventListener('paste', function (e) {
                var items = e.clipboardData && e.clipboardData.items;
                if (!items) return;
                for (var i = 0; i < items.length; i++) {
                    if (items[i].type && items[i].type.indexOf('image/') === 0) {
                        var f = items[i].getAsFile();
                        if (f) { e.preventDefault(); processFile(prefix, f); toast('已从剪贴板载入封面图'); }
                        return;
                    }
                }
            });
        }
    }

    return {
        attach: attach,
        clear: clear,
        getAttachment: getAttachment,
        ACCEPT: ACCEPT,
        LIMITS: LIMITS
    };
})();
