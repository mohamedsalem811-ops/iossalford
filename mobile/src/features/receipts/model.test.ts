import type { Product } from '@/domain/products';
import type { Receipt } from '@/domain/receipts';

import {
  blankItem,
  emptyStudio,
  itemFromProduct,
  moveItem,
  receiptDoc,
  receiptSummary,
  studioDoc,
  studioFrom,
  studioItems,
  studioProblem,
  type StudioForm,
} from './model';

const receipt: Receipt = {
  id: 3,
  receiptNo: 'GR-2026-0003',
  date: '10/11/2026',
  time: '14:05',
  customer: 'Salford Libya',
  template: 'salford_light',
  showPrices: false,
  showSpecs: true,
  pointsPaid: 0,
  rewardOff: 0,
  footer: null,
  saleId: null,
  items: [
    { name: 'Ring', brand: 'Pandora', color: null, code: 'RNG-0001', quantity: 2, price: 350_500 },
  ],
  total: 701_000,
  createdAt: '2026-11-10T14:05:00',
  updatedAt: null,
};

describe('studio form', () => {
  it('starts with the system design, official prices and no lines', () => {
    expect(emptyStudio('scarves')).toEqual({
      template: 'scarves_libya',
      showPrices: true,
      showSpecs: true,
      customer: '',
      items: [],
    });
  });

  it('opens a saved receipt; the default customer shows as empty', () => {
    const f = studioFrom(receipt);
    expect(f).toMatchObject({ template: 'salford_light', showPrices: false, customer: '' });
    expect(f.items[0]).toMatchObject({ name: 'Ring', brand: 'Pandora', color: '', price: '350.5' });
    expect(receiptDoc(receipt)).toMatchObject({
      receiptNo: 'GR-2026-0003',
      customer: 'Salford Libya',
    });
  });

  it('takes a piece from the stock with its code, brand and price', () => {
    const p = {
      name: 'Silk',
      size: '90×90',
      brand: 'Hermès',
      color: 'Red',
      sku: 'SLK-0001',
      price: 90_000,
    };
    expect(itemFromProduct({ system: 'scarves' }, p as Product)).toMatchObject({
      name: 'Silk — 90×90',
      brand: 'Hermès',
      color: 'Red',
      code: 'SLK-0001',
      quantity: 1,
      price: '90',
    });
  });

  it('moves a line up or down, not past either end', () => {
    const [a, b, c] = [blankItem(), blankItem(), blankItem()];
    expect(moveItem([a, b, c], c.key, -1).map((i) => i.key)).toEqual([a.key, c.key, b.key]);
    expect(moveItem([a, b, c], a.key, 1).map((i) => i.key)).toEqual([b.key, a.key, c.key]);
    expect(moveItem([a, b, c], a.key, -1)).toEqual([a, b, c]);
    expect(moveItem([a, b, c], c.key, 1)).toEqual([a, b, c]);
  });

  it('saves only typed lines, Arabic digits read as 0-9, and checks prices on an official receipt', () => {
    const f: StudioForm = {
      ...emptyStudio('jewelry'),
      items: [
        { ...blankItem(), name: ' Ring ', price: '٣٥٠' },
        { ...blankItem(), name: '   ' },
      ],
    };
    expect(studioItems(f)).toEqual([
      {
        name: 'Ring',
        brand: null,
        color: null,
        code: null,
        specs: null,
        quantity: 1,
        price: 350_000,
      },
    ]);
    expect(studioProblem(f)).toBeNull();
    expect(studioProblem({ ...f, items: [] })).toBe('أضف قطعة واحدة على الأقل إلى الإيصال');
    const noPrice = { ...f, items: [{ ...blankItem(), name: 'Ring' }] };
    expect(studioProblem(noPrice)).toContain('اكتب سعر كل قطعة');
    expect(studioProblem({ ...noPrice, showPrices: false })).toBeNull();
  });

  it('previews a new receipt without a number, with the default customer', () => {
    const doc = studioDoc(emptyStudio('jewelry'), null, new Date(2026, 10, 10, 9, 5));
    expect(doc).toMatchObject({
      receiptNo: null,
      date: '10/11/2026',
      time: '09:05',
      customer: 'Salford Libya',
    });
  });

  it('summarises the lines for the history list', () => {
    expect(receiptSummary(receipt)).toBe('Ring × 2');
  });
});
