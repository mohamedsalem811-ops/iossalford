import { brandBadge } from '@/theme';

export type BrandLook =
  | { kind: 'builtIn'; background: string; text: string; label: string; serif: boolean }
  | { kind: 'initials'; background: string; text: string; label: string };

/** "Van Cleef" → "VC", "pandora" → "P", "لازوردي" → "ل". */
export function brandInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => [...word][0] ?? '')
    .join('')
    .toUpperCase();
}

/** The badge for a brand without its own photo: a built-in look, or initials in a stable colour. */
export function brandLook(name: string): BrandLook {
  const lower = name.toLowerCase();
  const builtIn = brandBadge.builtIn.find((b) => lower.includes(b.match));
  if (builtIn) {
    return {
      kind: 'builtIn',
      background: builtIn.background,
      text: builtIn.text,
      label: builtIn.label,
      serif: builtIn.serif,
    };
  }
  const sum = [...name].reduce((total, ch) => total + (ch.codePointAt(0) ?? 0), 0);
  return {
    kind: 'initials',
    background: brandBadge.initials[sum % brandBadge.initials.length],
    text: brandBadge.initialsText,
    label: brandInitials(name),
  };
}
