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
  'receipts.create': 'إصدار إيصال',
  'receipts.edit': 'تعديل إيصال',
  'receipts.delete': 'حذف إيصال',
  'customers.edit': 'إضافة وتعديل الزبائن',
  'customers.delete': 'حذف زبون',
  'payments.create': 'تسجيل دفعة دين',
  'payments.delete': 'حذف دفعة',
  'products.edit': 'إضافة وتعديل المنتجات',
  'stock.adjust': 'تعديل المخزون',
  'sets.edit': 'إدارة الأطقم',
  'expenses.edit': 'المصروفات',
  'closing.edit': 'الإقفال الربعي',
  'settings.edit': 'الإعدادات وسعر الصرف',
  'backup.restore': 'استرجاع نسخة احتياطية',
  // Seeing (checked by the screens).
  'costs.view': 'التكلفة والربح',
  'reports.view': 'ملخص الشهر والتقارير',
  'sales.viewAll': 'مبيعات الآخرين',
  'expenses.view': 'عرض المصروفات',
  'backup.manage': 'النسخ الاحتياطي',
  'staff.manage': 'الموظفون',
} as const;

export type Permission = keyof typeof PERMISSIONS;

/** What an employee may do. Everything else belongs to the owner only. */
export const EMPLOYEE_MAY: Record<Permission, boolean> = {
  'sales.create': true,
  'sales.delete': false,
  // Returns open to employees in S4, with the 24 hours, the conditions and the photo.
  'returns.create': false,
  'returns.delete': false,
  'receipts.create': true,
  // Choosing the design and hiding prices after a sale edits its receipt.
  'receipts.edit': true,
  'receipts.delete': false,
  'customers.edit': true,
  'customers.delete': false,
  'payments.create': true,
  'payments.delete': false,
  'products.edit': false,
  'stock.adjust': false,
  'sets.edit': false,
  'expenses.edit': false,
  'closing.edit': false,
  'settings.edit': false,
  'backup.restore': false,
  'costs.view': false,
  'reports.view': false,
  'sales.viewAll': false,
  'expenses.view': false,
  'backup.manage': false,
  'staff.manage': false,
};

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** True when this person may do it. Nobody signed in (or an unknown permission) may do nothing. */
export function can(actor: Actor | null | undefined, permission: Permission): boolean {
  if (!actor || !(permission in PERMISSIONS)) return false;
  if (actor.kind === 'owner') return true;
  if (actor.kind === 'employee') return EMPLOYEE_MAY[permission] === true;
  return false;
}

/** The Arabic refusal shown when someone tries what they may not do. */
export function refusal(actor: Actor | null | undefined, permission: Permission): string {
  if (!actor) return 'سجّل الدخول أولاً.';
  return `${PERMISSIONS[permission]}: للمالك فقط.`;
}
