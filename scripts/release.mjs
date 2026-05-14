#!/usr/bin/env node
/**
 * 双发布脚本：同时发布短名 vibe-coding-rules 和 scope 别名 @xrilang/vibe-coding-rules。
 *
 * 用法：
 *   npm version patch           # 或 minor / major,自动 commit + tag
 *   git push --follow-tags
 *   npm run release             # 交互式问 OTP,顺序发两个包
 *
 * 失败时:
 *   - 预检查不通过 → 早退,不动任何文件
 *   - 第 1 个 publish 失败 → package.json 未改,可重试
 *   - 第 2 个 publish 失败 → finally 块自动恢复 package.json 的 name 字段
 *     重跑脚本会跳过已发布的包,只发还没发的
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const SHORT_NAME = 'vibe-coding-rules';
const SCOPED_NAME = '@xrilang/vibe-coding-rules';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_PATH = resolve(__dirname, '..', 'package.json');

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m',
};
const log = {
  step: (m) => console.log(`\n${C.bold}${C.cyan}▸${C.reset} ${C.bold}${m}${C.reset}`),
  ok: (m) => console.log(`${C.green}✓${C.reset} ${m}`),
  warn: (m) => console.log(`${C.yellow}⚠${C.reset} ${m}`),
  err: (m) => console.log(`${C.red}✗${C.reset} ${m}`),
  dim: (m) => console.log(`${C.dim}${m}${C.reset}`),
};

const readPkg = () => JSON.parse(readFileSync(PKG_PATH, 'utf8'));
const writePkg = (pkg) => writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');

function shQuiet(cmd) {
  try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim(); }
  catch { return null; }
}
function shLive(cmd) {
  execSync(cmd, { stdio: 'inherit', encoding: 'utf8' });
}

async function main() {
  const pkg = readPkg();
  const { version } = pkg;
  const originalName = pkg.name;

  console.log(`\n${C.bold}vibe-coding-rules release${C.reset} ${C.dim}v${version}${C.reset}`);
  console.log(`${C.dim}双发: ${SHORT_NAME} + ${SCOPED_NAME}${C.reset}`);

  // ===== 预检查 =====
  log.step('预检查');

  const dirty = shQuiet('git status --porcelain');
  if (dirty) {
    log.err('工作区不干净,请先 commit 或 stash:');
    console.log(dirty);
    process.exit(1);
  }
  log.ok('工作区干净');

  const npmUser = shQuiet('npm whoami');
  if (!npmUser) {
    log.err('未登录 npm,请先在 OS 终端跑 `npm login`');
    process.exit(1);
  }
  log.ok(`npm 已登录: ${npmUser}`);

  if (originalName !== SHORT_NAME) {
    log.err(`package.json name 应为 "${SHORT_NAME}",当前为 "${originalName}"`);
    log.dim('脚本以短名为起点,临时切到 scope 发第二次,最后恢复');
    process.exit(1);
  }
  log.ok(`package.json name = ${SHORT_NAME}`);

  const shortPublished = shQuiet(`npm view ${SHORT_NAME}@${version} version`);
  const scopedPublished = shQuiet(`npm view ${SCOPED_NAME}@${version} version`);
  if (shortPublished && scopedPublished) {
    log.err(`v${version} 在两个包上都已发布。请先 \`npm version patch\` bump 版本`);
    process.exit(1);
  }
  log.ok(`待发: ${SHORT_NAME}=${shortPublished ? '已发,跳过' : '待发'} | ${SCOPED_NAME}=${scopedPublished ? '已发,跳过' : '待发'}`);

  // ===== 交互发布 =====
  const rl = createInterface({ input: stdin, output: stdout });
  const askOtp = async (label) => {
    while (true) {
      const otp = (await rl.question(`${label} 6 位 OTP: `)).trim();
      if (/^\d{6}$/.test(otp)) return otp;
      log.warn('OTP 必须是 6 位数字,重输');
    }
  };

  let nameChanged = false;
  try {
    // [1/2] 短名
    if (!shortPublished) {
      log.step(`[1/2] 发布 ${SHORT_NAME}@${version}`);
      const otp = await askOtp('当前');
      shLive(`npm publish --otp=${otp}`);
      log.ok(`${SHORT_NAME}@${version} 发布成功`);
    } else {
      log.dim(`[1/2] ${SHORT_NAME}@${version} 已存在,跳过`);
    }

    // [2/2] scope
    if (!scopedPublished) {
      log.step(`[2/2] 发布 ${SCOPED_NAME}@${version}`);
      const pkgNow = readPkg();
      pkgNow.name = SCOPED_NAME;
      writePkg(pkgNow);
      nameChanged = true;
      log.dim(`已临时切换 package.json name → ${SCOPED_NAME}`);

      const otp = await askOtp('新的');
      shLive(`npm publish --access public --otp=${otp}`);
      log.ok(`${SCOPED_NAME}@${version} 发布成功`);
    } else {
      log.dim(`[2/2] ${SCOPED_NAME}@${version} 已存在,跳过`);
    }

    console.log(`\n${C.green}${C.bold}🎉 双发完成 v${version}${C.reset}`);
    console.log(`  ${SHORT_NAME}@${version}`);
    console.log(`  ${SCOPED_NAME}@${version}\n`);
  } finally {
    rl.close();
    if (nameChanged) {
      const pkgFinal = readPkg();
      pkgFinal.name = originalName;
      writePkg(pkgFinal);
      log.dim(`已恢复 package.json name → ${originalName}`);
    }
  }
}

main().catch((e) => {
  log.err('发布中断');
  if (e?.message) console.error(`${C.dim}${e.message}${C.reset}`);
  process.exit(1);
});
