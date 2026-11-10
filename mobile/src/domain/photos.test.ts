/**
 * @jest-environment node
 */
import { ensureBrand, setBrandImage } from './brands';
import { newPhotoName, photoInUse } from './photos';
import { deleteProduct, saveProduct, saveScarfDesign } from './products';
import { makeCtx, type TestCtx } from './testing/ctx';

let ctx: TestCtx;
afterEach(() => ctx.close());

describe('newPhotoName', () => {
  beforeEach(() => {
    ctx = makeCtx('jewelry');
  });

  it('names the file after the system, the time and a random tail', () => {
    expect(newPhotoName(ctx, () => 0.123456789)).toMatch(/^jewelry-[0-9a-z]+-[0-9a-z]{6}\.jpg$/);
  });

  it('never gives the same name twice in a row', () => {
    const names = new Set(Array.from({ length: 50 }, () => newPhotoName(ctx)));
    expect(names.size).toBe(50);
  });

  it('keeps a full-length tail even when the random number is short', () => {
    expect(newPhotoName(ctx, () => 0.5)).toMatch(/-[0-9a-z]{6}\.jpg$/);
  });
});

describe('photoInUse', () => {
  it('is true while a product shows the photo, false once nothing does', () => {
    ctx = makeCtx('jewelry');
    const id = saveProduct(ctx, {
      name: 'خاتم',
      category: 'خواتم',
      price: 100_000,
      stock: 1,
      imageFile: 'a.jpg',
    });
    expect(photoInUse(ctx, 'a.jpg')).toBe(true);
    expect(photoInUse(ctx, 'other.jpg')).toBe(false);
    deleteProduct(ctx, id);
    expect(photoInUse(ctx, 'a.jpg')).toBe(false);
  });

  it('counts a brand photo', () => {
    ctx = makeCtx('jewelry');
    const brand = ensureBrand(ctx, 'Pandora')!;
    setBrandImage(ctx, brand, 'logo.jpg');
    expect(photoInUse(ctx, 'logo.jpg')).toBe(true);
  });

  it('keeps a scarf design photo while one size still uses it', () => {
    ctx = makeCtx('scarves');
    const sizes = (n: number) =>
      ['90×90', '120×120'].slice(0, n).map((size) => ({ size, price: 50_000, cost: 0, stock: 1 }));
    const design = saveScarfDesign(ctx, {
      name: 'وشاح',
      category: 'حرير',
      imageFile: 's.jpg',
      sizes: sizes(2),
    });
    saveScarfDesign(ctx, {
      designId: design,
      name: 'وشاح',
      category: 'حرير',
      imageFile: 's.jpg',
      sizes: sizes(1),
    });
    expect(photoInUse(ctx, 's.jpg')).toBe(true);
  });
});
