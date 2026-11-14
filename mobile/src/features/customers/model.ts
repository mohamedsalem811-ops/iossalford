/** Pure rules of the customers and debts screens. */
import type { Customer, CustomerInput, Gender } from '@/domain/customers';
import { parseThousandths } from '@/lib/digits';
import { formatLyd } from '@/lib/money';

/** "عليه 250 د.ل", "له رصيد 50 د.ل", or null when nothing is owed either way. */
export function balanceText(balance: number): string | null {
  if (balance > 0) return `عليه ${formatLyd(balance)}`;
  if (balance < 0) return `له رصيد ${formatLyd(-balance)}`;
  return null;
}

export type CustomerForm = {
  name: string;
  phone: string;
  area: string;
  notes: string;
  gender: Gender | null;
  imageFile: string | null;
};

export const customerFormFrom = (c?: Customer): CustomerForm => ({
  name: c?.name ?? '',
  phone: c?.phone ?? '',
  area: c?.area ?? '',
  notes: c?.notes ?? '',
  gender: c?.gender ?? null,
  imageFile: c?.imageFile ?? null,
});

export const customerFormToInput = (f: CustomerForm, id?: number): CustomerInput => ({
  id,
  name: f.name,
  phone: f.phone,
  area: f.area,
  notes: f.notes,
  gender: f.gender,
  imageFile: f.imageFile,
});

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
