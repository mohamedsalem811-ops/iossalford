import { Stack } from 'expo-router';
import { View } from 'react-native';

import { spacing, useTheme } from '@/theme';

import { Button } from './button';
import { Text } from './text';

/**
 * A form's title with its cancel and save buttons. On its own screen they go in the native
 * header; embedded beside a list (iPad), the form shows them in its own bar.
 */
export function FormHeader({
  title,
  embedded,
  onCancel,
  onSave,
  cancelLabel = 'إلغاء',
}: {
  title: string;
  embedded: boolean;
  onCancel: () => void;
  onSave: () => void;
  cancelLabel?: string;
}) {
  const { colors } = useTheme();
  if (!embedded) {
    return (
      <>
        <Stack.Title>{title}</Stack.Title>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button onPress={onCancel}>{cancelLabel}</Stack.Toolbar.Button>
        </Stack.Toolbar>
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button variant="done" onPress={onSave}>
            حفظ
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      </>
    );
  }
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.separator,
        backgroundColor: colors.background,
      }}>
      <Text variant="headline" style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </Text>
      <Button title={cancelLabel} variant="ghost" size="sm" onPress={onCancel} />
      <Button title="حفظ" size="sm" onPress={onSave} />
    </View>
  );
}
