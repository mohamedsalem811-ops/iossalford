import {
  addItem,
  availableText,
  emptySetForm,
  removeItem,
  setFormFrom,
  setFormToInput,
  setItemQuantity,
  setPreview,
  setsAvailable,
} from './model';

const products = new Map([
  [1, { id: 1, price: 100_000, stock: 5, archived: false }],
  [2, { id: 2, price: 250_500, stock: 2, archived: false }],
  [3, { id: 3, price: 50_000, stock: 9, archived: true }],
]);
const find = (id: number) => products.get(id);

describe('set form', () => {
  it('adds, counts up, changes and removes pieces', () => {
    let items = addItem([], 1);
    items = addItem(items, 2);
    items = addItem(items, 1);
    expect(items).toEqual([
      { productId: 1, quantity: 2 },
      { productId: 2, quantity: 1 },
    ]);
    expect(setItemQuantity(items, 2, 3)[1].quantity).toBe(3);
    expect(removeItem(items, 1)).toEqual([{ productId: 2, quantity: 1 }]);
  });

  it('round-trips a saved set, the discount in dirhams', () => {
    const f = setFormFrom({
      name: 'طقم',
      discount: 40_500,
      items: [{ productId: 1, quantity: 1 }],
    });
    expect(f.discount).toBe('40.5');
    expect(setFormToInput(f, 7)).toEqual({
      id: 7,
      name: 'طقم',
      discount: 40_500,
      items: [{ productId: 1, quantity: 1 }],
    });
    expect(setFormToInput(emptySetForm()).discount).toBe(0);
    expect(setFormFrom({ name: 'x', discount: 0, items: [] }).discount).toBe('');
  });

  it('previews the list price, the discount and the set price', () => {
    const items = [
      { productId: 1, quantity: 2 },
      { productId: 2, quantity: 1 },
    ];
    expect(setPreview(items, 50_000, find)).toEqual({
      list: 450_500,
      discount: 50_000,
      price: 400_500,
    });
    expect(setPreview(items, 0, find).price).toBe(450_500);
  });
});

describe('sets available', () => {
  it('counts complete sets from stock minus the cart; an archived piece makes none', () => {
    const items = [
      { productId: 1, quantity: 2 },
      { productId: 2, quantity: 1 },
    ];
    expect(setsAvailable(items, find)).toBe(2);
    const cart = [{ key: 'a', productId: 2, name: 'x', quantity: 1, unitPrice: 1 }];
    expect(setsAvailable(items, find, cart)).toBe(1);
    expect(setsAvailable([{ productId: 3, quantity: 1 }], find)).toBe(0);
    expect(setsAvailable([], find)).toBe(0);
  });

  it('says how many with the Arabic forms', () => {
    expect(availableText(0)).toBe('غير متوفر حالياً');
    expect(availableText(1)).toBe('متوفر طقم واحد');
    expect(availableText(2)).toBe('متوفر طقمان');
    expect(availableText(5)).toBe('متوفر 5 أطقم');
  });
});
