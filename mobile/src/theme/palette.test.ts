import { palettes, resolveTheme, type Mode, type SystemId } from '.';

/** WCAG relative luminance of a #RRGGBB colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const cases: [SystemId, Mode][] = [
  ['jewelry', 'light'],
  ['jewelry', 'dark'],
  ['scarves', 'light'],
  ['scarves', 'dark'],
];

describe.each(cases)('%s %s palette', (system, mode) => {
  const p = palettes[system][mode];

  it('has readable body text on backgrounds and cards (4.5:1)', () => {
    expect(contrast(p.text, p.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.text, p.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('has readable secondary text on cards, the page and soft accent fills (4.5:1)', () => {
    expect(contrast(p.textSecondary, p.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.textSecondary, p.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.textSecondary, p.accentSoft)).toBeGreaterThanOrEqual(4.5);
  });

  it('has readable text on the accent hero card (4.5:1)', () => {
    expect(contrast(p.onAccent, p.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it('has a readable accent on cards and soft accent fills (4.5:1)', () => {
    expect(contrast(p.accent, p.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.accent, p.accentSoft)).toBeGreaterThanOrEqual(4.5);
  });

  it('has readable warnings on cards, the page and soft accent fills (4.5:1)', () => {
    expect(contrast(p.warning, p.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.warning, p.background)).toBeGreaterThanOrEqual(4.5);
    // The stock pill: "منخفض" / "نفد" on the soft accent fill.
    expect(contrast(p.warning, p.accentSoft)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('resolveTheme', () => {
  it('picks the system palette', () => {
    expect(resolveTheme('scarves', 'dark').colors).toBe(palettes.scarves.dark);
  });

  it('uses the neutral palette before a system is chosen', () => {
    expect(resolveTheme(null, 'light').colors.background).toBe('#F2F2F5');
  });
});
