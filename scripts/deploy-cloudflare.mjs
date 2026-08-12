#!/bin/bash
# ============================================================
# Cloudflare Pages 部署脚本
# 用法：node scripts/deploy-cloudflare.mjs
# 前置条件：已安装 Wrangler CLI 并登录 Cloudflare
#   npm install -g wrangler
#   wrangler login
# ============================================================

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function checkPrerequisites() {
  console.log('=== Cloudflare Pages 部署 ===\n');

  // 检查 Wrangler CLI
  try {
    const version = execSync('wrangler --version', { stdio: 'pipe' }).toString().trim();
    console.log(`✅ Wrangler CLI: ${version}`);
  } catch {
    console.error('❌ Wrangler CLI 未安装');
    console.error('   安装：npm install -g wrangler');
    process.exit(1);
  }

  // 检查 Wrangler 登录状态
  try {
    const whoami = execSync('wrangler whoami', { stdio: 'pipe' }).toString().trim();
    console.log(`✅ Cloudflare 账户: ${whoami}`);
  } catch {
    console.error('❌ Wrangler 未登录');
    console.error('   登录：wrangler login');
    process.exit(1);
  }

  // 检查构建产物
  const distFiles = ['dist/bundle-main.js', 'dist/bundle-forum.js', 'dist/css/main.min.css'];
  for (const f of distFiles) {
    const fp = path.join(ROOT, f);
    if (!fs.existsSync(fp)) {
      console.error(`❌ 构建产物不存在: ${f}`);
      console.error('   请先执行：node scripts/build-phase2.mjs');
      process.exit(1);
    }
  }
  console.log('✅ 构建产物就绪');

  // 检查 wrangler.toml
  const configPath = path.join(ROOT, 'wrangler.toml');
  if (!fs.existsSync(configPath)) {
    console.error('❌ wrangler.toml 不存在');
    process.exit(1);
  }
  console.log('✅ wrangler.toml 就绪');
}

function deploy() {
  console.log('\n--- 开始部署 ---');

  // 部署到 Cloudflare Pages
  // 如果是首次部署，需要先创建 Pages 项目
  // 如果已创建，直接部署即可

  const deployCmd = 'wrangler pages deploy . --project-name=i-miss-you';

  try {
    const result = execSync(deployCmd, {
      stdio: 'pipe',
      cwd: ROOT,
      timeout: 120000,
    }).toString();

    console.log(result);

    // 提取部署 URL
    const urlMatch = result.match(/https?:\/\/[a-z0-9-]+\.pages\.dev/);
    if (urlMatch) {
      console.log(`\n🎉 部署成功！访问 URL: ${urlMatch[0]}`);
      console.log('\n接下来：');
      console.log('  1. 在 Supabase Dashboard 添加 CORS 白名单（见 db/migrate-cloudflare-cors.sql）');
      console.log('  2. 更新 Supabase Redirect URLs');
      console.log('  3. 验证评论/登录/论坛功能');
      console.log('  4. 配置优选IP（可选，提升大陆速度）');
    }
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : '';
    
    if (stderr.includes('no pages projects found')) {
      console.log('\n⚠️  未找到 Pages 项目，需要先创建');
      console.log('   请在 Cloudflare Dashboard 创建 Pages 项目');
      console.log('   或执行：wrangler pages project create i-miss-you');
    } else {
      console.error('❌ 部署失败:', stderr.slice(0, 500));
    }
    process.exit(1);
  }
}

// 执行
checkPrerequisites();
deploy();
