/**
 * The repair ticket (rule D, new design): A4, English and Arabic, with the shop's logo. Laid out
 * as a workshop job card: the ticket number large in the header, the stages of the repair, the
 * customer and the piece, the owner's services with their prices, the money and the ready date,
 * the shop's terms, two signatures, and a claim stub to tear off with a QR of the ticket number
 * (staff scan or type it to find the repair).
 *
 * Sizes are in receipt units ("12u", see html.ts): the page always fills the paper.
 */
import type { SystemId } from '@/theme';
import { fonts } from '@/theme/tokens';

import { logoHtml } from '../logo-html';
import { qrSvg } from '../qr';
import { escapeHtml as e, receiptMoney, toCss } from './html';

export type RepairTicket = {
  system: SystemId;
  ticketNo: string;
  /** "21/11/2026" and "15:42". */
  date: string;
  time: string;
  customer: string;
  /** Already masked when the person printing may not see phones ("09•••••678"). */
  phone: string | null;
  description: string;
  /** The piece's notes (size wanted, scratches already there). */
  note: string | null;
  /** The services ticked; price null: «السعر يحدده المالك». An older repair: its kind of work. */
  services: { name: string; price: number | null }[];
  /** Dirhams. */
  total: number;
  paid: number;
  /** "2026-11-30". */
  readyBy: string;
  /** The owner's note printed on every ticket. */
  terms: string;
  /** Who took it in. */
  takenBy: string | null;
  /** The first photo of the piece as it came in (a data: or file: URI), if any. */
  photo?: string | null;
};

const LOOK: Record<SystemId, { deep: string; mid: string; accent: string; soft: string }> = {
  jewelry: { deep: '#0B0B18', mid: '#2B1954', accent: '#C8D8F0', soft: '#EEF2FA' },
  scarves: { deep: '#2A0C1A', mid: '#6E1E3E', accent: '#F0BED0', soft: '#FAEFF3' },
};

const MONTHS_EN = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];
const MONTHS_AR = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

const money = (d: number) => `${receiptMoney(d)} <small>LYD</small>`;

