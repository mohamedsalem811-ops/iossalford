/**
 * The end-of-day summary as rows for the screen and as a printable A4 page (Arabic, right to
 * left): the day's figures, sales per person, and each shift with its count.
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

import { PAYMENT_LABELS, PAYMENT_METHODS } from '@/domain/checkout';
import type { DayShift, DaySummary } from '@/domain/day-summary';
import { differenceText } from '@/domain/shifts';
import { formatDay, formatTime } from '@/lib/dates';
import { formatLyd } from '@/lib/money';

export type Row = { label: string; value: string };
export type Section = { title: string; rows: Row[] };

const esc = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** "الجمعة 13 نوفمبر 2026" for "2026-11-13". */
export function dayTitle(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return formatDay(new Date(y, m - 1, d), true);
}

const time = (stamp: string) => formatTime(new Date(stamp));

/** "سارة • 09:00 ← 18:00" (or "مفتوحة"), and the count: what the shift's line shows. */
export function shiftLine(s: DayShift): Row {
  const { shift, totals } = s;
  const hours = shift.closedAt
    ? `${time(shift.openedAt)} ← ${time(shift.closedAt)}`
    : `منذ ${time(shift.openedAt)} • مفتوحة`;
  const value =
    shift.countedCash !== null
      ? `المتوقع ${formatLyd(shift.expectedCash ?? totals.expected)} • المعدود ${formatLyd(shift.countedCash)} • ${differenceText(shift.difference ?? 0)}`
      : `المتوقع الآن ${formatLyd(totals.expected)}`;
  return { label: `${shift.personName} • ${hours}`, value };
}

/** The summary in sections, shared by the screen and the PDF. Empty lines are left out. */
export function daySections(d: DaySummary): Section[] {
  const some = (rows: (Row | false)[]) => rows.filter((r): r is Row => r !== false);
  return [
    {
      title: 'المبيعات',
      rows: [
        { label: 'المجموع', value: formatLyd(d.total) },
        { label: 'عدد المبيعات', value: `${d.sales} • ${d.pieces} قطعة` },
        ...PAYMENT_METHODS.map((m) => ({
          label: PAYMENT_LABELS[m],
          value: formatLyd(d.byMethod[m]),
        })),
        ...some([
          d.points.paid > 0 && { label: 'مدفوع بالنقاط', value: formatLyd(d.points.paid) },
          d.discounts > 0 && { label: 'الخصومات', value: formatLyd(d.discounts) },
          d.approvals > 0 && { label: 'موافقات المالك', value: String(d.approvals) },
        ]),
      ],
    },
    ...(d.bySeller.length > 1
      ? [
          {
            title: 'حسب البائع',
            rows: d.bySeller.map((s) => ({
              label: `${s.name} • ${s.sales} بيعة`,
              value: formatLyd(s.total),
            })),
          },
        ]
      : []),
    {
      title: 'النقد',
      rows: some([
        { label: 'مبيعات نقداً', value: formatLyd(d.byMethod.cash) },
        d.payments.cash > 0 && { label: 'دفعات ديون نقداً', value: formatLyd(d.payments.cash) },
        d.cashRefunds > 0 && { label: 'مرتجعات نقداً', value: `−${formatLyd(d.cashRefunds)}` },
        d.payouts.cash > 0 && {
          label: 'رد أرصدة زبائن نقداً',
          value: `−${formatLyd(d.payouts.cash)}`,
        },
        d.cashIn > 0 && { label: 'إدخال نقد', value: formatLyd(d.cashIn) },
        d.cashOut > 0 && { label: 'إخراج نقد', value: `−${formatLyd(d.cashOut)}` },
        { label: 'صافي النقد لليوم', value: formatLyd(d.cashNet) },
        d.shortages > 0 && { label: 'عجز في العدّ', value: `−${formatLyd(d.shortages)}` },
        d.extras > 0 && { label: 'زيادة في العدّ', value: `+${formatLyd(d.extras)}` },
      ]),
    },
    {
      title: 'أخرى',
      rows: [
        { label: 'المرتجعات', value: `${d.returns} • ${formatLyd(d.refunded)}` },
        ...some([
          d.payments.other > 0 && {
            label: 'دفعات ديون ببطاقة أو تحويل',
            value: formatLyd(d.payments.other),
          },
          d.payouts.other > 0 && {
            label: 'رد أرصدة ببطاقة أو تحويل',
            value: formatLyd(d.payouts.other),
          },
        ]),
        { label: 'المصروفات', value: formatLyd(d.expenses) },
        ...some([
          (d.points.earned > 0 || d.points.redeemed > 0) && {
            label: 'نقاط الولاء',
            value: `اكتُسبت ${d.points.earned} • استُخدمت ${d.points.redeemed}`,
          },
        ]),
      ],
    },
  ];
}

export function daySummaryHtml(d: DaySummary, shop: string): string {
  const table = (rows: Row[]) =>
    `<table>${rows
      .map((r) => `<tr><td>${esc(r.label)}</td><td class="v">${esc(r.value)}</td></tr>`)
      .join('')}</table>`;
  const sections = daySections(d)
    .map((s) => `<h2>${esc(s.title)}</h2>${table(s.rows)}`)
    .join('');
  const shifts = d.shifts.length
    ? `<h2>الورديات</h2>${table(d.shifts.map(shiftLine))}`
    : '<h2>الورديات</h2><div class="sub">لا ورديات في هذا اليوم.</div>';
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<style>
  body { font-family: -apple-system, 'Geeza Pro', sans-serif; margin: 32px; color: #111; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #555; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  td { padding: 7px 4px; border-bottom: 1px solid #ddd; font-size: 14px; }
  td.v { text-align: left; direction: rtl; unicode-bidi: plaintext; font-weight: 600; }
  h2 { font-size: 16px; margin: 18px 0 4px; }
</style></head><body>
<h1>${esc(shop)}: ملخص اليوم</h1>
<div class="sub">${esc(dayTitle(d.day))}</div>
${sections}
${shifts}
</body></html>`;
}

/** The AirPrint window, or the share sheet with the PDF. */
export async function printDaySummary(d: DaySummary, shop: string, mode: 'print' | 'share') {
  const html = daySummaryHtml(d, shop);
  if (mode === 'print') {
    try {
      await Print.printAsync({ html });
    } catch {
      // Closing the print window is not an error.
    }
    return;
  }
  const out = await Print.printToFileAsync({ html });
  const file = new File(Paths.cache, `SALFORD-Day-${d.day}.pdf`);
  if (file.exists) file.delete();
  await new File(out.uri).move(file);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: `ملخص يوم ${d.day}`,
  });
}
