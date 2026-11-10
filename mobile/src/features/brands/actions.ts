import * as Haptics from 'expo-haptics';
import { ActionSheetIOS, Alert } from 'react-native';

import {
  addBrand,
  deleteBrand,
  findBrand,
  renameBrand,
  setBrandImage,
  type Brand,
} from '@/domain/brands';
import type { Ctx } from '@/domain/context';
import { newPhotoName } from '@/domain/photos';
import { releasePhoto, showError } from '@/features/products/actions';
import { pickPhoto, type PhotoSource } from '@/lib/photos';
import { notifyDataChanged } from '@/state/data-events';

/** Adds a brand. Returns false (and says why) when the name is empty or already in the list. */
export function addBrandNamed(ctx: Ctx, name: string): boolean {
  const existing = findBrand(ctx, name);
  if (existing) {
    Alert.alert('الماركة موجودة', `«${existing.name}» موجودة في القائمة بالفعل.`);
    return false;
  }
  try {
    addBrand(ctx, name);
  } catch (error) {
    showError(error);
    return false;
  }
  Haptics.selectionAsync().catch(() => {});
  notifyDataChanged();
  return true;
}

/** Asks for the new name; every piece with this brand shows it. Past sales keep the old name. */
export function promptRename(ctx: Ctx, brand: Brand) {
  Alert.prompt(
    'تعديل اسم الماركة',
    'يتغير الاسم في كل القطع التي تحمل هذه الماركة. المبيعات السابقة تحتفظ بالاسم القديم.',
    [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حفظ',
        onPress: (name?: string) => {
          try {
            renameBrand(ctx, brand.id, name ?? '');
            notifyDataChanged();
          } catch (error) {
            showError(error);
          }
        },
      },
    ],
    'plain-text',
    brand.name,
  );
}

export function deleteBrandMessage(brand: Pick<Brand, 'productCount'>): string {
  return brand.productCount > 0
    ? `${brand.productCount} قطعة تحمل هذه الماركة وستصبح «بدون ماركة». المبيعات السابقة تحتفظ باسم الماركة.`
    : 'لا توجد قطع بهذه الماركة.';
}

export function confirmDeleteBrand(ctx: Ctx, brand: Brand) {
  Alert.alert(`حذف الماركة «${brand.name}»؟`, deleteBrandMessage(brand), [
    { text: 'إلغاء', style: 'cancel' },
    {
      text: 'حذف',
      style: 'destructive',
      onPress: () => {
        try {
          deleteBrand(ctx, brand.id);
          releasePhoto(ctx, brand.imageFile);
          notifyDataChanged();
        } catch (error) {
          showError(error);
        }
      },
    },
  ]);
}

async function choosePhoto(ctx: Ctx, brand: Brand, source: PhotoSource) {
  try {
    const result = await pickPhoto(ctx.system, source, newPhotoName(ctx));
    if (result.status === 'denied') Alert.alert('لا يوجد إذن', result.message);
    if (result.status !== 'picked') return;
    setBrandImage(ctx, brand.id, result.file);
    releasePhoto(ctx, brand.imageFile);
    notifyDataChanged();
  } catch {
    Alert.alert('تعذر حفظ الصورة', 'حاول مرة أخرى أو اختر صورة أخرى.');
  }
}

/** The shop's own picture for a brand (e.g. the logo from the box), or back to the badge. */
export function brandPhotoMenu(ctx: Ctx, brand: Brand) {
  const options = ['اختيار صورة من الألبوم', 'تصوير بالكاميرا'];
  if (brand.imageFile) options.push('إزالة الصورة (الرجوع للشارة)');
  options.push('إلغاء');
  ActionSheetIOS.showActionSheetWithOptions(
    {
      title: `صورة ماركة ${brand.name}`,
      options,
      cancelButtonIndex: options.length - 1,
      destructiveButtonIndex: brand.imageFile ? 2 : undefined,
    },
    (index) => {
      if (index === 0) choosePhoto(ctx, brand, 'library');
      else if (index === 1) choosePhoto(ctx, brand, 'camera');
      else if (index === 2 && brand.imageFile) {
        setBrandImage(ctx, brand.id, null);
        releasePhoto(ctx, brand.imageFile);
        notifyDataChanged();
      }
    },
  );
}

/** Long press on a brand: rename or delete. */
export function brandActions(ctx: Ctx, brand: Brand) {
  ActionSheetIOS.showActionSheetWithOptions(
    {
      title: brand.name,
      options: ['تعديل الاسم', 'تغيير الصورة', 'حذف الماركة', 'إلغاء'],
      cancelButtonIndex: 3,
      destructiveButtonIndex: 2,
    },
    (index) => {
      if (index === 0) promptRename(ctx, brand);
      else if (index === 1) brandPhotoMenu(ctx, brand);
      else if (index === 2) confirmDeleteBrand(ctx, brand);
    },
  );
}
