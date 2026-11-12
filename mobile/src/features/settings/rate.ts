import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';

import type { Ctx } from '@/domain/context';
import { getRate, setRate } from '@/domain/settings';
import { showError } from '@/features/products/actions';
import { parseThousandths } from '@/lib/digits';
import { formatRate } from '@/lib/money';
import { notifyDataChanged } from '@/state/data-events';
import { haptic } from '@/lib/haptics';

/** The typed rate in thousandths ("7.125" → 7125, Arabic digits too), or why it is refused. */
export function checkRate(text: string): { rate: number } | { error: string } {
  const rate = parseThousandths(text);
  if (rate === null || rate <= 0) return { error: 'اكتب سعر الدولار بالدينار، مثل 7.125' };
  return { rate };
}

/**
 * Asks for the dollar rate. New dollar costs use it; pieces already saved keep the rate they
 * were bought at.
 */
export function promptRate(ctx: Ctx, onSaved: () => void) {
  Alert.prompt(
    'سعر الصرف',
    'كم ديناراً للدولار الواحد؟ يُستخدم للتكاليف الجديدة بالدولار، والقطع المحفوظة تحتفظ بسعرها.',
    [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حفظ',
        onPress: (text?: string) => {
          const r = checkRate(text ?? '');
          if ('error' in r) {
            haptic.error();
            Alert.alert('لم يتم الحفظ', r.error, [{ text: 'حسناً' }]);
            return;
          }
          try {
            setRate(ctx, r.rate);
          } catch (error) {
            showError(error);
            return;
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          notifyDataChanged();
          onSaved();
        },
      },
    ],
    'plain-text',
    formatRate(getRate(ctx)),
    'decimal-pad',
  );
}
