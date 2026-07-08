/**
 * ClientRateLimiter — 客户端限流模块
 * 飞行雪绒 v9.2
 *
 * 职责:
 *   - 发送按钮 UI 冷却（3秒）
 *   - 重复内容检测（60秒内禁止重复）
 *   - 字数校验（1-500字）
 *   - 投稿频率限制（更严格）
 *   - 与服务端 RPC 限流配合使用
 */

var ClientRateLimiter = (function() {

    // ---- 评论限流状态 ----
    var lastCommentTime = 0;
    var lastCommentText = '';
    var COMMENT_COOLDOWN = 3000;       // 3秒 UI 冷却
    var COMMENT_REPEAT_WINDOW = 60000;  // 60秒内禁止重复
    var COMMENT_MAX_LENGTH = 500;
    var COMMENT_MIN_LENGTH = 1;

    // ---- 投稿限流状态 ----
    var lastSubmissionTime = 0;
    var SUBMISSION_COOLDOWN = 10000;    // 10秒 UI 冷却
    var SUBMISSION_MAX_LENGTH = 2000;
    var SUBMISSION_MIN_LENGTH = 1;
    var SUBMISSION_MAX_TITLE = 100;

    // ---- 评论限流 ----

    function canSendComment(text) {
        var now = Date.now();

        // 冷却期检查
        if (now - lastCommentTime < COMMENT_COOLDOWN) {
            var wait = Math.ceil((COMMENT_COOLDOWN - (now - lastCommentTime)) / 1000);
            return {
                allowed: false,
                reason: '\u8BF7\u7B49\u5F85 ' + wait + ' \u79D2\u540E\u518D\u53D1\u9001'
            };
        }

        // 重复内容检查
        if (text === lastCommentText && (now - lastCommentTime) < COMMENT_REPEAT_WINDOW) {
            return {
                allowed: false,
                reason: '\u8BF7\u52FF\u91CD\u590D\u53D1\u9001\u76F8\u540C\u5185\u5BB9'
            };
        }

        // 字数检查
        if (text.length < COMMENT_MIN_LENGTH || text.length > COMMENT_MAX_LENGTH) {
            return {
                allowed: false,
                reason: '\u8BC4\u8BBA\u5185\u5BB9\u9700\u5728 ' + COMMENT_MIN_LENGTH + '-' + COMMENT_MAX_LENGTH + ' \u5B57\u4E4B\u95F4'
            };
        }

        return { allowed: true };
    }

    function recordCommentSent(text) {
        lastCommentTime = Date.now();
        lastCommentText = text;
    }

    // ---- 投稿限流 ----

    function canSubmitWork(title, content) {
        var now = Date.now();

        // 冷却期检查
        if (now - lastSubmissionTime < SUBMISSION_COOLDOWN) {
            var wait = Math.ceil((SUBMISSION_COOLDOWN - (now - lastSubmissionTime)) / 1000);
            return {
                allowed: false,
                reason: '\u8BF7\u7B49\u5F85 ' + wait + ' \u79D2\u540E\u518D\u63D0\u4EA4'
            };
        }

        // 标题检查
        if (!title || title.length < 1 || title.length > SUBMISSION_MAX_TITLE) {
            return {
                allowed: false,
                reason: '\u6807\u9898\u9700\u5728 1-' + SUBMISSION_MAX_TITLE + ' \u5B57\u4E4B\u95F4'
            };
        }

        // 内容检查
        if (!content || content.length < SUBMISSION_MIN_LENGTH || content.length > SUBMISSION_MAX_LENGTH) {
            return {
                allowed: false,
                reason: '\u5185\u5BB9\u9700\u5728 ' + SUBMISSION_MIN_LENGTH + '-' + SUBMISSION_MAX_LENGTH + ' \u5B57\u4E4B\u95F4'
            };
        }

        return { allowed: true };
    }

    function recordSubmissionSent() {
        lastSubmissionTime = Date.now();
    }

    // ---- UI 冷却倒计时 ----

    function applyButtonCooldown(button, seconds, originalText) {
        if (!button) return;
        var remaining = seconds;
        var original = originalText || button.textContent;

        button.disabled = true;
        button.classList.add('cooldown');

        var timer = setInterval(function() {
            remaining--;
            if (remaining <= 0) {
                clearInterval(timer);
                button.disabled = false;
                button.classList.remove('cooldown');
                button.textContent = original;
            } else {
                button.textContent = remaining + 's';
            }
        }, 1000);
    }

    // ---- 重置（退出登录时调用） ----

    function reset() {
        lastCommentTime = 0;
        lastCommentText = '';
        lastSubmissionTime = 0;
    }

    return {
        canSendComment: canSendComment,
        recordCommentSent: recordCommentSent,
        canSubmitWork: canSubmitWork,
        recordSubmissionSent: recordSubmissionSent,
        applyButtonCooldown: applyButtonCooldown,
        reset: reset,
        COMMENT_MAX_LENGTH: COMMENT_MAX_LENGTH,
        SUBMISSION_MAX_LENGTH: SUBMISSION_MAX_LENGTH,
        SUBMISSION_MAX_TITLE: SUBMISSION_MAX_TITLE
    };
})();
