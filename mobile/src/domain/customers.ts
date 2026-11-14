import { nameKey } from '@/lib/names';
import { latinDigits, sanitize } from '@/lib/digits';
import { MONTH_NAMES } from '@/lib/dates';

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
  /** The owner's choice (G1): always VIP or never VIP; null: worked out from what they spent. */
  vip: VipChoice | null;
  /**
   * When the birthday was last saved or changed (H1); null: before database 11, or no birthday.
   * The birthday discount needs it saved 30 days ahead, or the owner's approval.
   */
  birthdaySetAt: string | null;
} & CustomerDetails;

/** The optional details a customer gives (G1). Never the year of birth. */
export type CustomerDetails = {
  birthMonth: number | null;
  birthDay: number | null;
  heard: Heard | null;
  ringSize: string | null;
  metal: string | null;
  colours: string | null;
  /** Agreed to receive offer messages. */
  offers: boolean;
};

export type Gender = 'female' | 'male';
export const GENDER_LABELS: Record<Gender, string> = { female: 'أنثى', male: 'ذكر' };

/** How the customer heard about the shop: chosen from buttons, never typed. */
export const HEARD = ['facebook', 'instagram', 'tiktok', 'friend', 'other'] as const;
export type Heard = (typeof HEARD)[number];
export const HEARD_LABELS: Record<Heard, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  friend: 'صديق / زبون آخر',
  other: 'أخرى',
};

/** The metals a jewelry customer prefers. */
export const METALS = ['ذهب', 'فضة', 'الاثنين'] as const;

export type VipChoice = 'always' | 'never';

/** The note on a customer added by a sale; notes typed at checkout replace it. */
export const AUTO_NOTE = 'تمت الإضافة تلقائياً من نافذة البيع';

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** A real day of the year (29 February allowed), or null. */
export function validBirthday(month: number | null | undefined, day: number | null | undefined) {
  if (!month || !day) return null;
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12) return null;
  if (day < 1 || day > DAYS_IN_MONTH[month - 1]) return null;
  return { month, day };
}

/** "14 مارس": the birthday as it is shown (never a year). */
export function birthdayText(month: number | null, day: number | null): string | null {
  const b = validBirthday(month, day);
  return b ? `${b.day} ${MONTH_NAMES[b.month - 1]}` : null;
}

type Row = {
  id: number;
  name: string;
  phone: string | null;
  area: string | null;
  notes: string | null;
  gender?: string | null;
  image_file?: string | null;
  created_at: string;
  birth_month?: number | null;
  birth_day?: number | null;
  heard?: string | null;
  ring_size?: string | null;
  metal?: string | null;
  colours?: string | null;
  offers?: number | null;
  vip?: string | null;
  birthday_set_at?: string | null;
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
  birthMonth: r.birth_month ?? null,
  birthDay: r.birth_day ?? null,
  heard: (HEARD as readonly string[]).includes(r.heard ?? '') ? (r.heard as Heard) : null,
  ringSize: r.ring_size ?? null,
  metal: r.metal ?? null,
  colours: r.colours ?? null,
  offers: r.offers === 1,
  vip: r.vip === 'always' || r.vip === 'never' ? r.vip : null,
  birthdaySetAt: r.birthday_set_at ?? null,
});

/** Tidies the optional details; refuses a day that doesn't exist. Left out stays undefined. */
function cleanDetails(d: Partial<CustomerDetails>): Partial<CustomerDetails> {
  const out: Partial<CustomerDetails> = {};
  if (d.birthMonth !== undefined || d.birthDay !== undefined) {
    if (!d.birthMonth && !d.birthDay) {
      out.birthMonth = null;
      out.birthDay = null;
    } else {
      const b = validBirthday(d.birthMonth, d.birthDay);
      if (!b) throw new RuleError('تاريخ الميلاد غير صحيح: اختر اليوم والشهر.');
      out.birthMonth = b.month;
      out.birthDay = b.day;
    }
  }
  if (d.heard !== undefined) out.heard = d.heard && HEARD.includes(d.heard) ? d.heard : null;
  const text = (v: string | null | undefined, max: number) => {
    const t = clean(latinDigits(v ?? ''));
    if (t && t.length > max) throw new RuleError(`النص أطول من ${max} حرفاً.`);
    return t;
  };
  if (d.ringSize !== undefined) out.ringSize = text(d.ringSize, 10);
  if (d.metal !== undefined) out.metal = text(d.metal, 20);
  if (d.colours !== undefined) out.colours = text(d.colours, 100);
  if (d.offers !== undefined) out.offers = !!d.offers;
  return out;
}

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
} & Partial<CustomerDetails>;

const DETAIL_COLUMNS = {
  birthMonth: 'birth_month',
  birthDay: 'birth_day',
  heard: 'heard',
  ringSize: 'ring_size',
  metal: 'metal',
  colours: 'colours',
  offers: 'offers',
} as const satisfies Record<keyof CustomerDetails, string>;

