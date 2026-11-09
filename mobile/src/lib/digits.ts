/**
 * The app only ever shows and stores the digits 0-9.
 *
 * If the device's region uses Arabic digits, its number pad types ٠١٢… — they are converted to
 * 0-9 as they are typed, so they never reach the screen or the database. A decimal comma
 * ("," or the Arabic "٫") becomes ".". Anything else is dropped.
 */

export type NumberKind = 'decimal' | 'integer' | 'phone';

const ARABIC_INDIC_ZERO = 0x0660; // ٠
const PERSIAN_ZERO = 0x06f0; // ۰

/** Converts Arabic-Indic (٠-٩) and Persian (۰-۹) digits to 0-9; leaves every other character as is. */
export function latinDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code >= ARABIC_INDIC_ZERO && code <= ARABIC_INDIC_ZERO + 9) {
      out += String.fromCharCode(48 + code - ARABIC_INDIC_ZERO);
    } else if (code >= PERSIAN_ZERO && code <= PERSIAN_ZERO + 9) {
      out += String.fromCharCode(48 + code - PERSIAN_ZERO);
    } else {
      out += ch;
    }
  }
  return out;
}

const isDigit = (ch: string) => ch >= '0' && ch <= '9';

/** Cleans what the user typed into a number field of the given kind. */
export function sanitize(input: string, kind: NumberKind): string {
  const latin = latinDigits(input);
  switch (kind) {
    case 'integer':
      return [...latin].filter(isDigit).join('');
    case 'phone': {
      const digits = [...latin].filter(isDigit).join('');
      return latin.trimStart().startsWith('+') ? `+${digits}` : digits;
    }
    case 'decimal': {
      let result = '';
      let hasPoint = false;
      for (const ch of latin) {
        if (isDigit(ch)) {
          result += ch;
        } else if ((ch === '.' || ch === ',' || ch === '٫') && !hasPoint) {
          hasPoint = true;
          result += result === '' ? '0.' : '.';
        }
        // Thousands separators ("٬"), spaces and any other characters are dropped.
      }
      return result;
    }
  }
}

/**
 * Parses a typed decimal into a whole number of thousandths (dirhams for LYD, thousandths for an
 * exchange rate), without going through floating point. Extra decimals round half up.
 * Returns null when nothing was typed.
 *
 * "1250" → 1250000, "12.5" → 12500, "7.1255" → 7126, "٣٫٥" → 3500
 */
export function parseThousandths(input: string): number | null {
  return parseScaled(input, 3);
}

/** Like parseThousandths but in hundredths (US cents): "12.5" → 1250. */
export function parseHundredths(input: string): number | null {
  return parseScaled(input, 2);
}

function parseScaled(input: string, decimals: number): number | null {
  const clean = sanitize(input, 'decimal');
  if (clean === '' || clean === '0.') return null;
  const [whole, frac = ''] = clean.split('.');
  const kept = (frac + '0'.repeat(decimals)).slice(0, decimals);
  const roundUp = frac.length > decimals && frac.charCodeAt(decimals) >= 53; // next digit ≥ 5
  const value = Number(whole || '0') * 10 ** decimals + Number(kept) + (roundUp ? 1 : 0);
  return Number.isSafeInteger(value) ? value : null;
}

/** Parses a typed whole number (quantities, stock). Returns null when nothing was typed. */
export function parseInteger(input: string): number | null {
  const clean = sanitize(input, 'integer');
  if (clean === '') return null;
  const value = Number(clean);
  return Number.isSafeInteger(value) ? value : null;
}
