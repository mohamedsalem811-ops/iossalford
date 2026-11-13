/** Tests only: files outside the business rules that call any of the given functions. */
/* eslint-disable @typescript-eslint/no-require-imports -- Node-only modules, loaded in tests */
const fs = require('node:fs') as {
  readFileSync(path: string, encoding: 'utf8'): string;
  readdirSync(path: string): string[];
  readdirSync(path: string, o: { withFileTypes: true }): { name: string; isDirectory(): boolean }[];
};
const path = require('node:path') as {
  resolve(...p: string[]): string;
  join(...p: string[]): string;
  relative(from: string, to: string): string;
  sep: string;
};
/* eslint-enable @typescript-eslint/no-require-imports */
declare const __dirname: string;

const SRC = path.resolve(__dirname, '../..');
const RULES = ['domain', 'backup', 'testing', 'db'];

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

export function screenFilesCalling(names: string[]): string[] {
  const files = walk(SRC).filter((f) => !RULES.includes(path.relative(SRC, f).split(path.sep)[0]));
  const found: string[] = [];
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    for (const n of names)
      if (new RegExp(`\\b${n}\\(`).test(text)) found.push(`${path.relative(SRC, f)}: ${n}`);
  }
  return found;
}
