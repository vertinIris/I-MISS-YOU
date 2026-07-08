/**
 * UploadManager — 拖拽上传 + 表单兼容
 * 飞行雪绒 v9.3
 *
 * 职责:
 *   - 拖拽上传文件（.txt .md .jpg .png .gif）
 *   - 文件类型与大小校验
 *   - 上传进度展示
 *   - 文本文件直接读取内容
 *   - 图片文件上传到 Supabase Storage
 *   - 与传统表单提交兼容
 */

var UploadManager = (function() {

    var ALLOWED_TYPES = {
        'text/plain':     { ext: '.txt',  maxSize: 10 * 1024 * 1024, label: '\u6587\u672C' },
        'text/markdown':  { ext: '.md',   maxSize: 10 * 1024 * 1024, label: 'Markdown' },
        'image/jpeg':     { ext: '.jpg',  maxSize: 5 * 1024 * 1024,  label: '\u56FE\u7247' },
        'image/png':      { ext: '.png',  maxSize: 5 * 1024 * 1024,  label: '\u56FE\u7247' },
        'image/gif':      { ext: '.gif',  maxSize: 5 * 1024 * 1024,  label: '\u56FE\u7247' }
    };

    var dropZone = null;
    var fileInput = null;
    var progressBar = null;
    var currentFile = null;

    function init(zoneId, inputId, progressId, onFileLoaded) {
        dropZone = document.getElementById(zoneId);
        fileInput = document.getElementById(inputId);
        progressBar = document.getElementById(progressId);

        if (!dropZone) return;

        // 拖拽事件
        dropZone.addEventListener('dragover', handleDragOver);
        dropZone.addEventListener('dragleave', handleDragLeave);
        dropZone.addEventListener('drop', function(e) {
            handleDrop(e, onFileLoaded);
        });

        // 拖拽防默认（防止浏览器打开文件）
        dropZone.addEventListener('dragenter', function(e) {
            e.preventDefault();
            e.stopPropagation();
        });

        // 点击触发文件选择
        dropZone.addEventListener('click', function() {
            if (fileInput) fileInput.click();
        });

        // 文件选择
        if (fileInput) {
            fileInput.addEventListener('change', function(e) {
                if (e.target.files && e.target.files.length > 0) {
                    processFile(e.target.files[0], onFileLoaded);
                }
            });
        }
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        if (dropZone) dropZone.classList.add('drag-active');
    }

    function handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        if (dropZone) dropZone.classList.remove('drag-active');
    }

    function handleDrop(e, callback) {
        e.preventDefault();
        e.stopPropagation();
        if (dropZone) dropZone.classList.remove('drag-active');

        var files = e.dataTransfer.files;
        if (!files || files.length === 0) return;
        processFile(files[0], callback);
    }

    function processFile(file, callback) {
        currentFile = file;

        // 文件类型校验
        var typeInfo = ALLOWED_TYPES[file.type];
        if (!typeInfo) {
            // 尝试通过扩展名判断
            var ext = file.name.split('.').pop().toLowerCase();
            var extMap = {
                'txt': 'text/plain',
                'md': 'text/markdown',
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif'
            };
            if (extMap[ext]) {
                file = new File([file], file.name, { type: extMap[ext] });
                typeInfo = ALLOWED_TYPES[file.type];
            }
        }

        if (!typeInfo) {
            showError('\u4E0D\u652F\u6301\u7684\u6587\u4EF6\u7C7B\u578B\u3002\u652F\u6301 .txt .md .jpg .png .gif');
            return;
        }

        // 文件大小校验
        if (file.size > typeInfo.maxSize) {
            var maxMB = typeInfo.maxSize / (1024 * 1024);
            showError('\u6587\u4EF6\u8FC7\u5927: ' + (file.size / 1024 / 1024).toFixed(1) +
                'MB\u3002\u4E0A\u9650 ' + maxMB + 'MB');
            return;
        }

        showProgress(0);

        if (file.type.startsWith('image/')) {
            uploadToStorage(file, callback);
        } else {
            readTextFile(file, callback);
        }
    }

    function readTextFile(file, callback) {
        var reader = new FileReader();
        reader.onprogress = function(e) {
            if (e.lengthComputable) {
                showProgress(Math.round((e.loaded / e.total) * 100));
            }
        };
        reader.onload = function(e) {
            showProgress(100);
            setTimeout(function() { hideProgress(); }, 800);
            if (typeof callback === 'function') {
                callback({
                    type: 'text',
                    filename: file.name,
                    content: e.target.result,
                    size: file.size
                });
            }
        };
        reader.onerror = function() {
            showError('\u6587\u4EF6\u8BFB\u53D6\u5931\u8D25');
            hideProgress();
        };
        reader.readAsText(file, 'UTF-8');
    }

    function uploadToStorage(file, callback) {
        if (!window.supabaseClient) {
            showError('\u5B58\u50A8\u670D\u52A1\u672A\u8FDE\u63A5\uFF0C\u8BF7\u4F7F\u7528\u6587\u672C\u8F93\u5165');
            return;
        }

        var ext = ALLOWED_TYPES[file.type].ext;
        var fileName = 'submissions/' + Date.now() + '_' +
            Math.random().toString(36).slice(2, 8) + ext;

        supabaseClient.storage
            .from('works')
            .upload(fileName, file, {
                onUploadProgress: function(e) {
                    if (e.lengthComputable || (e.loaded && e.total)) {
                        showProgress(Math.round((e.loaded / e.total) * 100));
                    }
                }
            })
            .then(function(result) {
                if (result.error) {
                    showError('\u4E0A\u4F20\u5931\u8D25: ' + result.error.message);
                    return;
                }

                var url = supabaseClient.storage
                    .from('works')
                    .getPublicUrl(fileName).data.publicUrl;

                hideProgress();
                if (typeof callback === 'function') {
                    callback({
                        type: 'image',
                        filename: file.name,
                        url: url,
                        storagePath: fileName,
                        size: file.size
                    });
                }
            })
            .catch(function(err) {
                showError('\u4E0A\u4F20\u5931\u8D25: ' + (err.message || err));
                hideProgress();
            });
    }

    function showProgress(percent) {
        if (!progressBar) return;
        progressBar.style.display = 'block';
        var fill = progressBar.querySelector('.progress-fill');
        if (fill) fill.style.width = percent + '%';
        var text = progressBar.querySelector('.progress-text');
        if (text) text.textContent = percent + '%';
    }

    function hideProgress() {
        if (progressBar) {
            setTimeout(function() {
                progressBar.style.display = 'none';
            }, 500);
        }
    }

    function showError(msg) {
        if (window.showToast) {
            showToast(msg, 'error');
        } else if (console) {
            console.error('[UploadManager]', msg);
        }
    }

    function getCurrentFile() {
        return currentFile;
    }

    function clearCurrentFile() {
        currentFile = null;
        if (fileInput) fileInput.value = '';
    }

    return {
        init: init,
        getCurrentFile: getCurrentFile,
        clearCurrentFile: clearCurrentFile,
        ALLOWED_TYPES: ALLOWED_TYPES
    };
})();
