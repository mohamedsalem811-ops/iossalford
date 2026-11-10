/**
 * The receipt as an HTML document on A4 pages, printed to PDF by iOS (expo-print). Same
 * designs and wording as the current app's receipts (English, digits 0-9), with the app's own
 * logo. Long names wrap; a row never splits across pages; on every new page the table header
 * repeats; the total, customer and thank-you block stays together.
 */
import type { TemplateId } from '@/domain/receipts';
import { formatDinars } from '@/lib/money';
import { palettes } from '@/theme/palette';

import { logoHtml, type LogoColors } from '../logo-html';

/** What a receipt shows. A new receipt has no number until it is saved. */
export type ReceiptDoc = {
  template: TemplateId;
  showPrices: boolean;
  receiptNo: string | null;
  date: string;
  time: string;
  customer: string;
  items: {
    name: string;
    brand?: string | null;
    color?: string | null;
    code?: string | null;
    quantity: number;
    price: number;
  }[];
};

/** A4 in points, as the current app draws it. */
export const PAGE = { width: 595, height: 842 } as const;

/** "Pandora — Ring (Gold)": brand, name and colour, as on the current receipts. */
export function itemTitle(i: Pick<ReceiptDoc['items'][number], 'name' | 'brand' | 'color'>) {
  const color = i.color?.trim();
  const base = color ? `${i.name.trim()} (${color})` : i.name.trim();
  const brand = i.brand?.trim();
  return brand ? `${brand} — ${base}` : base;
}

export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/**
 * Money as on the current receipts: two decimals ("550.00", "1,250.50"), three only when the
 * dirhams need them ("12.125").
 */
export function receiptMoney(dirhams: number): string {
  const [whole, frac = ''] = formatDinars(dirhams).split('.');
  return `${whole}.${frac.padEnd(2, '0')}`;
}

/** "1,250.00 LYD" for the total; a gift receipt shows XXX. */
export function receiptTotal(doc: Pick<ReceiptDoc, 'items' | 'showPrices'>): string {
  const total = doc.items.reduce((t, i) => t + i.price * i.quantity, 0);
  return doc.showPrices && total > 0 ? `${receiptMoney(total)} LYD` : 'XXX';
}

export function linePrice(
  doc: Pick<ReceiptDoc, 'showPrices'>,
  i: { price: number; quantity: number },
) {
  return doc.showPrices && i.price > 0 ? receiptMoney(i.price * i.quantity) : 'XXX';
}

type Look = {
  header: string;
  /** Table header background and text. */
  head: { bg: string; fg: string };
  store: string;
  thanks: string;
  motto: string | null;
};

const ICE = '#C8D8F0';
const BLUSH = '#F0BED0';
const INK = '#111114';
/** The logo's width on the receipt, in points. */
const LOGO_W = 150;

const jewelryLogo = (c: LogoColors) => logoHtml('jewelry', LOGO_W, c);
const scarvesLogo = (c: LogoColors) => logoHtml('scarves', LOGO_W, c);
const onWhite = (system: 'jewelry' | 'scarves'): LogoColors => ({
  ink: INK,
  accent: palettes[system].light.accent,
  gap: '#FFFFFF',
});

/** Each design: its header (with the app's logo), table colours, store line and closing words. */
const LOOKS: Record<TemplateId, Look> = {
  salford_dark: {
    header: `<div class="banner" style="background:linear-gradient(225deg,#2B1954 0%,#0B0B18 60%,#05050A 100%);border-bottom:3px solid ${ICE}">
      ${jewelryLogo({ ink: '#FFFFFF', accent: ICE, gap: '#100D24' })}
      <div class="tag" style="color:${ICE}">✦ FINE JEWELRY &amp; LUXURY CREATIONS • TRIPOLI, LIBYA ✦</div>
    </div>`,
    head: { bg: '#0B0B18', fg: '#fff' },
    store: 'SALFORD Jewelry — Libya',
    thanks: 'Thank you for shopping with SALFORD Jewelry.',
    motto: '✦ SALFORD HIGH JEWELRY ✦',
  },
  salford_light: {
    header: `<div class="plain">
      ${jewelryLogo(onWhite('jewelry'))}
      <div class="line" style="font-weight:700">SALFORD JEWELRY — LIBYA</div>
    </div>`,
    head: { bg: '#EDEDED', fg: '#000' },
    store: 'SALFORD Jewelry — Libya',
    thanks: 'Thank you for shopping with SALFORD Jewelry.',
    motto: '✦ SALFORD HIGH JEWELRY ✦',
  },
  // SALFORD's own receipt for the Swarovski pieces it sells. It does not imitate a Swarovski
  // store receipt: the shop, its address and its thanks are SALFORD's.
  swarovski: {
    header: `<div class="plain">
      ${jewelryLogo(onWhite('jewelry'))}
      <div class="line" style="font-weight:600;letter-spacing:3px">SWAROVSKI CRYSTAL PIECES</div>
      <div class="line" style="color:#555;margin-top:4px">Sold by SALFORD Jewelry • Tripoli, Libya</div>
    </div>`,
    head: { bg: '#EDEDED', fg: '#000' },
    store: 'SALFORD Jewelry — Libya',
    thanks: 'Thank you for shopping with SALFORD Jewelry.',
    motto: null,
  },
  scarves_libya: {
    header: `<div class="plain">
      ${scarvesLogo(onWhite('scarves'))}
      <div class="line" style="color:#777;font-size:10px;font-weight:500">SCARVES &amp; ACCESSORIES • TRIPOLI, LIBYA</div>
    </div>`,
    head: { bg: '#EDEDED', fg: '#000' },
    store: 'SALFORD Libya',
    thanks: 'Thank you for shopping with SALFORD.',
    motto: '✦ SALFORD LIBYA ✦',
  },
  scarves_salford: {
    header: `<div class="banner" style="background:linear-gradient(225deg,#6E1E3E 0%,#2A0C1A 100%);border-bottom:3px solid ${BLUSH}">
      ${scarvesLogo({ ink: '#FFFFFF', accent: BLUSH, gap: '#4A1529' })}
      <div class="tag" style="color:${BLUSH}">✦ SILK &amp; CASHMERE SCARVES • TRIPOLI, LIBYA ✦</div>
    </div>`,
    head: { bg: '#6E1E3E', fg: '#fff' },
    store: 'SALFORD Scarves',
    thanks: 'Thank you for shopping with SALFORD.',
    motto: '✦ SALFORD SCARVES ✦',
  },
};