const sqlValue = (v: string | number | boolean | null | undefined) =>
  typeof v === 'boolean' ? (v ? 1 : 0) : (v ?? null);

/** Adds or edits a customer. Refuses a phone number that belongs to another customer. */
export function saveCustomer(ctx: Ctx, input: CustomerInput): number {
  allow(ctx, 'customers.edit');
  const name = clean(input.name);
  if (!name) throw new RuleError('يرجى إدخال اسم الزبون');
  const details = cleanDetails(input);
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
      writeDetails(ctx, input.id, details);
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
    writeDetails(ctx, id, details);
    logAction(ctx, 'customer.add', `زبون جديد «${name}»`, { customerId: id });
    return id;
  });
}

/**
 * Writes the details given; the ones left out stay as they are. A new or changed birthday notes
 * when (H1), so one typed in just before it needs the owner for the birthday discount.
 */
function writeDetails(ctx: Ctx, id: number, d: Partial<CustomerDetails>) {
  const keys = (Object.keys(d) as (keyof CustomerDetails)[]).filter((k) => d[k] !== undefined);
  if (!keys.length) return;
  if (d.birthMonth !== undefined) {
    const old = ctx.db.get<{ m: number | null; d: number | null }>(
      'SELECT birth_month m, birth_day d FROM customers WHERE id = ?',
      [id],
    );
    if (old && (old.m !== d.birthMonth || old.d !== d.birthDay))
      ctx.db.run('UPDATE customers SET birthday_set_at = ? WHERE id = ?', [
        d.birthMonth ? nowStamp(ctx) : null,
        id,
      ]);
  }
  ctx.db.run(
    `UPDATE customers SET ${keys.map((k) => `${DETAIL_COLUMNS[k]} = ?`).join(', ')} WHERE id = ?`,
    [...keys.map((k) => sqlValue(d[k])), id],
  );
}

/** The owner marks a customer VIP or never VIP by hand, or back to automatic (null). Logged. */
export function setVip(ctx: Ctx, customerId: number, choice: VipChoice | null) {
  allow(ctx, 'customers.vip');
  const c = getCustomer(ctx, customerId);
  if (!c) throw new RuleError('الزبون غير موجود');
  ctx.db.run('UPDATE customers SET vip = ? WHERE id = ?', [choice, customerId]);
  const what = choice === 'always' ? 'VIP دائماً' : choice === 'never' ? 'ليس VIP' : 'VIP تلقائي';
  logAction(ctx, 'customer.vip', `«${c.name}»: ${what}`, { customerId, vip: choice });
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
  /** Given at checkout (G1): they only fill what the customer doesn't have yet. */
  extra: SaleCustomerDetails = {},
): number | null {
  const n = clean(name);
  const p = clean(phone);
  const key = phoneKey(p);
  const a = clean(area);
  if (!n && !key) return null;
  const details = cleanDetails(extra);
  const gender = extra.gender === 'female' || extra.gender === 'male' ? extra.gender : null;
  const notes = clean(extra.notes);

  const fillMissing = (c: Customer) => {
    ctx.db.run(
      'UPDATE customers SET phone = coalesce(phone, ?), phone_key = coalesce(phone_key, ?), area = coalesce(area, ?) WHERE id = ?',
      [key ? p : null, key, a, c.id],
    );
    // Details typed at checkout never change what is already saved (that is the customer page).
    const empty: Partial<CustomerDetails> = {};
    for (const k of Object.keys(details) as (keyof CustomerDetails)[]) {
      if (k === 'offers') {
        if (details.offers && !c.offers) empty.offers = true;
      } else if (k === 'birthMonth' || k === 'birthDay') {
        if (c.birthMonth === null && details.birthMonth) {
          empty.birthMonth = details.birthMonth;
          empty.birthDay = details.birthDay;
        }
      } else if (c[k] === null && details[k] !== null) {
        (empty as Record<string, unknown>)[k] = details[k];
      }
    }
    writeDetails(ctx, c.id, empty);
    if (gender && !c.gender)
      ctx.db.run('UPDATE customers SET gender = ? WHERE id = ?', [gender, c.id]);
    if (notes && (!c.notes || c.notes === AUTO_NOTE))
      ctx.db.run('UPDATE customers SET notes = ? WHERE id = ?', [notes, c.id]);
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
  const id = ctx.db.run(
    'INSERT INTO customers (name, name_key, phone, phone_key, area, notes, gender, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [newName, nameKey(newName), key ? p : null, key, a, notes ?? AUTO_NOTE, gender, nowStamp(ctx)],
  ).lastInsertRowId;
  writeDetails(ctx, id, details);
  return id;
}

/** What checkout can give about the customer (G1), besides name, phone and area. */
export type SaleCustomerDetails = Partial<CustomerDetails> & {
  gender?: Gender | null;
  notes?: string;
};
