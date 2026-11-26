/**
 * The simulator run is split in two halves per device (the full check before 10.0: 40 flows took
 * 242 of the iPad's 275 minutes). scripts/flow-parts.mjs prints the flows of one half; every flow
 * must run in exactly one half, and the halves must be close in size.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- Node's own modules, as in keyboard-fields.test.ts */
const { execFileSync } = require('node:child_process') as {
  execFileSync: (cmd: string, args: string[], opts: object) => string;
};
const fs = require('node:fs') as {
  readdirSync: (p: string) => string[];
  readFileSync: (p: string, enc: 'utf8') => string;
};
/* eslint-enable @typescript-eslint/no-require-imports */
const { readdirSync, readFileSync } = fs;

const part = (n: number) =>
  execFileSync('node', ['scripts/flow-parts.mjs', String(n), '2'], { encoding: 'utf8' })
    .trim()
    .split(/\s+/)
    .filter(Boolean);

const flows = readdirSync('e2e')
  .filter((f) => f.endsWith('.yaml') && f !== 'config.yaml')
  .map((f) => `e2e/${f}`);
const lines = (f: string) => readFileSync(f, 'utf8').split('\n').length;

it('runs every flow once, in one of the two halves', () => {
  const [a, b] = [part(1), part(2)];
  expect([...a, ...b].sort()).toEqual([...flows].sort());
  expect(a.filter((f) => b.includes(f))).toEqual([]);
});

it('leaves out the shared steps and the config', () => {
  const all = [...part(1), ...part(2)];
  expect(all.some((f) => f.includes('subflows') || f.endsWith('config.yaml'))).toBe(false);
});

it('gives the halves about the same amount of steps', () => {
  const size = (fs: string[]) => fs.reduce((s, f) => s + lines(f), 0);
  const [a, b] = [size(part(1)), size(part(2))];
  expect(Math.abs(a - b)).toBeLessThanOrEqual(Math.max(...flows.map(lines)));
  expect(part(1).length).toBeGreaterThan(0);
  expect(part(2).length).toBeGreaterThan(0);
});

it('refuses a part that does not exist', () => {
  expect(() =>
    execFileSync('node', ['scripts/flow-parts.mjs', '3', '2'], { stdio: 'pipe' }),
  ).toThrow();
});
