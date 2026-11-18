/* eslint-disable @typescript-eslint/no-require-imports -- Node-only modules, loaded in tests */
const fs = require('node:fs') as {
  readFileSync(path: string, encoding: 'utf8'): string;
  readdirSync(path: string, o: { withFileTypes: true }): { name: string; isDirectory(): boolean }[];
};
const path = require('node:path') as {
  resolve(...p: string[]): string;
  join(...p: string[]): string;
  relative(from: string, to: string): string;
};
/* eslint-enable @typescript-eslint/no-require-imports */
declare const __dirname: string;

const SRC = path.resolve(__dirname, '..');

/**
 * Files with a typing field that are not whole screens, or whose only field sits at the top of
 * the page where the keyboard can never reach it.
 */
const NOT_A_SCREEN = [
  'features/customers/details-fields.tsx',
  'features/products/brand-field.tsx',
  'features/sale/checkout-extras.tsx',
  'screens/gallery.tsx',
  // The search field is the first thing on the page.
  'app/[system]/(tabs)/more/stock-count.tsx',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.tsx') && !e.name.includes('.test.')) out.push(p);
  }
  return out;
}

describe('typing fields stay above the keyboard', () => {
  it('every screen with a typing field scrolls the field clear of the keyboard', () => {
    const uncovered: string[] = [];
    for (const dir of ['app', 'screens', 'features'])
      for (const f of walk(path.join(SRC, dir))) {
        const rel = path.relative(SRC, f);
        if (NOT_A_SCREEN.includes(rel)) continue;
        const text = fs.readFileSync(f, 'utf8');
        if (!/<(TextField|NumberField|TextInput)\b/.test(text)) continue;
        if (/KeyboardAware|<Page\s+keyboard|<Screen\s+keyboard|FormHeader/.test(text)) continue;
        uncovered.push(rel);
      }
    expect(uncovered).toEqual([]);
  });

  it('the sign-in screen keeps every page that has a field keyboard-aware', () => {
    const text = fs.readFileSync(path.join(SRC, 'screens/sign-in.tsx'), 'utf8');
    // Each <Screen ...> block that contains a TextField before the next <Screen must be keyboard-aware.
    const blocks = text.split(/(?=<Screen\b)/).slice(1);
    const bad = blocks.filter((b) => /<TextField\b/.test(b) && !/^<Screen\s+keyboard/.test(b));
    expect(bad.length).toBe(0);
  });
});
