import { useRef, useState } from 'react';
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

  // Apple's picker can close without handing the photo over (seen on the simulator), and then
  // the pick never ends. So the buttons are never locked: picking again replaces a pick still
  // waiting, and only the newest pick's result is used.
  const latest = useRef(0);

  const pick = async (source: PhotoSource) => {
    const id = ++latest.current;
    setBusy(source);
    try {
      const result = await pickPhoto(ctx.system, source, newPhotoName(ctx));
      if (id !== latest.current) return;
      if (result.status === 'picked') onPicked(result.file);
      else if (result.status === 'denied') Alert.alert('لا يوجد إذن', result.message);
    } catch {
      if (id === latest.current) {
        Alert.alert('تعذر حفظ الصورة', 'حاول مرة أخرى أو اختر صورة أخرى.');
      }
    } finally {
      if (id === latest.current) setBusy(null);
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
          onPress={() => pick('camera')}
          style={{ flex: 1 }}
        />
        <Button
          title="الألبوم"
          icon="photo.on.rectangle"
          variant="secondary"
          onPress={() => pick('library')}
          style={{ flex: 1 }}
          testID="photo-library"
        />
        {imageFile ? (
          <Button title="حذف الصورة" icon="trash" variant="destructive" onPress={onRemove} />
        ) : null}
      </View>
      {busy ? (
        <Text variant="caption" tone="secondary" center>
          جارٍ تجهيز الصورة…
        </Text>
      ) : null}
    </View>
  );
}
