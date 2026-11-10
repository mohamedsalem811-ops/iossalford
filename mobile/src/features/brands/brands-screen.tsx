import { useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Button, Card, EmptyState, Icon, Text, TextField } from '@/components';
import type { Brand } from '@/domain/brands';
import type { Ctx } from '@/domain/context';
import { BrandBadge } from '@/features/products/brand-badge';
import { spacing, touchTarget, useTheme } from '@/theme';

import {
  addBrandNamed,
  brandActions,
  brandPhotoMenu,
  confirmDeleteBrand,
  promptRename,
} from './actions';

/**
 * Management → Brands: the shop's own list. Add, rename (every piece shows the new name),
 * delete (its pieces become "no brand"), and the shop's own photo for each brand.
 */
export function BrandsScreen({ ctx, brands }: { ctx: Ctx; brands: Brand[] }) {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const add = () => {
    if (addBrandNamed(ctx, name)) setName('');
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        padding: spacing.md,
        gap: spacing.md,
        width: '100%',
        maxWidth: 760,
        alignSelf: 'center',
      }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled">
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <TextField
              label="ماركة جديدة"
              value={name}
              onChangeText={setName}
              placeholder="اسم الماركة"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={add}
              testID="brand-new-name"
            />
          </View>
          <Button title="إضافة" disabled={!name.trim()} onPress={add} testID="brand-add" />
        </View>
        <Text variant="caption" tone="secondary">
          يمكنك أيضاً كتابة أي ماركة مباشرة عند إضافة قطعة، وستُضاف هنا تلقائياً. اضغط على صورة
          الماركة لتغييرها، واسحب الصف أو اضغط عليه مطولاً للتعديل أو الحذف.
        </Text>
      </Card>

      <Text variant="subhead" tone="secondary" style={{ paddingHorizontal: spacing.xs }}>
        {`الماركات (${brands.length})`}
      </Text>
      {brands.length === 0 ? (
        <EmptyState icon="seal" title="لا توجد ماركات بعد" />
      ) : (
        <Card padded={false} style={{ gap: 0, overflow: 'hidden' }}>
          {brands.map((b, i) => (
            <View key={b.id}>
              {i > 0 ? (
                <View style={{ height: 1, marginStart: 72, backgroundColor: colors.separator }} />
              ) : null}
              <BrandRow ctx={ctx} brand={b} />
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

function BrandRow({ ctx, brand }: { ctx: Ctx; brand: Brand }) {
  const { colors } = useTheme();
  const swipe = useRef<SwipeableMethods>(null);
  const action = (label: string, color: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        swipe.current?.close();
        onPress();
      }}
      style={{ width: 80, alignItems: 'center', justifyContent: 'center', backgroundColor: color }}>
      <Text variant="subhead" style={{ color: colors.onAccent }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <ReanimatedSwipeable
      ref={swipe}
      friction={2}
      overshootLeft={false}
      renderLeftActions={() => (
        <View style={{ flexDirection: 'row' }}>
          {action('تعديل', colors.accent, () => promptRename(ctx, brand))}
          {action('حذف', colors.warning, () => confirmDeleteBrand(ctx, brand))}
        </View>
      )}>
      <Pressable
        testID={`brand-row-${brand.name}`}
        accessibilityRole="button"
        accessibilityLabel={`${brand.name}، ${brand.productCount} قطعة`}
        accessibilityHint="اضغط مطولاً للتعديل أو الحذف"
        onLongPress={() => brandActions(ctx, brand)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.ms,
          minHeight: touchTarget + 16,
          paddingHorizontal: spacing.md,
          backgroundColor: pressed ? colors.accentSoft : colors.surface,
        })}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`صورة ماركة ${brand.name}`}
          onPress={() => brandPhotoMenu(ctx, brand)}
          hitSlop={6}>
          <BrandBadge name={brand.name} imageFile={brand.imageFile} system={ctx.system} size={44} />
          <View
            style={{
              position: 'absolute',
              bottom: -3,
              end: -3,
              borderRadius: 10,
              backgroundColor: colors.surface,
            }}>
            <Icon name="camera.circle.fill" size={18} color={colors.accent} />
          </View>
        </Pressable>
        <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
          {brand.name}
        </Text>
        <Text variant="subhead" tone="secondary">
          {`${brand.productCount} قطعة`}
        </Text>
      </Pressable>
    </ReanimatedSwipeable>
  );
}
