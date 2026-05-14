#!/usr/bin/env node
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATE_ROOT = resolve(__dirname, '..', 'template');
const CWD = process.cwd();

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', red: '\x1b[31m',
};
const log = {
  info: (m) => console.log(`${C.cyan}ℹ${C.reset} ${m}`),
  ok: (m) => console.log(`${C.green}✓${C.reset} ${m}`),
  warn: (m) => console.log(`${C.yellow}⚠${C.reset} ${m}`),
  err: (m) => console.log(`${C.red}✗${C.reset} ${m}`),
  step: (m) => console.log(`\n${C.bold}${m}${C.reset}`),
  dim: (m) => console.log(`${C.dim}${m}${C.reset}`),
};

function copyDirRecursive(src, dst, { onConflict = 'skip' } = {}) {
  if (!existsSync(dst)) mkdirSync(dst, { recursive: true });
  let copied = 0, skipped = 0;
  for (const entry of readdirSync(src)) {
    const s = join(src, entry);
    const d = join(dst, entry);
    const st = statSync(s);
    if (st.isDirectory()) {
      const r = copyDirRecursive(s, d, { onConflict });
      copied += r.copied; skipped += r.skipped;
    } else {
      if (existsSync(d) && onConflict === 'skip') { skipped++; continue; }
      copyFileSync(s, d);
      copied++;
    }
  }
  return { copied, skipped };
}

