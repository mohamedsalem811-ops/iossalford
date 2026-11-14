/**
 * The receipt as an HTML document, printed to PDF by iOS (expo-print): A4 for sharing and Files,
 * A6 for the printer. Same designs and wording as the current app's receipts (English, digits
 * 0-9), with the app's own logo. Long names wrap; a row never splits across pages; on every new
 * page the table header repeats; the total, customer and thank-you block stays together.
 *
 * Every size is in receipt units ("11.5u"): a fraction of the paper's width, measured on the page
 * box iOS actually prints into (CSS container units). So the receipt always fills the paper,
 * whatever scale the print engine uses.
 */
import type { TemplateId } from '@/domain/receipts';
import { formatDinars } from '@/lib/money';
import { palettes } from '@/theme/palette';

import { logoHtml, type LogoColors } from '../logo-html';

/** What a receipt shows. A new receipt has no number until it is saved. */
export type ReceiptDoc = {
  template: TemplateId;
  showPrices: boolean;
  /** The items' specs printed under each (feature 16); left out: shown. */
  showSpecs?: boolean;
  receiptNo: string | null;
  date: string;
  time: string;
  customer: string;
  items: {
    name: string;
    brand?: string | null;
    color?: string | null;
    code?: string | null;
    specs?: string | null;
    quantity: number;
    price: number;
  }[];
};

/** Paper sizes in points, and how wide the design is on each (in receipt units). */
export const PAPERS = {
  /** Shared and saved in Files. */
  a4: { width: 595, height: 842, units: 595, side: 96, outdent: 48, logo: 150, css: 'A4', gap: 1 },
  /**
   * Printed: narrower side margins so the text stays readable on the small paper, and half the
   * vertical space so a usual receipt fits on one sheet.
   */
  a6: { width: 298, height: 420, units: 420, side: 24, outdent: 0, logo: 110, css: 'A6', gap: 0.5 },
} as const;
export type Paper = keyof typeof PAPERS;

/** A4, the size the preview shows. */
export const PAGE = PAPERS.a4;

/** "11.5u" → a CSS length that is 11.5 / units of the paper's width. */
export function toCss(css: string): string {
  return css.replace(/(?<![\w.#])(-?(?:\d+(?:\.\d+)?|\.\d+))u\b/g, 'calc($1 * var(--u))');
}

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
/** Where a design puts its logo; replaced by the logo at the paper's size. */
const jewelryLogo = (c: LogoColors) => `<!--logo:jewelry:${JSON.stringify(c)}-->`;
const scarvesLogo = (c: LogoColors) => `<!--logo:scarves:${JSON.stringify(c)}-->`;
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
 * The receipt on `paper` (A4 unless told). `previewWidth`: shown in the app at that width.
 */
export function receiptHtml(
  doc: ReceiptDoc,
  opts: { paper?: Paper; fontCss?: string; previewWidth?: number } = {},
): string {
  const paper = PAPERS[opts.paper ?? 'a4'];
  // On screen the page is sized from the view's width in points; printed, from the page box.
  const page = opts.previewWidth
    ? `.page { width: ${opts.previewWidth}px; }\n  .r { --u: ${+(opts.previewWidth / paper.units).toFixed(5)}px; font-size: 11.5u; }`
    : `.page { width: 100%; container-type: inline-size; }\n  .r { --u: calc(100cqw / ${paper.units}); font-size: 11.5u; }`;
  /** Vertical space, tighter on A6. */
  const v = (n: number) => +(n * paper.gap).toFixed(2);
  const look = LOOKS[doc.template] ?? LOOKS.salford_light;
  const no = doc.receiptNo ?? '— (assigned on save)';
  const e = escapeHtml;
  const rows = doc.items
    .map(
      (i) => `<tbody class="item">
        <tr><td dir="auto" class="name">${e(itemTitle(i))}</td><td class="qty">${i.quantity}</td><td class="price">${linePrice(doc, i)}</td></tr>
        <tr><td dir="auto" class="code">Item Code: ${e(i.code?.trim() || '—')}</td><td></td><td></td></tr>${
          doc.showSpecs !== false && i.specs?.trim()
            ? `\n        <tr><td dir="auto" class="specs">${e(i.specs.trim()).replace(/\n/g, '<br>')}</td><td></td><td></td></tr>`
            : ''
        }
      </tbody>`,
    )
    .join('');

  const header = look.header.replace(/<!--logo:(jewelry|scarves):(.*?)-->/g, (_, system, c) =>
    logoHtml(system, paper.logo, JSON.parse(c) as LogoColors),
  );
  return toCss(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  ${opts.fontCss ?? ''}
  @page { size: ${paper.css}; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body { width: 100%; font-family: -apple-system, "Helvetica Neue", "Geeza Pro", sans-serif; }
  /* The page box: its width defines the receipt unit for everything inside. */
  ${page}
  .banner, .plain { text-align: center; }
  .banner { padding: ${v(22)}u 0 ${v(16)}u; }
  .plain { padding-top: ${v(30)}u; }
  .tag { font-size: 9.5u; font-weight: 500; margin-top: ${v(12)}u; letter-spacing: .3u; padding: 0 8u; }
  .line { font-size: 11u; margin-top: ${v(10)}u; }
  h1 { font-size: 13u; text-align: center; margin: ${v(26)}u 0 ${v(22)}u; letter-spacing: .5u; }
  .meta { margin: 0 ${paper.side}u; border-collapse: collapse; }
  .meta td { padding: 2u 0; font-size: 11.5u; }
  .meta td:first-child { width: 114u; }
  table.items { width: calc(100% - ${paper.side * 2}u); margin: ${v(18)}u ${paper.side}u 0; border-collapse: collapse; table-layout: fixed; }
  table.items col.c1 { width: 65%; } table.items col.c2 { width: 15%; } table.items col.c3 { width: 20%; }
  table.items td, table.items th { border: 1u solid #8a8a8a; padding: 4u 8u; font-size: 11u; vertical-align: top; text-align: left; }
  table.items thead { display: table-header-group; }
  table.items th { background: ${look.head.bg}; color: ${look.head.fg}; }
  tbody.item { break-inside: avoid; page-break-inside: avoid; }
  td.name { overflow-wrap: anywhere; unicode-bidi: plaintext; }
  td.code { color: #555; font-size: 10.5u; overflow-wrap: anywhere; }
  td.specs { color: #555; font-size: 10.5u; overflow-wrap: anywhere; unicode-bidi: plaintext; }
  td.qty { text-align: center; }
  .end { break-inside: avoid; page-break-inside: avoid; margin: ${v(14)}u ${paper.side}u 0; }
  .total { display: flex; justify-content: space-between; border-top: 1.2u solid #000; padding: 8u 8u 0; font-weight: 700; font-size: 12u; }
  .customer { margin: ${v(30)}u -${paper.outdent}u 0; font-weight: 700; unicode-bidi: plaintext; }
  .note { margin: ${v(14)}u -${paper.outdent}u 0; color: #777; font-size: 10u; line-height: 1.5; }
  .thanks { text-align: center; margin-top: ${v(34)}u; }
  .motto { text-align: center; margin-top: 6u; font-weight: 700; font-size: 10.5u; color: #555; }
  .bottom { height: ${v(40)}u; }
</style></head>
<body><div class="page"><div class="r">
  ${header}
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
</div></div></body></html>`);
}
