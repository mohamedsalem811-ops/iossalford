import { Pressable, View } from 'react-native';

import { Button, Card, Text } from '@/components';
import type { SetupItem } from '@/domain/setup';
import { spacing, useTheme } from '@/theme';

/**
 * "يحتاج إعداد" (H2), at the top of الولاء والمكافآت: each item the owner still has to do, the
 * required ones first and in the warning colour. A tap goes to its field; "تجاهل" puts it aside.
 */
export function SetupCard({
  items,
  onGo,
  onDismiss,
  onRestore,
}: {
  items: SetupItem[];
  onGo: (item: SetupItem) => void;
  onDismiss: (item: SetupItem) => void;
  /** Some items were put aside: a button shows them again. */
  onRestore?: () => void;
}) {
  const { colors } = useTheme();
  if (!items.length && !onRestore) return null;
  const sorted = [...items].sort((a, b) => Number(b.required) - Number(a.required));
  return (
    <Card testID="setup-card">
      <Text variant="bodyStrong" tone={items.some((i) => i.required) ? 'warning' : 'primary'}>
        {items.length ? 'يحتاج إعداد' : 'لا شيء يحتاج إعداداً'}
      </Text>
      {sorted.map((item) => (
        <View
          key={item.id}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingVertical: spacing.xs,
            borderTopWidth: 1,
            borderTopColor: colors.separator,
          }}>
          <Pressable
            style={{ flex: 1, gap: 2 }}
            accessibilityRole="button"
            accessibilityHint="يفتح مكان الإعداد"
            onPress={() => onGo(item)}
            testID={`setup-${item.id}`}>
            <Text variant="subhead" tone={item.required ? 'warning' : 'primary'}>
              {`${item.required ? '● ' : '○ '}${item.title}`}
            </Text>
            <Text variant="caption" tone="secondary">
              {item.detail}
            </Text>
          </Pressable>
          <Button
            title="تجاهل"
            variant="ghost"
            size="sm"
            onPress={() => onDismiss(item)}
            testID={`setup-dismiss-${item.id}`}
          />
        </View>
      ))}
      {onRestore ? (
        <Button
          title="إظهار ما تم تجاهله"
          variant="ghost"
          size="sm"
          onPress={onRestore}
          testID="setup-restore"
        />
      ) : null}
    </Card>
  );
}
