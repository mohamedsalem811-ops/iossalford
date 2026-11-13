/**
 * The shift report as a printable page (phase S5): who, when, the sales by payment method,
 * returns, discounts and approvals, the cash moves, and the count. Arabic, right to left, A4.
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

import { PAYMENT_LABELS, PAYMENT_METHODS } from '@/domain/checkout';
import { differenceText, type CashMove, type Shift, type ShiftTotals } from '@/domain/shifts';
import { formatDate, formatTime } from '@/lib/dates';
import { formatLyd } from '@/lib/money';

const esc = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const when = (stamp: string) => `${formatDate(new Date(stamp))} ${formatTime(new Date(stamp))}`;

export type ShiftReport = { shift: Shift; totals: ShiftTotals; moves: CashMove[]; shop: string };

/** The rows of the report, shared by the screen and the PDF. */
export function reportRows(r: ShiftReport): { label: string; value: string }[] {
  const { shift, totals } = r;
  return [
    ...PAYMENT_METHODS.map((m) => ({
      label: `مبيعات ${PAYMENT_LABELS[m]}`,
      value: formatLyd(totals.byMethod[m]),
    })),
    { label: 'عدد المبيعات', value: String(totals.sales) },
    { label: 'المرتجعات', value: `${totals.returns} • ${formatLyd(totals.refunded)}` },
    { label: 'منها نقداً', value: formatLyd(totals.cashRefunds) },
    { label: 'دفعات ديون نقداً', value: formatLyd(totals.cashPayments) },
    { label: 'الخصومات', value: formatLyd(totals.discounts) },
    { label: 'موافقات المالك', value: String(totals.approvals) },
    { label: 'نقد البداية', value: formatLyd(shift.openingCash) },
    { label: 'إدخال نقد', value: formatLyd(totals.cashIn) },
    { label: 'إخراج نقد', value: formatLyd(totals.cashOut) },
    {
      label: 'المتوقع في الدرج',
      value: formatLyd(shift.expectedCash ?? totals.expected),
    },
    ...(shift.countedCash !== null
      ? [
          { label: 'المعدود', value: formatLyd(shift.countedCash) },
          { label: 'الفرق', value: differenceText(shift.difference ?? 0) },
        ]
      : []),
  ];
}

export function shiftReportHtml(r: ShiftReport): string {
  const { shift, moves } = r;
  const rows = reportRows(r)
    .map((x) => `<tr><td>${esc(x.label)}</td><td class="v">${esc(x.value)}</td></tr>`)
    .join('');
  const moveRows = moves
    .map(
      (m) =>
        `<tr><td>${esc(m.kind === 'in' ? 'إدخال' : 'إخراج')}: ${esc(m.reason)}</td><td class="v">${esc(formatLyd(m.amount))}</td></tr>`,
    )
    .join('');
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<style>
  body { font-family: -apple-system, 'Geeza Pro', sans-serif; margin: 32px; color: #111; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #555; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  td { padding: 8px 4px; border-bottom: 1px solid #ddd; font-size: 15px; }
  td.v { text-align: left; direction: ltr; unicode-bidi: plaintext; font-weight: 600; }
  h2 { font-size: 17px; margin: 16px 0 6px; }
</style></head><body>
<h1>${esc(r.shop)}: تقرير الوردية رقم ${shift.id}</h1>
<div class="sub">${esc(shift.personName)} • من ${esc(when(shift.openedAt))}${
    shift.closedAt ? ` إلى ${esc(when(shift.closedAt))}` : ' • مفتوحة'
  }</div>
<table>${rows}</table>
${moves.length ? `<h2>حركات النقد</h2><table>${moveRows}</table>` : ''}
${shift.note ? `<div class="sub">ملاحظة: ${esc(shift.note)}</div>` : ''}
</body></html>`;
}

/** The AirPrint window, or the share sheet with the PDF. */
export async function printShiftReport(r: ShiftReport, mode: 'print' | 'share') {
  const html = shiftReportHtml(r);
  if (mode === 'print') {
    try {
      await Print.printAsync({ html });
    } catch {
      // Closing the print window is not an error.
    }
    return;
  }
  const out = await Print.printToFileAsync({ html });
  const file = new File(Paths.cache, `SALFORD-Shift-${r.shift.id}.pdf`);
  if (file.exists) file.delete();
  await new File(out.uri).move(file);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: `تقرير الوردية ${r.shift.id}`,
  });
}