/**
 * `previewWidth`: shown on screen at this width (points). The page is scaled down to fit it
 * exactly; the printed PDF is always real A4.
 */
export function receiptHtml(
  doc: ReceiptDoc,
  opts: { previewWidth?: number; fontCss?: string } = {},
): string {
  const zoom = opts.previewWidth ? Math.min(1, opts.previewWidth / PAGE.width) : 1;
  const viewport = opts.previewWidth
    ? 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'
    : `width=${PAGE.width}`;
  const look = LOOKS[doc.template] ?? LOOKS.salford_light;
  const no = doc.receiptNo ?? '— (assigned on save)';
  const e = escapeHtml;
  const rows = doc.items
    .map(
      (i) => `<tbody class="item">
        <tr><td dir="auto" class="name">${e(itemTitle(i))}</td><td class="qty">${i.quantity}</td><td class="price">${linePrice(doc, i)}</td></tr>
        <tr><td dir="auto" class="code">Item Code: ${e(i.code?.trim() || '—')}</td><td></td><td></td></tr>
      </tbody>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="${viewport}">
<style>
  ${opts.fontCss ?? ''}
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body { width: ${PAGE.width}px; zoom: ${zoom}; font-family: -apple-system, "Helvetica Neue", "Geeza Pro", sans-serif; font-size: 11.5px; }
  .banner, .plain { text-align: center; }
  .banner { padding: 22px 0 16px; }
  .plain { padding-top: 30px; }
  .tag { font-size: 9.5px; font-weight: 500; margin-top: 12px; letter-spacing: .3px; }
  .line { font-size: 11px; margin-top: 10px; }
  h1 { font-size: 13px; text-align: center; margin: 26px 0 22px; letter-spacing: .5px; }
  .meta { margin: 0 96px; border-collapse: collapse; }
  .meta td { padding: 2px 0; }
  .meta td:first-child { width: 114px; }
  table.items { width: ${PAGE.width - 192}px; margin: 18px 96px 0; border-collapse: collapse; table-layout: fixed; }
  table.items col.c1 { width: 65%; } table.items col.c2 { width: 15%; } table.items col.c3 { width: 20%; }
  table.items td, table.items th { border: 1px solid #8a8a8a; padding: 4px 8px; font-size: 11px; vertical-align: top; text-align: left; }
  table.items thead { display: table-header-group; }
  table.items th { background: ${look.head.bg}; color: ${look.head.fg}; font-size: 11px; }
  tbody.item { break-inside: avoid; page-break-inside: avoid; }
  td.name { overflow-wrap: anywhere; unicode-bidi: plaintext; }
  td.code { color: #555; font-size: 10.5px; overflow-wrap: anywhere; }
  td.qty { text-align: center; }
  .end { break-inside: avoid; page-break-inside: avoid; margin: 14px 96px 0; }
  .total { display: flex; justify-content: space-between; border-top: 1.2px solid #000; padding: 8px 8px 0; font-weight: 700; font-size: 12px; }
  .customer { margin: 30px -48px 0; font-weight: 700; unicode-bidi: plaintext; }
  .note { margin: 14px -48px 0; color: #777; font-size: 10px; line-height: 1.5; }
  .thanks { text-align: center; margin-top: 34px; }
  .motto { text-align: center; margin-top: 6px; font-weight: 700; font-size: 10.5px; color: #555; }
  .bottom { height: 40px; }
</style></head>
<body>
  ${look.header}
  <h1>${doc.showPrices ? 'OFFICIAL INVOICE / RECEIPT' : 'GIFT RECEIPT'}</h1>
  <table class="meta">
    <tr><td>Date:</td><td>${e(doc.date)}</td></tr>
    <tr><td>Time:</td><td>${e(doc.time)}</td></tr>
    <tr><td>Receipt No:</td><td>${e(no)}</td></tr>
    <tr><td>Store:</td><td>${e(look.store)}</td></tr>
  </table>
  <table class="items">
    <colgroup><col class="c1"><col class="c2"><col class="c3"></colgroup>
    <thead>
      <tr><th>Item</th><th>Qty</th><th>Price</th></tr>
    </thead>
    ${rows}
  </table>
  <div class="end">
    <div class="total"><span>Total</span><span>${receiptTotal(doc)}</span></div>
    <div class="customer" dir="auto">Customer: ${e(doc.customer)}</div>
    <div class="note">This is a gift receipt. Original receipt is required for returns or exchanges.<br>Returns are subject to store policy.</div>
    <div class="thanks">${look.thanks}</div>
    ${look.motto ? `<div class="motto">${look.motto}</div>` : ''}
  </div>
  <div class="bottom"></div>
</body></html>`;
}
