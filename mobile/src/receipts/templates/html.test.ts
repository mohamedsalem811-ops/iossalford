import { templatesFor, type TemplateId } from '@/domain/receipts';

import {
  escapeHtml,
  itemTitle,
  linePrice,
  receiptHtml,
  receiptMoney,
  receiptTotal,
  toCss,
  type ReceiptDoc,
} from './html';
import { pdfName } from '../output';

jest.mock('expo-print', () => ({}));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-file-system', () => ({}));
jest.mock('expo-asset', () => ({}));

const doc = (over: Partial<ReceiptDoc> = {}): ReceiptDoc => ({
  template: 'salford_dark',
  showPrices: true,
  receiptNo: 'GR-2026-0007',
  date: '10/11/2026',
  time: '14:05',
  customer: 'سارة',
  items: [
    {
      name: 'Ring',
      brand: 'Pandora',
      color: 'Gold',
      code: 'RNG-0001',
      quantity: 2,
      price: 350_000,
    },
    { name: 'سلسلة ذهب', code: 'NCK-0002', quantity: 1, price: 1_250_500 },
  ],
  ...over,
});

describe('receipt text', () => {
  it('writes brand, name and colour as on the current receipts', () => {
    expect(itemTitle({ name: 'Ring', brand: 'Pandora', color: 'Gold' })).toBe(
      'Pandora — Ring (Gold)',
    );
    expect(itemTitle({ name: ' Ring ', brand: ' ', color: null })).toBe('Ring');
  });

  it('shows prices on an official receipt and XXX on a gift receipt', () => {
    expect(receiptTotal(doc())).toBe('1,950.50 LYD');
    expect(linePrice(doc(), { price: 350_000, quantity: 2 })).toBe('700.00');
    expect(receiptTotal(doc({ showPrices: false }))).toBe('XXX');
    expect(linePrice(doc({ showPrices: false }), { price: 1, quantity: 1 })).toBe('XXX');
    expect(linePrice(doc(), { price: 0, quantity: 1 })).toBe('XXX');
  });

  it('escapes what the owner types', () => {
    expect(escapeHtml('<b>"A&B"</b>')).toBe('&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;');
    const html = receiptHtml(doc({ customer: '<script>x</script>' }));
    expect(html).not.toContain('<script>');
    expect(html).toContain('Customer: &lt;script&gt;');
  });
});

describe('receiptMoney', () => {
  it('shows two decimals like the current receipts, three only when needed', () => {
    expect(receiptMoney(550_000)).toBe('550.00');
    expect(receiptMoney(1_250_500)).toBe('1,250.50');
    expect(receiptMoney(12_125)).toBe('12.125');
  });
});

describe('receiptHtml', () => {
  it("draws the app's own logo in each system's design, with the embedded fonts", () => {
    const j = receiptHtml(doc(), { fontCss: '@font-face{font-family:x}' });
    expect(j).toContain('aria-label="SALFORD jewelry"');
    expect(j).toContain('PlayfairDisplay_800ExtraBold');
    expect(j).toContain('@font-face{font-family:x}');
    const s = receiptHtml(doc({ template: 'scarves_salford' }));
    expect(s).toContain('aria-label="SALFORD scarfs"');
    expect(s).toContain('CormorantGaramond_600SemiBold');
    // The banner grows with its content: nothing is cut off at its bottom.
    expect(j).not.toMatch(/class="banner" style="height/);
  });

  it('has the number, date, items and total, on A4', () => {
    const html = receiptHtml(doc());
    expect(html).toContain('OFFICIAL INVOICE / RECEIPT');
    expect(html).toContain('GR-2026-0007');
    expect(html).toContain('10/11/2026');
    expect(html).toContain('Pandora — Ring (Gold)');
    expect(html).toContain('Item Code: RNG-0001');
    expect(html).toContain('سلسلة ذهب');
    expect(html).toContain('1,950.50 LYD');
    // Rows never split across pages, and the header repeats on each page.
    expect(html).toContain('break-inside: avoid');
    expect(html).toContain('table-header-group');
  });

  it('sizes everything from the paper width, so it fills A4 and A6 edge to edge', () => {
    const a4 = receiptHtml(doc());
    expect(a4).toContain('@page { size: A4; margin: 0; }');
    expect(a4).toContain('--u: calc(100cqw / 595)');
    expect(a4).toContain('container-type: inline-size');
    expect(a4).toContain('font-size: calc(11.5 * var(--u))');
    expect(a4).not.toMatch(/\d+u[;" ]/);
    const a6 = receiptHtml(doc(), { paper: 'a6' });
    expect(a6).toContain('@page { size: A6; margin: 0; }');
    expect(a6).toContain('--u: calc(100cqw / 420)');
  });

  it('turns receipt units into CSS lengths, and nothing else', () => {
    expect(toCss('margin: 0 96u; padding: -4.5u .3u')).toBe(
      'margin: 0 calc(96 * var(--u)); padding: calc(-4.5 * var(--u)) calc(.3 * var(--u))',
    );
    expect(toCss('color:#0B0B18; url(a.png) 3px')).toBe('color:#0B0B18; url(a.png) 3px');
  });

  it('says a gift receipt and that the number comes on save', () => {
    const html = receiptHtml(doc({ showPrices: false, receiptNo: null }));
    expect(html).toContain('GIFT RECEIPT');
    expect(html).toContain('— (assigned on save)');
  });

  it('draws every design of both systems with its own store line', () => {
    const stores: Record<TemplateId, string> = {
      salford_dark: 'SALFORD Jewelry — Libya',
      salford_light: 'SALFORD Jewelry — Libya',
      swarovski: 'SALFORD Jewelry — Libya',
      scarves_libya: 'SALFORD Libya',
      scarves_salford: 'SALFORD Scarves',
    };
    for (const t of [...templatesFor('jewelry'), ...templatesFor('scarves')]) {
      expect(receiptHtml(doc({ template: t }))).toContain(`<td>${stores[t]}</td>`);
    }
  });

  it("never presents the Swarovski design as a Swarovski store's receipt", () => {
    const html = receiptHtml(doc({ template: 'swarovski' }));
    expect(html).toContain('Sold by SALFORD Jewelry');
    expect(html).not.toMatch(/Covent Garden|swarovski\.com|shopping with Swarovski/i);
  });
});

describe('pdfName', () => {
  it('names the file after the receipt number', () => {
    expect(pdfName({ receiptNo: 'GR-2026-0007' })).toBe('SALFORD-Receipt-GR-2026-0007.pdf');
    expect(pdfName({ receiptNo: null })).toBe('SALFORD-Receipt-draft.pdf');
  });
});
