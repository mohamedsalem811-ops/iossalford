import { nameKey } from '@/lib/names';
import { latinDigits, sanitize } from '@/lib/digits';

import { allow, clean, nowStamp, RuleError, type Ctx } from './context';
import { logAction } from './activity';

export type Customer = {
  id: number;
  name: string;
  phone: string | null;
  area: string | null;
  notes: string | null;
  /** For the portrait when there is no photo (feature 30): أنثى / ذكر, or not said. */
  gender: Gender | null;
  /** A real photo of the customer, in the system's photo folder. */
  imageFile: string | null;
  createdAt: string;
};

export type Gender = 'female' | 'male';
export const GENDER_LABELS: Record<Gender, string> = { female: 'أنثى', male: 'ذكر' };

type Row = {
  id: number;
  name: string;
  phone: string | null;
  area: string | null;
  notes: string | null;
  gender?: string | null;
  image_file?: string | null;
  created_at: string;
};
const toCustomer = (r: Row): Customer => ({
  id: r.id,
  name: r.name,
  phone: r.phone,
  area: r.area,
  notes: r.notes,
  gender: r.gender === 'female' || r.gender === 'male' ? r.gender : null,
  imageFile: r.image_file ?? null,
  createdAt: r.created_at,
});

/**
 * A phone number reduced to its national digits, so "0912345678", "+218 91 234 5678" and
 * "00218912345678" are the same customer. null when it is too short to identify anyone.
 */
export function phoneKey(phone: string | null | undefined): string | null {
  let digits = sanitize(phone ?? '', 'integer');
  if (digits.startsWith('00218')) digits = digits.slice(5);
  else if (digits.startsWith('218') && digits.length > 9) digits = digits.slice(3);
  digits = digits.replace(/^0+/, '');
  return digits.length >= 6 ? digits : null;
}

/** A name compared without case or extra spaces. */
export { nameKey };

export function getCustomer(ctx: Ctx, id: number): Customer | undefined {
  const r = ctx.db.get<Row>('SELECT * FROM customers WHERE id = ?', [id]);
  return r ? toCustomer(r) : undefined;
}

export function customerByPhone(ctx: Ctx, phone: string): Customer | undefined {
  const key = phoneKey(phone);
  if (!key) return undefined;
  const r = ctx.db.get<Row>('SELECT * FROM customers WHERE phone_key = ?', [key]);
  return r ? toCustomer(r) : undefined;
}

/**
 * A phone number for someone who may not see it (feature 26): the first 3 and last 4 digits,
 * "091•••4567", enough to tell two customers apart. A short number keeps only its last 2.
 */
export function maskPhone(phone: string | null | undefined): string | null {
  const digits = sanitize(phone ?? '', 'integer');
  if (!digits) return null;
  if (digits.length >= 8) return `${digits.slice(0, 3)}•••${digits.slice(-4)}`;
  return `•••${digits.slice(-2)}`;
}

/** A name with any phone number in it masked ("زبون 091•••4567"), for the same people. */
export const shownName = (name: string, full: boolean) =>
  full ? name : name.replace(/[0-9٠-٩۰-۹]{6,}/g, (n) => maskPhone(n) ?? n);

/** The phone as this person may see it: in full, or masked. */
export const shownPhone = (phone: string | null | undefined, full: boolean) =>
  full ? phone || null : maskPhone(phone);

/**
 * Customers by name, area or phone. `fullPhones` false (an employee who may not see the numbers):
 * a phone finds its customer only when typed in full, so part of a number can't list them all.
 */
export function listCustomers(ctx: Ctx, search = '', fullPhones = true): Customer[] {
  const q = clean(latinDigits(search));
  if (!q)
    return ctx.db.all<Row>('SELECT * FROM customers ORDER BY name COLLATE NOCASE').map(toCustomer);
  const digits = sanitize(q, 'integer');
  const key = fullPhones ? `%${digits.replace(/^0+/, '')}%` : (phoneKey(digits) ?? '');
  // A customer added from a sale by phone only is named "زبون 0912345678": part of a number
  // must not find it by its name either.
  const byName = fullPhones || !/\d{3}/.test(q) ? 1 : 0;
  return ctx.db
    .all<Row>(
      `SELECT * FROM customers WHERE (? AND name LIKE ?) OR (? <> '' AND phone_key LIKE ?) OR area LIKE ? ORDER BY name COLLATE NOCASE`,
      [byName, `%${q}%`, fullPhones ? digits : key, key, `%${q}%`],
    )
    .map(toCustomer);
}

