/**
 * The owner's monthly staff report (phase L3) as rows for the screen and as a printable A4 page
 * (Arabic, right to left): each person's sales, pieces, average sale, returns, discounts, new
 * customers, % of the target and bonus on slow pieces.
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

import type { StaffReport, StaffReportRow } from '@/domain/staff-goals';
import { monthTitle } from '@/lib/dates';
import { formatLyd } from '@/lib/money';

export type Row = { label: string; value: string };

const esc = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The bonus line: earned less returned, and whether it is in the account yet. */
export function bonusText(r: StaffReportRow, ended: boolean): string {
  const amount = r.bonus < 0 ? `−${formatLyd(-r.bonus)}` : formatLyd(r.bonus);
  if (!r.bonus) return formatLyd(0);
  if (r.credited) return `${amount} • في الحساب`;
  return ended ? `${amount} • لم تُضف بعد` : `${amount} • حتى الآن`;
}

/** One person's lines, shared by the screen and the PDF. */
export function personRows(r: StaffReportRow, target: number, ended: boolean): Row[] {
  return [
    { label: 'صافي المبيعات', value: formatLyd(r.net) },
    ...(target > 0 ? [{ label: 'من الهدف', value: `${r.percent}%` }] : []),
    { label: 'المبيعات', value: `${r.sales} بيعة • ${r.pieces} قطعة • ${formatLyd(r.total)}` },
    { label: 'متوسط البيعة', value: formatLyd(r.average) },
    { label: 'المرتجعات', value: `${r.returns} • ${formatLyd(r.refunds)}` },
    { label: 'الخصومات', value: formatLyd(r.discounts) },
    { label: 'زبائن جدد', value: String(r.newCustomers) },
    { label: 'مكافأة القطع الراكدة', value: bonusText(r, ended) },
  ];
}

export const personTitle = (r: StaffReportRow, place: number) =>
  `${place}. ${r.name}${r.best ? ' • الأفضل هذا الشهر' : ''}`;

export function staffReportHtml(report: StaffReport, shop: string): string {
  const table = (rows: Row[]) =>
    `<table>${rows
      .map((r) => `<tr><td>${esc(r.label)}</td><td class="v">${esc(r.value)}</td></tr>`)
      .join('')}</table>`;
  const people = report.rows.length
    ? report.rows
        .map(
          (r, i) =>
            `<h2>${esc(personTitle(r, i + 1))}</h2>${table(personRows(r, report.target, report.ended))}`,
        )
        .join('')
    : '<div class="sub">لا يوجد موظفون.</div>';
  const target = report.target
    ? `الهدف لكل موظف ${formatLyd(report.target)}`
    : 'بدون هدف لهذا الشهر';
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
<h1>${esc(shop)}: تقرير الموظفين</h1>
<div class="sub">${esc(monthTitle(report.month))} • ${esc(target)}</div>
${people}
</body></html>`;
}

/** The AirPrint window, or the share sheet with the PDF. */
export async function printStaffReport(report: StaffReport, shop: string, mode: 'print' | 'share') {
  const html = staffReportHtml(report, shop);
  if (mode === 'print') {
    try {
      await Print.printAsync({ html });
    } catch {
      // Closing the print window is not an error.
    }
    return;
  }
  const out = await Print.printToFileAsync({ html });
  const file = new File(Paths.cache, `SALFORD-Staff-${report.month}.pdf`);
  if (file.exists) file.delete();
  await new File(out.uri).move(file);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: `تقرير الموظفين ${report.month}`,
  });
}
