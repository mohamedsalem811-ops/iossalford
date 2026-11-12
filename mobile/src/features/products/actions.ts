import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';

import { RuleError, type Ctx } from '@/domain/context';
import { photoInUse } from '@/domain/photos';
import { adjustStock, deleteProduct, productUsage, type Product } from '@/domain/products';
import { deletePhotoFile } from '@/lib/photos';
import { notifyDataChanged } from '@/state/data-events';

import { deleteMessage } from './model';
import { haptic } from '@/lib/haptics';

/** Shows a refused action's Arabic message (or a general one for an unexpected error). */
export function showError(error: unknown) {
  const message =
    error instanceof RuleError ? error.message : 'حدث خطأ غير متوقع، لم يُحفظ أي تغيير.';
  haptic.error();
  Alert.alert('لم يتم الحفظ', message, [{ text: 'حسناً' }]);
}

/** Removes a photo file once nothing shows it any more. A file left behind is harmless. */
export function releasePhoto(ctx: Ctx, file: string | null | undefined) {
  if (!file || photoInUse(ctx, file)) return;
  try {
    deletePhotoFile(ctx.system, file);
  } catch {
    // Only disk space is at stake.
  }
}

/** +1 or −1 from the list. Stock never goes below zero. */
export function stepStock(ctx: Ctx, p: Product, delta: 1 | -1) {
  try {
    adjustStock(ctx, p.id, delta, delta > 0 ? 'زيادة سريعة من القائمة' : 'إنقاص سريع من القائمة');
    Haptics.selectionAsync().catch(() => {});
    notifyDataChanged();
  } catch (error) {
    showError(error);
  }
}

/**
 * Asks before deleting. A piece that was ever sold is archived instead (its sales, receipts and
 * reports stay as they were); the message says so.
 */
export function confirmDelete(ctx: Ctx, p: Product) {
  Alert.alert(`حذف «${p.name}»؟`, deleteMessage(p, productUsage(ctx, p.id)), [
    { text: 'إلغاء', style: 'cancel' },
    {
      text: 'حذف',
      style: 'destructive',
      onPress: () => {
        try {
          deleteProduct(ctx, p.id);
          releasePhoto(ctx, p.imageFile);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          notifyDataChanged();
        } catch (error) {
          showError(error);
        }
      },
    },
  ]);
}
