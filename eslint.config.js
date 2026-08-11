/**
 * ESLint v9 Flat Config — 飞行雪绒项目
 * 仅检查源码（js/、forum/js/），不检查 dist/ 与 node_modules/
 */
import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'vendor/**',
      'forum/js/supabase.min.js',
      'forum/js/forum-import-data.js',
      'scripts/**'
    ]
  },
  {
    files: ['js/**/*.js', 'forum/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        location: 'readonly',
        navigator: 'readonly',
        history: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        IntersectionObserver: 'readonly',
        MutationObserver: 'readonly',
        matchMedia: 'readonly',
        performance: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        HTMLElement: 'readonly',
        Element: 'readonly',
        Node: 'readonly',
        DOMPurify: 'readonly',
        marked: 'readonly',
        hljs: 'readonly',
        Notyf: 'readonly',
        JustValidate: 'readonly',
        supabase: 'readonly',
        /* Browser APIs（T4: 补齐 no-undef 误报） */
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        Audio: 'readonly',
        Image: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        BroadcastChannel: 'readonly',
        TextEncoder: 'readonly',
        /* 项目跨文件全局（IIFE + window.X 导出模式，跨文件引用走全局作用域） */
        AdminAuth: 'readonly',
        AdminPanel: 'readonly',
        AuthManager: 'readonly',
        ClientRateLimiter: 'readonly',
        ContentUtils: 'readonly',
        DataRepository: 'readonly',
        RateLimiter: 'readonly',
        SecurityShield: 'readonly',
        SupabaseAdapter: 'readonly',
        supabaseClient: 'readonly',
        SyncManager: 'readonly',
        UploadManager: 'readonly',
        StarTorchAuth: 'readonly',
        StarTorchData: 'readonly',
        StarTorchUpload: 'readonly',
        escapeHTML: 'readonly',
        showSubmitToast: 'readonly',
        showToast: 'readonly',
        renderComments: 'readonly',
        renderCommunity: 'readonly',
        THREE: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      /* no-console 仅禁用 dir/trace/group（调试残留），log/warn/error 为项目运行时状态输出，有意保留 */
      'no-console': ['warn', { allow: ['log', 'warn', 'error', 'info'] }],
      'no-undef': 'error',
      /* no-redeclare 关闭：项目采用 var X = (function(){...})() + window.X 导出模式，
         定义文件内 var 与 config globals 会触发误报；跨文件引用靠全局作用域 */
      'no-redeclare': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'prefer-const': 'warn',
      'no-var': 'off',
      'eqeqeq': ['warn', 'smart'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error'
    }
  }
];
