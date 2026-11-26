/**
 * The owner's phase L actions: the monthly target, the default bonus, the bonus on a slow piece,
 * paying an employee what the shop owes them, and adding a month's bonuses to the accounts. Each
 * asks for an amount, checks it, and shows an Arabic message when something is refused.
 */
import { Alert } from 'react-native';

import { RuleError, type Ctx } from '@/domain/context';
import { payEmployee } from '@/domain/staff-ledger';
import {
  creditBonuses,
  getGoals,
  setGoals,
  setProductBonus,
  type Person,
} from '@/domain/staff-goals';
import { parseThousandths } from '@/lib/digits';
import { haptic } from '@/lib/haptics';
import { editableDinars, formatLyd } from '@/lib/money';
import { notifyDataChanged } from '@/state/data-events';
import type { MonthKey } from '@/lib/dates';

function run(what: () => unknown, done?: () => void): boolean {
  try {
    what();
  } catch (error) {
    haptic.error();
    Alert.alert('لم يُحفظ', error instanceof RuleError ? error.message : 'حدث خطأ غير متوقع.');
    return false;
  }
  haptic.success();
  notifyDataChanged();
  done?.();
  return true;
}

/** Asks for an amount in dinars; empty is null when `emptyOk`. */
function askAmount(
  title: string,
  message: string,
  value: number | null,
  onAmount: (dirhams: number | null) => void,
  { emptyOk = false, button = 'حفظ' } = {},
) {
  Alert.prompt(
    title,
    message,
    [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: button,
        onPress: (typed?: string) => {
          const text = (typed ?? '').trim();
          if (!text && emptyOk) return onAmount(null);
          const amount = parseThousandths(text);
          if (amount === null) {
            haptic.error();
            Alert.alert('لم يُحفظ', 'اكتب المبلغ بالدينار، مثل 20 أو 12.5.');
            return;
          }
          if (amount === 0 && !emptyOk) {
            haptic.error();
            Alert.alert('لم يُحفظ', 'اكتب مبلغاً أكبر من صفر.');
            return;
          }
          onAmount(amount);
        },
      },
    ],
    'plain-text',
    value ? editableDinars(value) : '',
    'decimal-pad',
  );
}

export function editTargetFlow(ctx: Ctx, done: () => void) {
  askAmount(
    'هدف الشهر',
    'مبلغ واحد لكل موظف: مبيعاته في الشهر بعد طرح الإرجاع. اتركه فارغاً أو 0 لإيقاف الهدف.',
    getGoals(ctx).target,
    (amount) => run(() => setGoals(ctx, { target: amount ?? 0 }), done),
    { emptyOk: true },
  );
}

export function editBonusDefaultFlow(ctx: Ctx, done: () => void) {
  askAmount(
    'المكافأة المقترحة',
    'المبلغ الذي يُقترح عند وضع مكافأة على قطعة راكدة. يمكنك تغييره لكل قطعة.',
    getGoals(ctx).bonusDefault,
    (amount) => run(() => setGoals(ctx, { bonusDefault: amount ?? 0 }), done),
  );
}

/** A bonus on one piece: asks the amount (the suggested one first), or takes it off. */
export function productBonusFlow(
  ctx: Ctx,
  product: { id: number; name: string; bonus?: number | null },
  done: () => void,
) {
  const ask = () =>
    askAmount(
      `مكافأة على ${product.name}`,
      'يكسبها الموظف عن كل قطعة يبيعها، وتُخصم إن أُرجعت. لا تُحسب للمالك.',
      product.bonus ?? getGoals(ctx).bonusDefault,
      (amount) => run(() => setProductBonus(ctx, product.id, amount ?? 0), done),
    );
  if (!product.bonus) return ask();
  Alert.alert(product.name, `عليها مكافأة ${formatLyd(product.bonus)} للقطعة.`, [
    { text: 'تغيير المبلغ', onPress: ask },
    {
      text: 'إيقاف المكافأة',
      style: 'destructive',
      onPress: () => run(() => setProductBonus(ctx, product.id, null), done),
    },
    { text: 'إلغاء', style: 'cancel' },
  ]);
}

/**
 * Pays an employee their bonuses (never more than the shop owes them). The owner says whether the
 * cash comes from the drawer: then it is taken out of the open shift, so the count stays right.
 */
export function payEmployeeFlow(ctx: Ctx, person: Person, owed: number, done: () => void) {
  askAmount(
    `دفع مكافآت ${person.name}`,
    `له من المكافآت ${formatLyd(owed)}. كم دفعت له الآن؟`,
    owed,
    (amount) => {
      if (!amount) return;
      Alert.alert('من الدرج؟', `هل دفعت ${formatLyd(amount)} من نقد الدرج؟`, [
        {
          text: 'نعم، من الدرج',
          onPress: () => run(() => payEmployee(ctx, person, amount, { fromDrawer: true }), done),
        },
        {
          text: 'لا، من خارج الدرج',
          onPress: () => run(() => payEmployee(ctx, person, amount), done),
        },
        { text: 'إلغاء', style: 'cancel' },
      ]);
    },
    { button: 'التالي' },
  );
}

/** Adds an ended month's bonuses to the accounts, once per person. */
export function creditBonusesFlow(
  ctx: Ctx,
  month: MonthKey,
  label: string,
  people: Person[],
  done: () => void,
) {
  Alert.alert(
    'إضافة المكافآت إلى الحسابات',
    `تُضاف مكافأة ${label} إلى حساب كل موظف مرة واحدة، فتظهر «له» في حسابه حتى تدفعها له. وإن كان الإرجاع أكثر مما كسب، يُضاف الفرق «عليه».`,
    [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'إضافة',
        onPress: () => {
          let n = 0;
          if (run(() => (n = creditBonuses(ctx, month, people)), done))
            Alert.alert('تمت الإضافة', n ? `أضيفت مكافآت ${n} موظف.` : 'لا يوجد ما يضاف.');
        },
      },
    ],
  );
}
