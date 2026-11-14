/** Pure rules of the customers and debts screens. */
import {
  validBirthday,
  type Customer,
  type CustomerDetails,
  type CustomerInput,
  type Gender,
  type Heard,
} from '@/domain/customers';
import { MONTH_NAMES } from '@/lib/dates';
import { RuleError } from '@/domain/context';
import { spendRange } from '@/domain/rewards';
import { parseThousandths } from '@/lib/digits';
import { formatLyd } from '@/lib/money';

/** "عليه 250 د.ل", "له رصيد 50 د.ل", or null when nothing is owed either way. */
export function balanceText(balance: number): string | null {
  if (balance > 0) return `عليه ${formatLyd(balance)}`;
  if (balance < 0) return `له رصيد ${formatLyd(-balance)}`;
  return null;
}

/** The optional details (G1) as typed: the birthday as text, the rest as chosen. */
export type DetailsForm = {
  birthDay: string;
  birthMonth: string;
  heard: Heard | null;
  ringSize: string;
  metal: string | null;
  colours: string;
  offers: boolean;
};

export const emptyDetailsForm = (): DetailsForm => ({
  birthDay: '',
  birthMonth: '',
  heard: null,
  ringSize: '',
  metal: null,
  colours: '',
  offers: false,
});

export const detailsFormFrom = (c?: CustomerDetails): DetailsForm => ({
  birthDay: c?.birthDay ? String(c.birthDay) : '',
  birthMonth: c?.birthMonth ? String(c.birthMonth) : '',
  heard: c?.heard ?? null,
  ringSize: c?.ringSize ?? '',
  metal: c?.metal ?? null,
  colours: c?.colours ?? '',
  offers: c?.offers ?? false,
});

const num = (t: string) => (t.trim() ? Number(t) : null);

/** The details to save, or the reason they can't be (a half or impossible birthday). */
export function detailsFromForm(
  f: DetailsForm,
): { ok: true; details: CustomerDetails } | { ok: false; message: string } {
  const day = num(f.birthDay);
  const month = num(f.birthMonth);
  if ((day || month) && !validBirthday(month, day))
    return { ok: false, message: 'تاريخ الميلاد غير صحيح: اكتب اليوم (1-31) والشهر (1-12).' };
  return {
    ok: true,
    details: {
      birthDay: day || null,
      birthMonth: month || null,
      heard: f.heard,
      ringSize: f.ringSize.trim() || null,
      metal: f.metal,
      colours: f.colours.trim() || null,
      offers: f.offers,
    },
  };
}

/** "مارس" under the month field, or nothing until a real month is typed. */
export function monthHint(text: string): string | undefined {
  const m = Number(text);
  return Number.isInteger(m) && m >= 1 && m <= 12 ? MONTH_NAMES[m - 1] : undefined;
}

/** Something was typed or chosen in the details (checkout sends them only then). */
export const detailsTouched = (f: DetailsForm) =>
  !!(f.birthDay || f.birthMonth || f.heard || f.ringSize || f.metal || f.colours || f.offers);

export type CustomerForm = {
  name: string;
  phone: string;
  area: string;
  notes: string;
  gender: Gender | null;
  imageFile: string | null;
  details: DetailsForm;
};

export const customerFormFrom = (c?: Customer): CustomerForm => ({
  name: c?.name ?? '',
  phone: c?.phone ?? '',
  area: c?.area ?? '',
  notes: c?.notes ?? '',
  gender: c?.gender ?? null,
  imageFile: c?.imageFile ?? null,
  details: detailsFormFrom(c),
});

/** The input to save; the details as checked by `detailsFromForm` (it throws on a bad birthday). */
export function customerFormToInput(f: CustomerForm, id?: number): CustomerInput {
  const d = detailsFromForm(f.details);
  if (!d.ok) throw new RuleError(d.message);
  return {
    id,
    name: f.name,
    phone: f.phone,
    area: f.area,
    notes: f.notes,
    gender: f.gender,
    imageFile: f.imageFile,
    ...d.details,
  };
}

/** How a debt payment was received. */
export const PAYMENT_WAYS = [
  { value: 'cash', label: 'كاش' },
  { value: 'card', label: 'بطاقة' },
  { value: 'transfer', label: 'تحويل' },
] as const;
export type PaymentWay = (typeof PAYMENT_WAYS)[number]['value'];
export const paymentWayLabel = (m: string) => PAYMENT_WAYS.find((w) => w.value === m)?.label ?? m;

/** The payment form: the amount typed, never more than what is owed. */
export function checkPayment(
  amountText: string,
  owed: number,
  /** Paying back what the shop owes the customer (`owed` is then that amount). */
  back = false,
): { ok: true; amount: number } | { ok: false; message: string } {
  const amount = parseThousandths(amountText);
  if (amount === null || amount <= 0)
    return { ok: false, message: back ? 'يرجى إدخال المبلغ المردود' : 'يرجى إدخال مبلغ الدفعة' };
  if (amount > owed)
    return {
      ok: false,
      message: back
        ? `المبلغ أكبر من رصيد الزبون (${formatLyd(owed)})`
        : `المبلغ أكبر من المستحق على الزبون (${formatLyd(owed)})`,
    };
  return { ok: true, amount };
}

/** The spending as this person may see it: the exact total, or only a range (G1). */
export const spendText = (amount: number, exact: boolean, ranges: readonly number[]) =>
  exact ? (amount > 0 ? formatLyd(amount) : 'لا مشتريات') : spendRange(amount, ranges);

/** "3 زيارات", "زيارة واحدة", "زيارتان", "لم يشترِ بعد". */
export function visitsText(visits: number): string {
  if (visits <= 0) return 'لم يشترِ بعد';
  if (visits === 1) return 'زيارة واحدة';
  if (visits === 2) return 'زيارتان';
  if (visits <= 10) return `${visits} زيارات`;
  return `${visits} زيارة`;
}
