/**
 * Every permission in the app, and the one table that says which role has it (phase S2).
 *
 * The code asks "may this person do `sales.delete`?", never "is this an employee?". The owner
 * has every permission. An employee has only what EMPLOYEE_MAY says `true` for: a new permission
 * must be added there with a value, or the app doesn't build (the table is a full Record), and it
 * starts as `false` (deny by default) until it is given to employees on purpose.
 */
import type { Actor } from './model';

export const PERMISSIONS = {
  // Changing data (checked as the first line of the business rule).
  'sales.create': 'البيع',
  'sales.delete': 'حذف بيع',
  'returns.create': 'تسجيل مرتجع',
  'returns.delete': 'حذف مرتجع',
  'returns.noSale': 'مرتجع بدون فاتورة',
  'returns.charge': 'تحميل المرتجع على الموظف',
  'staff.ledger': 'حساب الموظف',
  'receipts.create': 'إصدار إيصال',
  'receipts.edit': 'تعديل إيصال',
  'receipts.delete': 'حذف إيصال',
  'customers.edit': 'إضافة وتعديل الزبائن',
  'customers.delete': 'حذف زبون',
  'payments.create': 'تسجيل دفعة دين',
  'payments.delete': 'حذف دفعة',
  'payouts.create': 'رد رصيد الزبون',
  'products.edit': 'إضافة وتعديل المنتجات',
  'stock.adjust': 'تعديل المخزون',
  'sets.edit': 'إدارة الأطقم',
  'expenses.edit': 'المصروفات',
  'closing.edit': 'الإقفال الربعي',
  'settings.edit': 'الإعدادات وسعر الصرف',
  'shifts.open': 'فتح الوردية',
  'shifts.close': 'إغلاق الوردية',
  'cash.move': 'إدخال وإخراج النقد',
  'stock.count': 'جرد المخزون',
  'alerts.manage': 'تنبيهات المالك',
  'backup.restore': 'استرجاع نسخة احتياطية',
  'loyalty.adjust': 'تعديل نقاط الولاء',
  'customers.vip': 'تحديد زبون VIP',
  'customers.merge': 'دمج الزبائن المكررين',
  // Seeing (checked by the screens).
  'costs.view': 'التكلفة والربح',
  'reports.view': 'ملخص الشهر والتقارير',
  'sales.viewAll': 'مبيعات الآخرين',
  'expenses.view': 'عرض المصروفات',
  'backup.manage': 'النسخ الاحتياطي',
  'staff.manage': 'الموظفون',
  'log.view': 'سجل النشاط',
  'shifts.view': 'تقارير الورديات',
  'counts.view': 'نتائج الجرد',
  'customers.phones': 'رؤية أرقام الزبائن',
  'customers.spend': 'رؤية مجموع مشتريات الزبون',
} as const;

export type Permission = keyof typeof PERMISSIONS;

/** What an employee may do. Everything else belongs to the owner only. */
export const EMPLOYEE_MAY: Record<Permission, boolean> = {
  'sales.create': true,
  'sales.delete': false,
  // Within the return window, every condition "yes" and a photo (S4); past them, the owner.
  'returns.create': true,
  'returns.delete': false,
  'returns.noSale': false,
  'returns.charge': false,
  'staff.ledger': false,
  'receipts.create': true,
  // Choosing the design and hiding prices after a sale edits its receipt.
  'receipts.edit': true,
  'receipts.delete': false,
  'customers.edit': true,
  'customers.delete': false,
  'payments.create': true,
  'payments.delete': false,
  // Money out of the drawer to a customer the shop owes: the owner.
  'payouts.create': false,
  'products.edit': false,
  'stock.adjust': false,
  'sets.edit': false,
  'expenses.edit': false,
  'closing.edit': false,
  'settings.edit': false,
  // Each person opens and closes their own shift, with cash moves inside it (S5).
  'shifts.open': true,
  'shifts.close': true,
  'cash.move': true,
  // Anyone counts the pieces (blind); only the owner sees the differences and applies them (S6).
  'stock.count': true,
  'alerts.manage': false,
  'backup.restore': false,
  'loyalty.adjust': false,
  'customers.vip': false,
  'customers.merge': false,
  'costs.view': false,
  'reports.view': false,
  'sales.viewAll': false,
  'expenses.view': false,
  'backup.manage': false,
  'staff.manage': false,
  'log.view': false,
  'shifts.view': false,
  'counts.view': false,
  // Shown as 091•••4567; the owner can give it to a trusted employee (feature 26).
  'customers.phones': false,
  // An employee sees a range ("أكثر من 2000 د.ل"), never the exact total (G1); grantable.
  'customers.spend': false,
};

/**
 * What the owner may give to one employee on the staff screen, on top of EMPLOYEE_MAY. Each
 * employee's grants are kept with them in the staff list (staff/model.ts).
 */
export const GRANTABLE: Partial<Record<Permission, true>> = {
  'customers.phones': true,
  'customers.spend': true,
};

let grantsOf: (employeeId: string) => readonly string[] = () => [];
/** The staff store tells this file who was given what (kept apart so this file stays pure). */
export function setGrantsLookup(lookup: (employeeId: string) => readonly string[]) {
  grantsOf = lookup;
}

/** The permissions that change data: the clock guard applies to these, never to reading. */
export const WRITES: Partial<Record<Permission, true>> = Object.fromEntries(
  (Object.keys(PERMISSIONS) as Permission[])
    .slice(0, Object.keys(PERMISSIONS).indexOf('costs.view'))
    .map((p) => [p, true]),
);

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** True when this person may do it. Nobody signed in (or an unknown permission) may do nothing. */
export function can(actor: Actor | null | undefined, permission: Permission): boolean {
  if (!actor || !(permission in PERMISSIONS)) return false;
  if (actor.kind === 'owner') return true;
  if (actor.kind === 'employee')
    return (
      EMPLOYEE_MAY[permission] === true ||
      (GRANTABLE[permission] === true && grantsOf(actor.id).includes(permission))
    );
  return false;
}

/** The Arabic refusal shown when someone tries what they may not do. */
export function refusal(actor: Actor | null | undefined, permission: Permission): string {
  if (!actor) return 'سجّل الدخول أولاً.';
  return `${PERMISSIONS[permission]}: للمالك فقط.`;
}
