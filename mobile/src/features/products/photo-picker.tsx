import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Button, Text } from '@/components';
import { newPhotoName } from '@/domain/photos';
import type { Ctx } from '@/domain/context';
import { pickPhoto, type PhotoSource } from '@/lib/photos';
import { radius, spacing, useTheme } from '@/theme';

import { ProductPhoto } from './product-photo';

/**
 * A large photo (or a placeholder) with camera, library and remove buttons. Each new photo is
 * saved to its own file right away; `onPicked` gets the file name.
 */
export function PhotoPicker({
  ctx,
  imageFile,
  onPicked,
  onRemove,
  placeholder = 'أضف صورة واضحة للقطعة',
}: {
  ctx: Ctx;
  imageFile: string | null;
  onPicked: (file: string) => void;
  onRemove: () => void;
  placeholder?: string;
}) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState<PhotoSource | null>(null);

  const pick = async (source: PhotoSource) => {
    setBusy(source);
    try {
      const result = await pickPhoto(ctx.system, source, newPhotoName(ctx));
      if (result.status === 'picked') onPicked(result.file);
      else if (result.status === 'denied') Alert.alert('لا يوجد إذن', result.message);
    } catch {
      Alert.alert('تعذر حفظ الصورة', 'حاول مرة أخرى أو اختر صورة أخرى.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ alignItems: 'center' }}>
        {imageFile ? (
          <ProductPhoto system={ctx.system} imageFile={imageFile} size={200} rounded={radius.lg} />
        ) : (
          <View
            style={{
              alignSelf: 'stretch',
              height: 160,
              borderRadius: radius.lg,
              borderCurve: 'continuous',
              backgroundColor: colors.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs,
            }}>
            <ProductPhoto system={ctx.system} imageFile={null} size={56} />
            <Text variant="subhead" tone="secondary">
              {placeholder}
            </Text>
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button
          title="الكاميرا"
          icon="camera.fill"
          loading={busy === 'camera'}
          disabled={busy !== null}
          onPress={() => pick('camera')}
          style={{ flex: 1 }}
        />
        <Button
          title="الألبوم"
          icon="photo.on.rectangle"
          variant="secondary"
          loading={busy === 'library'}
          disabled={busy !== null}
          onPress={() => pick('library')}
          style={{ flex: 1 }}
          testID="photo-library"
        />
        {imageFile ? (
          <Button title="حذف الصورة" icon="trash" variant="destructive" onPress={onRemove} />
        ) : null}
      </View>
    </View>
  );
}
