import { Alert } from 'react-native';

import type { Ctx } from '@/domain/context';
import { deleteProduct, listProducts } from '@/domain/products';
import { deleteScarfDesign, groupDesigns, type ScarfDesign } from '@/domain/scarves';
import { releasePhoto, showError } from '@/features/products/actions';
import { notifyDataChanged } from '@/state/data-events';

import { deleteDesignMessage } from './model';
import { haptic } from '@/lib/haptics';

/** A design by its id (a scarf saved without a design is "single-<product id>"). */
export function findDesign(ctx: Ctx, id: string): ScarfDesign | undefined {
  return groupDesigns(listProducts(ctx)).find((d) => d.id === id);
}

/** The stored design id, or undefined for a scarf that has none yet. */
export function storedDesignId(id: string): string | undefined {
  return id.startsWith('single-') ? undefined : id;
}

/** Asks, then deletes every size of the design (sizes that were sold are archived). */
export function confirmDeleteDesign(ctx: Ctx, d: ScarfDesign) {
  Alert.alert(`حذف تصميم «${d.name}»؟`, deleteDesignMessage(d), [
    { text: 'إلغاء', style: 'cancel' },
    {
      text: 'حذف',
      style: 'destructive',
      onPress: () => {
        try {
          const id = storedDesignId(d.id);
          if (id) deleteScarfDesign(ctx, id);
          else d.sizes.forEach((s) => deleteProduct(ctx, s.id));
          new Set(d.sizes.map((s) => s.imageFile)).forEach((f) => releasePhoto(ctx, f));
          haptic.success();
          notifyDataChanged();
        } catch (error) {
          showError(error);
        }
      },
    },
  ]);
}