/** Customers whose name or phone contains what is being typed (at least 2 letters / 3 digits). */
export function customerSuggestions(
  ctx: Ctx,
  text: string,
  limit = 4,
  fullPhones = true,
): Customer[] {
  const q = nameKey(text);
  if (q.length < 2) return [];
  const digits = sanitize(q, 'integer');
  // Someone who may not see the numbers finds a customer by phone only with the whole number.
  if (!fullPhones && digits.length >= 3) {
    const c = customerByPhone(ctx, digits);
    return c ? [c] : [];
  }
  // The name is matched in the database (name_key); the phone, when digits are typed, here.
  return ctx.db
    .all<Row>(
      `SELECT * FROM customers WHERE instr(name_key, ?) > 0 OR (? AND phone IS NOT NULL)
       ORDER BY id DESC`,
      [q, digits.length >= 3 ? 1 : 0],
    )
    .map(toCustomer)
    .filter(
      (c) =>
        nameKey(c.name).includes(q) ||
        (digits.length >= 3 && sanitize(c.phone ?? '', 'integer').includes(digits)),
    )
    .slice(0, limit);
}

export type CustomerInput = {
  id?: number;
  name: string;
  phone?: string;
  area?: string;
  notes?: string;
  /** Left out on an edit: kept as it is; null: not said. */
  gender?: Gender | null;
  /** Left out on an edit: kept as it is; null: no photo. */
  imageFile?: string | null;
};

/** Adds or edits a customer. Refuses a phone number that belongs to another customer. */
export function saveCustomer(ctx: Ctx, input: CustomerInput): number {
  allow(ctx, 'customers.edit');
  const name = clean(input.name);
  if (!name) throw new RuleError('يرجى إدخال اسم الزبون');
  const phone = clean(input.phone);
  const key = phoneKey(phone);
  if (key) {
    const other = ctx.db.get<{ id: number; name: string }>(
      'SELECT id, name FROM customers WHERE phone_key = ?',
      [key],
    );
    if (other && other.id !== input.id)
      throw new RuleError(`رقم الهاتف مسجل مسبقاً للزبون «${other.name}»`);
  }
  return ctx.db.transaction(() => {
    if (input.id) {
      const old = getCustomer(ctx, input.id);
      if (!old) throw new RuleError('الزبون غير موجود');
      ctx.db.run(
        'UPDATE customers SET name = ?, name_key = ?, phone = ?, phone_key = ?, area = ?, notes = ?, gender = ?, image_file = ? WHERE id = ?',
        [
          name,
          nameKey(name),
          phone,
          key,
          clean(input.area),
          clean(input.notes),
          input.gender === undefined ? old.gender : input.gender,
          input.imageFile === undefined ? old.imageFile : input.imageFile,
          input.id,
        ],
      );
      logAction(ctx, 'customer.edit', `تعديل بيانات الزبون «${name}»`, { customerId: input.id });
      return input.id;
    }
    const id = ctx.db.run(
      'INSERT INTO customers (name, name_key, phone, phone_key, area, notes, gender, image_file, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        name,
        nameKey(name),
        phone,
        key,
        clean(input.area),
        clean(input.notes),
        input.gender ?? null,
        input.imageFile ?? null,
        nowStamp(ctx),
      ],
    ).lastInsertRowId;
    logAction(ctx, 'customer.add', `زبون جديد «${name}»`, { customerId: id });
    return id;
  });
}

/** Something to identify a customer by: a name or a usable phone number. */
export function hasIdentity(name: string | undefined, phone: string | undefined): boolean {
  return !!clean(name) || !!phoneKey(phone);
}

/**
 * Finds the customer for a sale, or creates one. The phone number decides first; the name is
 * used only when it can't conflict (that customer has no different phone on file), so two
 * different people with the same name are not merged. null when nothing identifies anyone.
 */
export function ensureCustomer(
  ctx: Ctx,
  name?: string,
  phone?: string,
  area?: string,
): number | null {
  const n = clean(name);
  const p = clean(phone);
  const key = phoneKey(p);
  const a = clean(area);
  if (!n && !key) return null;

  const fillMissing = (c: Customer) => {
    ctx.db.run(
      'UPDATE customers SET phone = coalesce(phone, ?), phone_key = coalesce(phone_key, ?), area = coalesce(area, ?) WHERE id = ?',
      [key ? p : null, key, a, c.id],
    );
    return c.id;
  };

  if (key) {
    const byPhone = customerByPhone(ctx, p!);
    if (byPhone) return fillMissing(byPhone);
  }
  if (n) {
    // The newest customer with this name (by its index), when the phones don't disagree.
    const sameName = ctx.db.get<Row>(
      `SELECT * FROM customers WHERE name_key = ? AND (phone IS NULL OR ? IS NULL)
       ORDER BY id DESC LIMIT 1`,
      [nameKey(n), key],
    );
    if (sameName) return fillMissing(toCustomer(sameName));
  }
  const newName = n ?? `زبون ${p}`;
  return ctx.db.run(
    'INSERT INTO customers (name, name_key, phone, phone_key, area, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      newName,
      nameKey(newName),
      key ? p : null,
      key,
      a,
      'تمت الإضافة تلقائياً من نافذة البيع',
      nowStamp(ctx),
    ],
  ).lastInsertRowId;
}
