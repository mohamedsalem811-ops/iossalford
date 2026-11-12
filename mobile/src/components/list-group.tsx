import type { SymbolViewProps } from 'expo-symbols';
import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { radius, spacing, touchTarget, useTheme } from '@/theme';

import { Card } from './card';
import { Icon } from './icon';
import { Text } from './text';

/** A grouped inset list (iOS Settings style) with hairlines between rows. Short, fixed lists only. */
export function ListGroup({
  children,
  header,
  footer,
}: {
  children: ReactNode;
  header?: string;
  footer?: string;
}) {
  const { colors } = useTheme();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={{ gap: spacing.xs }}>
      {header ? (
        <Text variant="subhead" tone="secondary" style={{ paddingHorizontal: spacing.xs }}>
          {header}
        </Text>
      ) : null}
      <Card padded={false} style={{ paddingHorizontal: spacing.md, gap: 0 }}>
        {rows.map((row, i) => (
          <Fragment key={row.key ?? i}>
            {row}
            {i < rows.length - 1 ? (
              <View style={{ height: 1, backgroundColor: colors.separator }} />
            ) : null}
          </Fragment>
        ))}
      </Card>
      {footer ? (
        <Text variant="caption" tone="secondary" style={{ paddingHorizontal: spacing.xs }}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  value,
  icon,
  tone = 'normal',
  onPress,
  chevron = !!onPress,
  selected = false,
  testID,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  icon?: SymbolViewProps['name'];
  /** "warning" colours the icon and value to draw attention (low stock, debts). */
  tone?: 'normal' | 'warning';
  onPress?: () => void;
  chevron?: boolean;
  /** The row whose screen is open beside the list (iPad sidebar). */
  selected?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const tint = tone === 'warning' ? colors.warning : colors.accent;
  const content = (
    <View
      style={{
        minHeight: touchTarget + 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.ms,
        paddingVertical: spacing.sm,
        ...(selected
          ? {
              backgroundColor: colors.accentSoft,
              borderRadius: radius.md,
              borderCurve: 'continuous' as const,
              marginHorizontal: -spacing.sm,
              paddingHorizontal: spacing.sm,
            }
          : null),
      }}>
      {icon ? (
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            borderCurve: 'continuous',
            backgroundColor: colors.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name={icon} size={16} color={tint} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text variant="body">{title}</Text>
        {subtitle ? (
          <Text variant="caption" tone="secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="bodyStrong" tone={tone === 'warning' ? 'warning' : 'primary'}>
          {value}
        </Text>
      ) : null}
      {chevron ? (
        <Icon name="chevron.forward" size={13} color={colors.chevron} weight="semibold" />
      ) : null}
    </View>
  );

  if (!onPress) return <View testID={testID}>{content}</View>;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={selected ? { selected: true } : undefined}
      accessibilityLabel={value ? `${title}، ${value}` : title}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      {content}
    </Pressable>
  );
}
