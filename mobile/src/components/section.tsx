import type { SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { spacing, useTheme } from '@/theme';

import { Button } from './button';
import { Icon } from './icon';
import { Text } from './text';

/** A section title with an optional "عرض الكل" style action on the far side. */
export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.xs,
        marginTop: spacing.xs,
      }}>
      <Text variant="headline">{title}</Text>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10}>
          <Text variant="subhead" tone="accent">
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** What a list shows when it has nothing in it yet. */
export function EmptyState({
  icon,
  title,
  message,
  action,
  onAction,
  children,
}: {
  icon: SymbolViewProps['name'];
  title: string;
  message?: string;
  action?: string;
  onAction?: () => void;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.xl,
        paddingHorizontal: spacing.lg,
      }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name={icon} size={28} color={colors.accent} />
      </View>
      <Text variant="headline" center>
        {title}
      </Text>
      {message ? (
        <Text variant="subhead" tone="secondary" center>
          {message}
        </Text>
      ) : null}
      {action && onAction ? (
        <Button
          title={action}
          onPress={onAction}
          variant="secondary"
          style={{ alignSelf: 'center', marginTop: spacing.xs }}
        />
      ) : null}
      {children}
    </View>
  );
}
