// PostToolUse hook (Write|Edit): runs Prettier and ESLint on the touched file.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}
const raw = input.tool_response?.filePath ?? input.tool_input?.file_path;
if (!raw) process.exit(0);
const file = path.resolve(raw);
const rel = path.relative(root, file);
const skipped = /(^|[\\/])(node_modules|\.next|out|build)[\\/]/.test(rel);
if (
  rel.startsWith('..') ||
  path.isAbsolute(rel) ||
  skipped ||
  !existsSync(file)
) {
  process.exit(0);
}
const run = (bin, args) =>
  spawnSync(process.execPath, [path.join(root, 'node_modules', bin), ...args], {
    cwd: root,
    encoding: 'utf8',
  });
const isCode = /\.(jsx?|tsx?|mjs|cjs|css)$/.test(file);
// Drop blank lines in code files (not Markdown, where they separate blocks).
// Lines inside template literals are kept, tracked by backtick parity.
if (isCode) {
  let inTemplate = false;
  const compact = readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => {
      const keep = inTemplate || line.trim() !== '';
      const ticks = (line.replace(/\\./g, '').match(/`/g) ?? []).length;
      if (ticks % 2 === 1) inTemplate = !inTemplate;
      return keep;
    })
    .join('\n');
  writeFileSync(file, compact.endsWith('\n') ? compact : `${compact}\n`);
}

const prettier = run('prettier/bin/prettier.cjs', [
  '--write',
  '--ignore-unknown',
  file,
]);
if (prettier.status !== 0) {
  console.error(
    `Prettier failed on ${rel}:\n${prettier.stderr || prettier.stdout}`,
  );
}

if (/\.(jsx?|tsx?|mjs|cjs)$/.test(file)) {
  const eslint = run('eslint/bin/eslint.js', ['--fix', file]);
  if (eslint.status !== 0) {
    console.error(
      `ESLint errors in ${rel} (fix them):\n${eslint.stdout}${eslint.stderr}`,
    );
    process.exit(2);
  }
}
