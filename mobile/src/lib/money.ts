/**
 * Money is always a whole number:
 * - Libyan dinar amounts in dirhams (1 LYD = 1000 dirhams);
 * - US dollar amounts in cents (1 USD = 100 cents);
 * - exchange rates in thousandths of a dinar per dollar (7.125 LYD/USD = 7125).
 *
 * Whole numbers add and subtract exactly, so totals never drift by a dirham. Rounding only
 * happens at the few places where a value is multiplied or divided, and always half away from
 * zero (refunds round the same way as sales).
 */

export type Dirhams = number;
export type Cents = number;
export type RateMilli = number;

export const DIRHAMS_PER_DINAR = 1000;

/** Divides two integers and rounds half away from zero. */
export function divRound(numerator: number, denominator: number): number {
  if (denominator === 0) throw new RangeError('Division by zero');
  const sign = Math.sign(numerator) * Math.sign(denominator);
  const n = Math.abs(numerator);
  const d = Math.abs(denominator);
  const q = Math.floor(n / d);
  const r = n - q * d;
  return sign * (r * 2 >= d ? q + 1 : q);
}

/** USD cents × rate → LYD dirhams. 10.00 USD at 7.125 = 71.250 LYD. */
export function usdToLyd(cents: Cents, rate: RateMilli): Dirhams {
  // cents/100 × rate/1000 dinars = cents × rate / 100 000 dinars = cents × rate / 100 dirhams
  return divRound(cents * rate, 100);
}

/** LYD dirhams ÷ rate → USD cents. 71.250 LYD at 7.125 = 10.00 USD. */
export function lydToUsd(dirhams: Dirhams, rate: RateMilli): Cents {
  if (rate <= 0) return 0;
  return divRound(dirhams * 100, rate);
}

/** Unit price × quantity. */
export function lineTotal(unit: Dirhams, quantity: number): Dirhams {
  return unit * quantity;
}

/** A percentage of an amount, rounded to the dirham. percent may have decimals (12.5). */
export function percentOf(amount: Dirhams, percent: number): Dirhams {
  // Work in hundredths of a percent to keep integers.
  return divRound(amount * Math.round(percent * 100), 10_000);
}

/**
 * Splits `total` into parts proportional to `weights` so that the parts add up to exactly
 * `total`. Each part is rounded down first, then the dirhams left over go one by one to the
 * parts with the largest remainders (ties go to the earliest part).
 *
 * Used to spread a set discount over its pieces: split(-30000, [100000, 50000]) → [-20000, -10000].
 */
export function split(total: Dirhams, weights: number[]): Dirhams[] {
  if (weights.length === 0) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map((_, i) => (i === weights.length - 1 ? total : 0));

  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  const raw = weights.map((w) => (abs * w) / sum);
  const parts = raw.map(Math.floor);
  let left = abs - parts.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, rem: r - Math.floor(r) }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) parts[order[k].i] += 1;
  return parts.map((p) => (p === 0 ? 0 : p * sign));
}

/** Adds thousands separators to a string of digits. */
function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * "1,250", "12.5", "1,083.333": dinars with dirhams shown only when there are any.
 * Digits are always 0-9.
 */
export function formatDinars(dirhams: Dirhams): string {
  const sign = dirhams < 0 ? '-' : '';
  const abs = Math.abs(Math.round(dirhams));
  const whole = Math.floor(abs / DIRHAMS_PER_DINAR);
  const frac = abs % DIRHAMS_PER_DINAR;
  const fracText = frac === 0 ? '' : '.' + String(frac).padStart(3, '0').replace(/0+$/, '');
  return sign + group(String(whole)) + fracText;
}

/** "1,250 د.ل" */
export function formatLyd(dirhams: Dirhams): string {
  return `${formatDinars(dirhams)} د.ل`;
}

/** "$12.50", "-$3.00" */
export function formatUsd(cents: Cents): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  return `${sign}$${group(String(Math.floor(abs / 100)))}.${String(abs % 100).padStart(2, '0')}`;
}

/** "7.125": an exchange rate for display or an edit field. */
export function formatRate(rate: RateMilli): string {
  return formatDinars(rate).replace(/,/g, '');
}

/** Dirhams as text for an editable field: no separators, dirhams only when present ("1250.5"). */
export function editableDinars(dirhams: Dirhams): string {
  return formatDinars(dirhams).replace(/,/g, '');
}

/** Cents as text for an editable field ("12.5", "12"). */
export function editableUsd(cents: Cents): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const frac = abs % 100;
  return (
    sign +
    String(Math.floor(abs / 100)) +
    (frac === 0 ? '' : '.' + String(frac).padStart(2, '0').replace(/0$/, ''))
  );
}
