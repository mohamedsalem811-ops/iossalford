import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';

import { Button, EmptyState, Text } from '@/components';
import { getProduct } from '@/domain/products';
import { productDetails } from '@/features/products/model';
import { formatLyd } from '@/lib/money';
import { photoUri } from '@/lib/photos';
import { radius, spacing, useTheme } from '@/theme';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';

/** A product's photo, large, pinch to zoom; with its name, price and a way to edit it. */
export default function PhotoRoute() {
  const ctx = useCtx();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product] = useState(() => getProduct(ctx, Number(id)));
  const side = Math.min(width - spacing.md * 2, 700);

  return (
    <>
      <Stack.Title>صورة القطعة</Stack.Title>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button onPress={() => router.back()}>إغلاق</Stack.Toolbar.Button>
      </Stack.Toolbar>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, alignItems: 'center' }}
        contentInsetAdjustmentBehavior="automatic">
        {product?.imageFile ? (
          <>
            <ScrollView
              maximumZoomScale={3}
              minimumZoomScale={1}
              bouncesZoom
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              style={{
                width: side,
                height: side,
                borderRadius: radius.card,
                borderCurve: 'continuous',
                backgroundColor: colors.surface,
              }}>
              <Image
                source={{ uri: photoUri(ctx.system, product.imageFile) }}
                style={{ width: side, height: side }}
                contentFit="contain"
                accessibilityLabel={`صورة ${product.name}`}
              />
            </ScrollView>
            <View style={{ alignSelf: 'stretch', gap: spacing.xs }}>
              <Text variant="title">{product.name}</Text>
              <Text variant="subhead" tone="secondary">
                {productDetails(product)}
              </Text>
              <Text variant="headline" tone="accent">
                {formatLyd(product.price)} • {product.stock} قطعة في المخزن
              </Text>
            </View>
            <Button
              title="تغيير الصورة أو تعديل بيانات القطعة"
              icon="camera.rotate.fill"
              variant="secondary"
              fullWidth
              onPress={() =>
                router.replace({
                  pathname: '/[system]/product/[id]',
                  params: { system: ctx.system, id: String(product.id) },
                })
              }
            />
          </>
        ) : (
          <EmptyState icon="photo" title="لا توجد صورة لهذه القطعة" />
        )}
      </ScrollView>
    </>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('photo/[id]');
