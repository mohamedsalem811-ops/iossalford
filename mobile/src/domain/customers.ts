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
  createdAt: string;
};

type Row = {
  id: number;
  name: string;
  phone: string | null;
  area: string | null;
  notes: string | null;
  created_at: string;
};
const toCustomer = (r: Row): Customer => ({
  id: r.id,
  name: r.name,
  phone: r.phone,
  area: r.area,
  notes: r.notes,
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

export function listCustomers(ctx: Ctx, search = ''): Customer[] {
  const q = clean(latinDigits(search));
  if (!q)
    return ctx.db.all<Row>('SELECT * FROM customers ORDER BY name COLLATE NOCASE').map(toCustomer);
  const digits = sanitize(q, 'integer');
  return ctx.db
    .all<Row>(
      `SELECT * FROM customers WHERE name LIKE ? OR (? <> '' AND phone_key LIKE ?) OR area LIKE ? ORDER BY name COLLATE NOCASE`,
      [`%${q}%`, digits, `%${digits.replace(/^0+/, '')}%`, `%${q}%`],
    )
    .map(toCustomer);
}

/** Customers whose name or phone contains what is being typed (at least 2 letters / 3 digits). */
export function customerSuggestions(ctx: Ctx, text: string, limit = 4): Customer[] {
  const q = nameKey(text);
  if (q.length < 2) return [];
  const digits = sanitize(q, 'integer');
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
      ctx.db.run(
        'UPDATE customers SET name = ?, name_key = ?, phone = ?, phone_key = ?, area = ?, notes = ? WHERE id = ?',
        [name, nameKey(name), phone, key, clean(input.area), clean(input.notes), input.id],
      );
      logAction(ctx, 'customer.edit', `تعديل بيانات الزبون «${name}»`, { customerId: input.id });
      return input.id;
    }
    const id = ctx.db.run(
      'INSERT INTO customers (name, name_key, phone, phone_key, area, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, nameKey(name), phone, key, clean(input.area), clean(input.notes), nowStamp(ctx)],
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
