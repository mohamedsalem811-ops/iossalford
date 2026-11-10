/**
 * The product form: what is typed (always text, digits 0-9), the Arabic messages for anything
 * missing, the live margin, and the save input for the business rules.
 */
import { CATEGORIES, type Product, type ProductInput } from '@/domain/products';
import { parseHundredths, parseInteger, parseThousandths } from '@/lib/digits';
import { editableDinars, editableUsd, usdToLyd } from '@/lib/money';
import type { SystemId } from '@/theme';

export type Currency = 'lyd' | 'usd';

export type ProductForm = {
  name: string;
  sku: string;
  brand: string;
  category: string;
  color: string;
  size: string;
  /** The currency the cost is typed in. */
  currency: Currency;
  cost: string;
  price: string;
  stock: string;
  lowStock: string;
  imageFile: string | null;
};

export const DEFAULT_LOW_STOCK = 2;

export function emptyForm(system: SystemId): ProductForm {
  return {
    name: '',
    sku: '',
    brand: '',
    category: CATEGORIES[system][0],
    color: '',
    size: '',
    currency: 'lyd',
    cost: '',
    price: '',
    stock: '1',
    lowStock: String(DEFAULT_LOW_STOCK),
    imageFile: null,
  };
}

export function formFromProduct(p: Product): ProductForm {
  const usd = p.costUsd !== null;
  return {
    name: p.name,
    sku: p.sku,
    brand: p.brand ?? '',
    category: p.category,
    color: p.color ?? '',
    size: p.size ?? '',
    currency: usd ? 'usd' : 'lyd',
    cost: usd ? editableUsd(p.costUsd!) : editableDinars(p.cost),
    price: editableDinars(p.price),
    stock: String(p.stock),
    lowStock: String(p.lowStock),
    imageFile: p.imageFile,
  };
}

export type FormErrors = Partial<Record<'name' | 'price' | 'cost' | 'stock' | 'lowStock', string>>;

export function validateForm(f: ProductForm): FormErrors {
  const errors: FormErrors = {};
  if (!f.name.trim()) errors.name = 'اسم القطعة مطلوب';
  const price = parseThousandths(f.price);
  if (price === null || price <= 0) errors.price = 'سعر البيع مطلوب ويجب أن يكون أكبر من 0';
  const cost = f.currency === 'usd' ? parseHundredths(f.cost) : parseThousandths(f.cost);
  if (cost === null) errors.cost = 'أدخل التكلفة، أو 0 إذا كانت غير معروفة';
  if (parseInteger(f.stock) === null) errors.stock = 'أدخل الكمية المتوفرة في المخزن';
  if (parseInteger(f.lowStock) === null) errors.lowStock = 'أدخل حد تنبيه المخزون';
  return errors;
}

/** The cost in dirhams at `rate` (a dollar cost is converted), or null while it is not typed. */
export function costInDirhams(f: Pick<ProductForm, 'currency' | 'cost'>, rate: number) {
  if (f.currency === 'usd') {
    const cents = parseHundredths(f.cost);
    return cents === null ? null : usdToLyd(cents, rate);
  }
  return parseThousandths(f.cost);
}

/** Profit per piece and its share of the price, once price and cost are typed. */
export function margin(
  f: Pick<ProductForm, 'currency' | 'cost' | 'price'>,
  rate: number,
): { profit: number; percent: number } | null {
  const price = parseThousandths(f.price);
  const cost = costInDirhams(f, rate);
  if (price === null || price <= 0 || cost === null) return null;
  const profit = price - cost;
  return { profit, percent: Math.round((profit / price) * 100) };
}

/** The save input for saveProduct. Call after validateForm found nothing. */
export function formToInput(f: ProductForm, id?: number): ProductInput {
  const usd = f.currency === 'usd';
  return {
    id,
    sku: f.sku.trim(),
    name: f.name.trim(),
    brand: f.brand.trim() || null,
    category: f.category,
    color: f.color.trim() || null,
    size: f.size.trim() || null,
    cost: usd ? undefined : (parseThousandths(f.cost) ?? 0),
    costUsd: usd ? (parseHundredths(f.cost) ?? 0) : null,
    price: parseThousandths(f.price) ?? 0,
    stock: parseInteger(f.stock) ?? 0,
    lowStock: parseInteger(f.lowStock) ?? DEFAULT_LOW_STOCK,
    imageFile: f.imageFile,
  };
}

/** Up to 10 of the shop's brands containing what is typed (all of them when nothing is typed). */
export function brandSuggestions(brands: string[], typed: string): string[] {
  const q = typed.trim().toLowerCase();
  return brands
    .filter((b) => b.toLowerCase() !== q && (q === '' || b.toLowerCase().includes(q)))
    .slice(0, 10);
}