export function repairTicketHtml(
  t: RepairTicket,
  opts: { fontCss?: string; previewWidth?: number } = {},
): string {
  const look = LOOK[t.system];
  const units = 595;
  const page = opts.previewWidth
    ? `.page { width: ${opts.previewWidth}px; }\n  .r { --u: ${+(opts.previewWidth / units).toFixed(5)}px; }`
    : `.page { width: 100%; container-type: inline-size; }\n  .r { --u: calc(100cqw / ${units}); }`;
  const [y, m, d] = t.readyBy.split('-').map(Number);
  const pending = t.services.filter((s) => s.price === null).length;
  const remaining = Math.max(0, t.total - t.paid);
  const logo = logoHtml(t.system, 92, { ink: '#FFFFFF', accent: look.accent, gap: look.mid });
  const stubLogo = logoHtml(t.system, 54, { ink: look.deep, accent: look.mid, gap: '#FFFFFF' });
  const stages = [
    ['Received', 'استُلمت'],
    ['Workshop', 'في الورشة'],
    ['Ready', 'جاهزة'],
    ['Collected', 'سُلّمت'],
  ];
  const rows = t.services
    .map(
      (s, i) => `<tr>
        <td class="n">${String(i + 1).padStart(2, '0')}</td>
        <td class="svc" dir="auto">${e(s.name)}</td>
        <td class="amt">${s.price === null ? '<span class="tbd">يحدده المالك<br><small>Set by the shop</small></span>' : s.price === 0 ? 'FREE · مجاناً' : money(s.price)}</td>
      </tr>`,
    )
    .join('');
  const terms = t.terms
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<p dir="auto">${e(l)}</p>`)
    .join('');

  return toCss(`<!DOCTYPE html>
<html lang="ar"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  ${opts.fontCss ?? ''}
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; color: ${look.deep}; }
  body { font-family: '${fonts.regular}', -apple-system, "Geeza Pro", sans-serif; }
  ${page}
  .r { font-size: 10.5u; line-height: 1.45; }
  small { font-size: .72em; opacity: .75; }
  .serif { font-family: '${fonts.logoJewelryText}', Georgia, serif; }

  /* Header: the logo, the ticket number on a raised tag. */
  .head { position: relative; background: linear-gradient(120deg, ${look.mid} 0%, ${look.deep} 70%); color: #fff;
          padding: 22u 34u 26u; display: flex; align-items: center; justify-content: space-between; direction: ltr; overflow: hidden; }
  .head::after { content: ''; position: absolute; right: -60u; top: -60u; width: 220u; height: 220u; border-radius: 50%;
          border: 1u solid ${look.accent}55; }
  .head::before { content: ''; position: absolute; right: -20u; top: -100u; width: 220u; height: 220u; border-radius: 50%;
          border: 1u solid ${look.accent}33; }
  .title { text-align: right; position: relative; z-index: 1; }
  .kicker { color: ${look.accent}; letter-spacing: 3u; font-size: 8.5u; font-weight: 600; }
  .kicker-ar { color: ${look.accent}; font-size: 11u; margin-top: 1u; }
  .no { font-family: '${fonts.logoJewelry}', Georgia, serif; font-size: 30u; line-height: 1.1; margin-top: 6u; letter-spacing: 1u; }
  .when { font-size: 9u; color: #ffffffbb; margin-top: 4u; }

  /* The stages of the repair. */
  .track { display: flex; direction: ltr; margin: 18u 34u 4u; }
  .stage { flex: 1; text-align: center; position: relative; font-size: 8.5u; color: #8a8a96; }
  .stage::before { content: ''; position: absolute; top: 7u; left: -50%; width: 100%; height: 1.5u; background: #dcdce4; }
  .stage:first-child::before { display: none; }
  .dot { width: 16u; height: 16u; border-radius: 50%; border: 1.5u solid #c9c9d3; background: #fff; margin: 0 auto 5u; position: relative; z-index: 1; }
  .stage.on { color: ${look.deep}; font-weight: 600; }
  .stage.on .dot { background: ${look.mid}; border-color: ${look.mid}; box-shadow: 0 0 0 3u ${look.soft}; }
  .stage .ar { display: block; font-size: 9.5u; }

  /* Customer and piece. */
  .grid { display: flex; gap: 12u; margin: 16u 34u 0; }
  .box { flex: 1; border: 1u solid #e3e3ea; border-radius: 10u; padding: 10u 12u; }
  .label { display: flex; justify-content: space-between; font-size: 8u; letter-spacing: 1.5u; color: #8a8a96; text-transform: uppercase; direction: ltr; }
  .label .ar { letter-spacing: 0; font-size: 9.5u; text-transform: none; }
  .big { font-size: 13u; font-weight: 600; margin-top: 4u; unicode-bidi: plaintext; }
  .sub { color: #555; margin-top: 2u; unicode-bidi: plaintext; direction: ltr; text-align: left; }
  .piece { display: flex; gap: 10u; align-items: flex-start; }
  .photo { width: 58u; height: 58u; border-radius: 8u; object-fit: cover; flex: none; border: 1u solid #e3e3ea; }

  /* Services. */
  table.svcs { width: calc(100% - 68u); margin: 16u 34u 0; border-collapse: separate; border-spacing: 0; }
  table.svcs th { background: ${look.soft}; color: ${look.deep}; font-size: 8.5u; letter-spacing: 1u; padding: 7u 10u; text-align: left; font-weight: 600; direction: ltr; }
  table.svcs th:first-child { border-radius: 8u 0 0 8u; width: 34u; }
  table.svcs th:last-child { border-radius: 0 8u 8u 0; text-align: right; width: 130u; }
  table.svcs td { padding: 8u 10u; border-bottom: 1u dashed #dcdce4; vertical-align: middle; }
  td.n { color: #a0a0ab; font-size: 9u; direction: ltr; }
  td.svc { font-size: 11.5u; font-weight: 500; unicode-bidi: plaintext; }
  td.amt { text-align: right; font-weight: 600; direction: ltr; white-space: nowrap; }
  .tbd { color: ${look.mid}; font-weight: 600; font-size: 9.5u; line-height: 1.2; display: inline-block; text-align: right; }

  /* Money and the ready date. */
  .sum { display: flex; gap: 12u; margin: 16u 34u 0; direction: ltr; }
  .cal { width: 112u; border-radius: 12u; overflow: hidden; border: 1.5u solid ${look.deep}; text-align: center; flex: none; }
  .cal .top { background: ${look.deep}; color: #fff; font-size: 8u; letter-spacing: 2u; padding: 4u 0; }
  .cal .day { font-family: '${fonts.logoJewelry}', Georgia, serif; font-size: 36u; line-height: 1.15; }
  .cal .mon { font-size: 9u; letter-spacing: 2u; }
  .cal .mon-ar { font-size: 10u; padding-bottom: 6u; }
  .money { flex: 1; border-radius: 12u; background: ${look.soft}; padding: 10u 14u; }
  .mrow { display: flex; justify-content: space-between; align-items: baseline; padding: 3u 0; }
  .mrow .k { color: #555; }
  .mrow .k .ar { margin-left: 6u; }
  .mrow.due { border-top: 1.5u solid ${look.deep}; margin-top: 4u; padding-top: 7u; font-size: 14u; font-weight: 700; }
  .flag { margin-top: 6u; color: ${look.mid}; font-size: 9.5u; text-align: right; direction: rtl; }

  /* Terms and signatures. */
  .terms { margin: 16u 34u 0; padding: 10u 14u; border-right: 3u solid ${look.mid}; background: #fafafc; direction: rtl; }
  .terms h3 { margin: 0 0 4u; font-size: 9.5u; color: ${look.mid}; }
  .terms p { margin: 2u 0; font-size: 9.5u; color: #444; unicode-bidi: plaintext; }
  .sign { display: flex; gap: 30u; margin: 22u 34u 0; direction: ltr; }
  .sign div { flex: 1; border-top: 1u solid #9a9aa6; padding-top: 4u; font-size: 8.5u; color: #777; display: flex; justify-content: space-between; }

  /* The claim stub. */
  .cut { margin: 22u 0 0; border-top: 1.5u dashed #b8b8c4; position: relative; }
  .cut span { position: absolute; left: 24u; top: -9u; background: #fff; padding: 0 6u; color: #8a8a96; font-size: 11u; }
  .cut b { position: absolute; right: 24u; top: -7u; background: #fff; padding: 0 6u; color: #8a8a96; font-size: 8u; font-weight: 500; letter-spacing: 1u; }
  .stub { display: flex; align-items: center; gap: 16u; margin: 16u 34u 26u; direction: ltr; }
  .stub .info { flex: 1; }
  .stub .no2 { font-family: '${fonts.logoJewelry}', Georgia, serif; font-size: 20u; color: ${look.deep}; }
  .stub .line2 { display: flex; gap: 14u; margin-top: 4u; color: #555; font-size: 9.5u; flex-wrap: wrap; }
  .stub .line2 b { color: ${look.deep}; }
  .stub .hint { font-size: 8.5u; color: #8a8a96; margin-top: 4u; direction: rtl; text-align: left; }
</style></head>
<body><div class="page"><div class="r">
  <div class="head">
    <div style="position:relative;z-index:1">${logo}</div>
    <div class="title">
      <div class="kicker">REPAIR TICKET</div>
      <div class="kicker-ar">إيصال صيانة</div>
      <div class="no">${e(t.ticketNo)}</div>
      <div class="when">${e(t.date)} · ${e(t.time)}${t.takenBy ? ` · ${e(t.takenBy)}` : ''}</div>
    </div>
  </div>

  <div class="track">
    ${stages.map(([en, ar], i) => `<div class="stage${i === 0 ? ' on' : ''}"><div class="dot"></div>${en}<span class="ar">${ar}</span></div>`).join('')}
  </div>

  <div class="grid">
    <div class="box">
      <div class="label"><span>Customer</span><span class="ar">الزبون</span></div>
      <div class="big" dir="auto">${e(t.customer)}</div>
      ${t.phone ? `<div class="sub">${e(t.phone)}</div>` : ''}
    </div>
    <div class="box" style="flex:1.4">
      <div class="label"><span>The piece</span><span class="ar">القطعة</span></div>
      <div class="piece">
        ${t.photo ? `<img class="photo" src="${e(t.photo)}" alt="">` : ''}
        <div>
          <div class="big" dir="auto">${e(t.description)}</div>
          ${t.note ? `<div class="sub" dir="auto" style="direction:rtl;text-align:right">${e(t.note)}</div>` : ''}
        </div>
      </div>
    </div>
  </div>

  <table class="svcs">
    <thead><tr><th>#</th><th>SERVICE · الخدمة</th><th>PRICE · السعر</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="sum">
    <div class="cal">
      <div class="top">READY ON · جاهزة</div>
      <div class="day">${d || ''}</div>
      <div class="mon">${MONTHS_EN[(m || 1) - 1]} ${y || ''}</div>
      <div class="mon-ar">${MONTHS_AR[(m || 1) - 1]}</div>
    </div>
    <div class="money">
      <div class="mrow"><span class="k">Total<span class="ar">المجموع</span></span><span>${money(t.total)}</span></div>
      <div class="mrow"><span class="k">Deposit paid<span class="ar">العربون المدفوع</span></span><span>${money(t.paid)}</span></div>
      <div class="mrow due"><span>Due at pickup<span class="ar" style="margin-left:6u;font-weight:600">الباقي عند الاستلام</span></span><span>${money(remaining)}</span></div>
      ${pending ? `<div class="flag">+ ${pending === 1 ? 'خدمة واحدة' : `${pending} خدمات`} بسعر يحدده المالك ويُضاف إلى المجموع</div>` : ''}
    </div>
  </div>

  ${terms ? `<div class="terms"><h3>شروط الصيانة · Terms</h3>${terms}</div>` : ''}

  <div class="sign">
    <div><span>Customer signature</span><span>توقيع الزبون</span></div>
    <div><span>Received by</span><span>المستلم</span></div>
  </div>

  <div class="cut"><span>✂</span><b>CLAIM STUB · قسيمة الاستلام</b></div>
  <div class="stub">
    ${stubLogo}
    <div class="info">
      <div class="no2">${e(t.ticketNo)}</div>
      <div class="line2">
        <span dir="auto"><b>${e(t.customer)}</b></span>
        <span>Ready · جاهزة <b>${d}/${m}/${y}</b></span>
        <span>Due · الباقي <b>${money(remaining)}</b></span>
      </div>
      <div class="hint">يُرجى إحضار هذه القسيمة عند استلام القطعة · Bring this stub to collect your piece</div>
    </div>
    ${qrSvg(t.ticketNo, '64u', look.deep)}
  </div>
</div></div></body></html>`);
}