async function main() {
  if (!existsSync(TEMPLATE_ROOT)) {
    log.err(`找不到模板目录: ${TEMPLATE_ROOT}`);
    process.exit(1);
  }

  console.log('');
  console.log(`${C.bold}vibe-coding-rules${C.reset} ${C.dim}— AI 协作规范套件接入${C.reset}`);
  console.log(`${C.dim}目标项目: ${CWD}${C.reset}`);

  const rl = createInterface({ input, output });
  const ask = async (q, def) => {
    const ans = (await rl.question(`${q}${def ? ` ${C.dim}(${def})${C.reset}` : ''}: `)).trim();
    return ans || def || '';
  };
  const choose = async (q, choices) => {
    console.log(`${q}`);
    choices.forEach((c, i) => console.log(`  ${i + 1}) ${c.label}${c.hint ? ` ${C.dim}- ${c.hint}${C.reset}` : ''}`));
    while (true) {
      const a = (await rl.question(`选择 [1-${choices.length}]: `)).trim();
      const n = parseInt(a, 10);
      if (n >= 1 && n <= choices.length) return choices[n - 1].value;
      log.warn('输入无效,请重试');
    }
  };

  try {
    // ====== CLAUDE.md ======
    log.step('1/3  CLAUDE.md');
    const targetClaude = join(CWD, 'CLAUDE.md');
    const tplClaude = join(TEMPLATE_ROOT, 'CLAUDE.md');
    if (existsSync(targetClaude)) {
      log.warn('目标项目已存在 CLAUDE.md');
      const action = await choose('如何处理?', [
        { value: 'rename', label: '本套件 CLAUDE.md 改名为 CLAUDE_纲领.md,在原 CLAUDE.md 顶部加引用行', hint: '推荐' },
        { value: 'sidecar', label: '仅写入 CLAUDE_纲领.md,不修改原 CLAUDE.md', hint: '手动合并' },
        { value: 'skip', label: '跳过 CLAUDE.md', hint: '后续手动处理' },
      ]);
      if (action === 'rename') {
        copyFileSync(tplClaude, join(CWD, 'CLAUDE_纲领.md'));
        const orig = readFileSync(targetClaude, 'utf8');
        const refLine = '> 本项目协作纲领见 [`./CLAUDE_纲领.md`](./CLAUDE_纲领.md)\n\n';
        if (!orig.includes('CLAUDE_纲领.md')) {
          writeFileSync(targetClaude, refLine + orig);
          log.ok('已写入 CLAUDE_纲领.md 并在原 CLAUDE.md 顶部加引用行');
        } else {
          log.ok('已写入 CLAUDE_纲领.md(原文件已含引用,未修改)');
        }
      } else if (action === 'sidecar') {
        copyFileSync(tplClaude, join(CWD, 'CLAUDE_纲领.md'));
        log.ok('已写入 CLAUDE_纲领.md(请手动在原 CLAUDE.md 中引用)');
      } else {
        log.dim('已跳过 CLAUDE.md');
      }
    } else {
      copyFileSync(tplClaude, targetClaude);
      log.ok('已写入 CLAUDE.md');
    }

    // ====== docs/ ======
    log.step('2/3  docs/');
    const targetDocs = join(CWD, 'docs');
    const tplDocs = join(TEMPLATE_ROOT, 'docs');
    if (existsSync(targetDocs)) {
      log.warn('目标项目已存在 docs/ 目录');
      const action = await choose('如何处理?', [
        { value: 'merge', label: '合并(同名文件保留你的,补全缺失文件)', hint: '推荐' },
        { value: 'skip', label: '跳过 docs/', hint: '后续手动处理' },
      ]);
      if (action === 'merge') {
        const r = copyDirRecursive(tplDocs, targetDocs, { onConflict: 'skip' });
        log.ok(`docs/ 合并完成: 新增 ${r.copied} 个文件, 跳过(已存在) ${r.skipped} 个`);
      } else {
        log.dim('已跳过 docs/');
      }
    } else {
      const r = copyDirRecursive(tplDocs, targetDocs);
      log.ok(`已写入 docs/: ${r.copied} 个文件`);
    }

    // ====== skills ======
    log.step('3/3  Workflow Skills (7 个)');
    const installLoc = await choose('安装到哪里?', [
      { value: 'user', label: '用户级 (~/.claude/skills/)', hint: '所有项目共用,推荐' },
      { value: 'project', label: '项目级 (./.claude/skills/)', hint: '仅当前项目' },
      { value: 'skip', label: '跳过 skill 安装', hint: '后续手动复制' },
    ]);
    if (installLoc === 'skip') {
      log.dim('已跳过 skill 安装');
    } else {
      const skillsDst = installLoc === 'user'
        ? join(homedir(), '.claude', 'skills')
        : join(CWD, '.claude', 'skills');
      const tplSkills = join(TEMPLATE_ROOT, '.claude', 'skills');
      const skillNames = readdirSync(tplSkills).filter(n => statSync(join(tplSkills, n)).isDirectory());
      mkdirSync(skillsDst, { recursive: true });
      let installed = 0, conflicted = 0;
      for (const name of skillNames) {
        const dst = join(skillsDst, name);
        if (existsSync(dst)) {
          log.warn(`已存在,跳过: ${name}`);
          conflicted++;
          continue;
        }
        const r = copyDirRecursive(join(tplSkills, name), dst);
        installed++;
      }
      log.ok(`Skill 安装完成: ${installed} 个新增, ${conflicted} 个冲突跳过 → ${skillsDst}`);
    }

    // ====== Done ======
    console.log('');
    console.log(`${C.green}${C.bold}✓ 接入完成${C.reset}`);
    console.log('');
    console.log(`${C.bold}下一步:${C.reset}`);
    console.log(`  1. 打开 ${C.cyan}CLAUDE.md${C.reset}, 填写第 0 节(技术栈 / 迁移目录 / 运行方式)`);
    console.log(`  2. 浏览 ${C.cyan}docs/00_通用规范/${C.reset}, 按本项目实际改/补示例`);
    console.log(`  3. 提交到版本库, 规范从此成为项目契约`);
    console.log('');
    console.log(`${C.dim}详细索引: docs/索引.md${C.reset}`);
    console.log('');
  } finally {
    rl.close();
  }
}

main().catch((e) => {
  log.err(e?.message || String(e));
  process.exit(1);
});
