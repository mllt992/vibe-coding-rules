#!/usr/bin/env node
/**
 * CI 双发布脚本：非交互式，靠 NODE_AUTH_TOKEN 鉴权。
 *
 * 由 .github/workflows/publish.yml 在 push tag (v*) 时调用。
 * 本地请用 `npm run release`（交互式，走 OTP）。
 *
 * 行为：
 *   - 同版本已在两个包都发过 → 直接退出 0（idempotent，重跑 tag 不会炸）
 *   - 只发过其中一个 → 只补发另一个
 *   - 第 2 个 publish 失败 → finally 恢复 package.json name
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const SHORT_NAME = 'vibe-coding-rules';
const SCOPED_NAME = '@xrilang/vibe-coding-rules';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_PATH = resolve(__dirname, '..', 'package.json');

const readPkg = () => JSON.parse(readFileSync(PKG_PATH, 'utf8'));
const writePkg = (pkg) => writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');

const shQuiet = (cmd) => {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
};
const shLive = (cmd) => execSync(cmd, { stdio: 'inherit', encoding: 'utf8' });

const pkg = readPkg();
const { version } = pkg;
const originalName = pkg.name;

console.log(`vibe-coding-rules release (CI) v${version}`);
console.log(`双发: ${SHORT_NAME} + ${SCOPED_NAME}`);

if (originalName !== SHORT_NAME) {
  console.error(`✗ package.json name 应为 "${SHORT_NAME}"，当前为 "${originalName}"`);
  process.exit(1);
}

const shortPublished = shQuiet(`npm view ${SHORT_NAME}@${version} version`);
const scopedPublished = shQuiet(`npm view ${SCOPED_NAME}@${version} version`);

if (shortPublished && scopedPublished) {
  console.log(`✓ v${version} 在两个包上都已发布，无事可做`);
  process.exit(0);
}

let nameChanged = false;
try {
  if (!shortPublished) {
    console.log(`\n▸ [1/2] 发布 ${SHORT_NAME}@${version}`);
    shLive('npm publish --access public');
    console.log(`✓ ${SHORT_NAME}@${version} 发布成功`);
  } else {
    console.log(`▸ [1/2] ${SHORT_NAME}@${version} 已存在，跳过`);
  }

  if (!scopedPublished) {
    console.log(`\n▸ [2/2] 发布 ${SCOPED_NAME}@${version}`);
    const pkgNow = readPkg();
    pkgNow.name = SCOPED_NAME;
    writePkg(pkgNow);
    nameChanged = true;

    shLive('npm publish --access public');
    console.log(`✓ ${SCOPED_NAME}@${version} 发布成功`);
  } else {
    console.log(`▸ [2/2] ${SCOPED_NAME}@${version} 已存在，跳过`);
  }

  console.log(`\n🎉 双发完成 v${version}`);
} finally {
  if (nameChanged) {
    const pkgFinal = readPkg();
    pkgFinal.name = originalName;
    writePkg(pkgFinal);
  }
}
