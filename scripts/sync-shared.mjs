/**
 * Copies the dependency-free logic shared with the desktop app (../KomaYomi) and the
 * static web edition (../online) into `src/shared`, so all three editions read and write
 * the same project format. The files are copied verbatim on purpose: no local edits, so
 * `git diff src/shared` shows exactly what changed upstream.
 *
 * Usage: node scripts/sync-shared.mjs [path-to-KomaYomi-checkout]
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = resolve(process.argv[2] ?? join(root, '..', 'KomaYomi', 'shared'));
const targetRoot = join(root, 'src', 'shared');

const FILES = ['types.ts', 'format.ts', 'migrations.ts', 'markdown.ts', 'panelOrder.ts'];

if (!existsSync(sourceRoot)) {
  console.error(`Shared source not found: ${sourceRoot}`);
  process.exit(1);
}

mkdirSync(targetRoot, { recursive: true });

const checksums = {};
for (const name of FILES) {
  const from = join(sourceRoot, name);
  if (!existsSync(from)) {
    console.error(`Missing shared file: ${from}`);
    process.exit(1);
  }
  copyFileSync(from, join(targetRoot, name));
  const text = readFileSync(from, 'utf8');
  checksums[name] = `${text.length} chars`;
  console.log(`copied ${name} (${checksums[name]})`);
}

writeFileSync(
  join(targetRoot, 'SOURCE.json'),
  `${JSON.stringify({ syncedFrom: sourceRoot, files: FILES, checksums }, null, 2)}\n`,
  'utf8',
);
console.log(`Done. Shared logic synced from ${sourceRoot}`);
