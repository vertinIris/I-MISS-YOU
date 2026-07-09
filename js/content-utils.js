/**
 * ContentUtils — 投稿正文解析（插图 URL / 预览文本）
 */
var ContentUtils = (function() {

    var IMAGE_MARK_RE = /\[插图\]\s*(https?:\/\/[^\s]+)/i;
    var SUPABASE_IMG_RE = /(https:\/\/[^\s]*\.supabase\.co[^\s]*\.(?:jpg|jpeg|png|gif|webp))/i;

    function extractImageUrl(content) {
        if (!content) return null;
        var m = content.match(IMAGE_MARK_RE);
        if (m) return m[1];
        m = content.match(SUPABASE_IMG_RE);
        return m ? m[1] : null;
    }

    function previewText(content, maxLen) {
        if (!content) return '';
        maxLen = maxLen || 300;
        var text = content
            .replace(IMAGE_MARK_RE, '')
            .replace(SUPABASE_IMG_RE, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        if (text.length > maxLen) return text.substring(0, maxLen) + '…';
        return text;
    }

    return {
        extractImageUrl: extractImageUrl,
        previewText: previewText
    };
})();
