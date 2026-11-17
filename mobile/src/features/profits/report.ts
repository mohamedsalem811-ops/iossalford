/**
 * The profit report (J4) as lines for the screen and as a printable A4 page (Arabic, right to
 * left): the period, what was opened (a brand, then a category), each row and the total.
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

import type { ProfitRow, profitTotals } from '@/domain/profits';
import { formatLyd } from '@/lib/money';

type Totals = ReturnType<typeof profitTotals>;

const esc = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** "مبيعات 2,500 د.ل • 3 قطع • التكلفة 1,100 د.ل" (with the refunds when there were some). */
export function rowLine(r: Pick<ProfitRow, 'netSales' | 'refunds' | 'pieces' | 'cost'>): string {
  return [
    `مبيعات ${formatLyd(r.netSales)}`,
    r.refunds > 0 ? `بعد مرتجعات ${formatLyd(r.refunds)}` : null,
    `${r.pieces} قطعة`,
    `التكلفة ${formatLyd(r.cost)}`,
  ]
    .filter(Boolean)
    .join(' • ');
}

/** "الربح 1,400 د.ل • 56٪" */
export const profitLine = (r: Pick<ProfitRow, 'profit' | 'margin'>) =>
  `${formatLyd(r.profit)} • ${r.margin}٪`;

/** The level being shown: الماركات، or «لازوردي» ← الفئات، or «لازوردي» ← «خواتم» ← القطع. */
export function levelTitle(
  open: { brand?: string; category?: string },
  labels: {
    brand?: string;
    category?: string;
  },
): string {
  if (open.brand === undefined) return 'حسب الماركة';
  if (open.category === undefined) return `«${labels.brand}» حسب الفئة`;
  return `«${labels.brand}» ← «${labels.category}» حسب القطعة`;
}

export function profitsHtml(input: {
  shop: string;
  period: string;
  level: string;
  rows: ProfitRow[];
  totals: Totals;
}): string {
  const cell = (t: string, cls = '') => `<td${cls ? ` class="${cls}"` : ''}>${esc(t)}</td>`;
  const line = (label: string, r: Omit<ProfitRow, 'key' | 'label'> | Totals, cls = '') =>
    `<tr${cls ? ` class="${cls}"` : ''}>${cell(label)}${cell(formatLyd(r.netSales), 'v')}${cell(String(r.pieces), 'v')}${cell(formatLyd(r.cost), 'v')}${cell(formatLyd(r.profit), 'v')}${cell(`${r.margin}٪`, 'v')}</tr>`;
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<style>
  body { font-family: -apple-system, 'Geeza Pro', sans-serif; margin: 32px; color: #111; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #555; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: right; font-size: 12px; color: #555; border-bottom: 2px solid #999; padding: 6px 4px; }
  td { padding: 7px 4px; border-bottom: 1px solid #ddd; font-size: 13px; }
  td.v { text-align: left; direction: rtl; unicode-bidi: plaintext; }
  tr.total td { font-weight: 700; border-top: 2px solid #999; }
  .note { color: #777; font-size: 11px; margin-top: 12px; }
</style></head><body>
<h1>${esc(input.shop)}: الأرباح</h1>
<div class="sub">${esc(input.period)} • ${esc(input.level)}</div>
<table>
<tr><th></th><th>صافي المبيعات</th><th>القطع</th><th>التكلفة</th><th>الربح</th><th>الهامش</th></tr>
${input.rows.map((r) => line(r.label, r)).join('\n')}
${line('المجموع', input.totals, 'total')}
</table>
<div class="note">بعد المرتجعات، من سعر وتكلفة كل بيعة يوم البيع. لا يشمل المصروفات ولا دخل الصيانة.</div>
</body></html>`;
}

/** The AirPrint window, or the share sheet with the PDF. */
export async function printProfits(
  input: Parameters<typeof profitsHtml>[0] & { fileKey: string },
  mode: 'print' | 'share',
) {
  const html = profitsHtml(input);
  if (mode === 'print') {
    try {
      await Print.printAsync({ html });
    } catch {
      // Closing the print window is not an error.
    }
    return;
  }
  const out = await Print.printToFileAsync({ html });
  const file = new File(Paths.cache, `SALFORD-Profits-${input.fileKey}.pdf`);
  if (file.exists) file.delete();
  await new File(out.uri).move(file);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: `الأرباح ${input.period}`,
  });
}
