import type { Product } from '@/domain/products';

import {
  brandSuggestions,
  costInDirhams,
  emptyForm,
  formFromProduct,
  formToInput,
  margin,
  validateForm,
  type ProductForm,
} from './form-model';

const RATE = 7_000; // 7.000 LYD per dollar

const filled = (over: Partial<ProductForm> = {}): ProductForm => ({
  ...emptyForm('jewelry'),
  name: ' خاتم ',
  price: '350',
  cost: '200',
  ...over,
});

describe('product form', () => {
  it('starts with the first category, one piece and a low-stock alert of 2', () => {
    expect(emptyForm('jewelry')).toMatchObject({ category: 'خواتم', stock: '1', lowStock: '2' });
    expect(emptyForm('scarves').category).toBe('حرير');
  });

  it('asks for the name, a price above 0, the cost and the stock', () => {
    expect(validateForm(emptyForm('jewelry'))).toEqual({
      name: 'اسم القطعة مطلوب',
      price: 'سعر البيع مطلوب ويجب أن يكون أكبر من 0',
      cost: 'أدخل التكلفة، أو 0 إذا كانت غير معروفة',
    });
    expect(validateForm(filled({ price: '0' })).price).toBeDefined();
    expect(validateForm(filled({ stock: '' })).stock).toBeDefined();
    expect(validateForm(filled({ cost: '0' }))).toEqual({});
  });

  it('accepts Arabic digits typed anywhere', () => {
    expect(validateForm(filled({ price: '٣٥٠', cost: '٢٠٠', stock: '٣' }))).toEqual({});
    expect(formToInput(filled({ price: '٣٥٠٫٥' })).price).toBe(350_500);
  });

  it('works out the margin, converting a dollar cost', () => {
    expect(margin(filled(), RATE)).toEqual({ profit: 150_000, percent: 43 });
    expect(margin(filled({ currency: 'usd', cost: '25' }), RATE)).toEqual({
      profit: 175_000,
      percent: 50,
    });
    expect(margin(filled({ price: '' }), RATE)).toBeNull();
    expect(costInDirhams({ currency: 'usd', cost: '' }, RATE)).toBeNull();
  });

  it('turns the form into a save: trimmed, dollars as cents, empty parts as null', () => {
    expect(formToInput(filled({ brand: ' Pandora ', color: '' }), 4)).toEqual({
      id: 4,
      sku: '',
      name: 'خاتم',
      brand: 'Pandora',
      category: 'خواتم',
      color: null,
      size: null,
      specs: '',
      cost: 200_000,
      costUsd: null,
      price: 350_000,
      stock: 1,
      lowStock: 2,
      imageFile: null,
    });
    expect(formToInput(filled({ currency: 'usd', cost: '12.5' }))).toMatchObject({
      cost: undefined,
      costUsd: 1_250,
    });
  });

  it('fills the form from a product, in its cost currency', () => {
    const p: Product = {
      id: 1,
      sku: 'RNG-0001',
      name: 'خاتم',
      brandId: 1,
      brand: 'Pandora',
      category: 'خواتم',
      designId: null,
      size: '7',
      color: 'ذهبي',
      cost: 87_500,
      costUsd: 1_250,
      costRate: 7_000,
      price: 150_000,
      stock: 3,
      lowStock: 1,
      imageFile: 'a.jpg',
      specs: null,
      archived: false,
      createdAt: '',
      updatedAt: '',
    };
    expect(formFromProduct(p)).toEqual({
      name: 'خاتم',
      sku: 'RNG-0001',
      brand: 'Pandora',
      category: 'خواتم',
      color: 'ذهبي',
      size: '7',
      specs: '',
      currency: 'usd',
      cost: '12.5',
      price: '150',
      stock: '3',
      lowStock: '1',
      imageFile: 'a.jpg',
    });
    expect(formFromProduct({ ...p, costUsd: null, costRate: null }).cost).toBe('87.5');
  });
});

describe('brandSuggestions', () => {
  const brands = ['Pandora', 'Swarovski', 'Lazurde'];

  it('suggests brands containing what is typed, in any case', () => {
    expect(brandSuggestions(brands, 'AR')).toEqual(['Swarovski']);
    expect(brandSuggestions(brands, 'r')).toEqual(brands);
    expect(brandSuggestions(brands, '')).toEqual(brands);
  });

  it('stops suggesting a brand once it is typed exactly', () => {
    expect(brandSuggestions(brands, 'pandora ')).toEqual([]);
  });
});
