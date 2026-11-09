import { TextInput, View, type TextInputProps } from 'react-native';

import { sanitize, type NumberKind } from '@/lib/digits';
import { fonts, radius, spacing, useTheme } from '@/theme';

import { Text } from './text';

type BaseProps = {
  label?: string;
  hint?: string;
  error?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  testID?: string;
};

function FieldFrame({
  label,
  hint,
  error,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? (
        <Text variant="subhead" tone="secondary" style={{ paddingHorizontal: spacing.xs }}>
          {label}
        </Text>
      ) : null}
      {children}
      {error ? (
        <Text variant="caption" tone="warning" style={{ paddingHorizontal: spacing.xs }}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="secondary" style={{ paddingHorizontal: spacing.xs }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function useInputStyle(error?: string) {
  const { colors } = useTheme();
  return {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderCurve: 'continuous' as const,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: error ? colors.warning : colors.separator,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 16,
    // 'left' is the start edge (the right) in a right-to-left app.
    textAlign: 'left' as const,
  };
}

/** A labelled text field. */
export function TextField({
  label,
  hint,
  error,
  value,
  onChangeText,
  placeholder,
  testID,
  ...rest
}: BaseProps & Omit<TextInputProps, 'value' | 'onChangeText' | 'placeholder'>) {
  const { colors } = useTheme();
  const style = useInputStyle(error);
  return (
    <FieldFrame label={label} hint={hint} error={error}>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        style={style}
        {...rest}
      />
    </FieldFrame>
  );
}

/**
 * A number field that only ever holds 0-9 (and one "." for decimals). Arabic digits typed on an
 * Arabic number pad become 0-9 as they are typed. The "تم" button above the keyboard comes
 * from KeyboardBar.
 */
export function NumberField({
  label,
  hint,
  error,
  value,
  onChangeText,
  placeholder,
  kind = 'decimal',
  suffix,
  testID,
}: BaseProps & { kind?: NumberKind; suffix?: string }) {
  const { colors } = useTheme();
  const style = useInputStyle(error);

  return (
    <FieldFrame label={label} hint={hint} error={error}>
      <View style={{ justifyContent: 'center' }}>
        <TextInput
          testID={testID}
          accessibilityLabel={label}
          value={value}
          onChangeText={(t) => onChangeText(sanitize(t, kind))}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          keyboardType={
            kind === 'integer' ? 'number-pad' : kind === 'phone' ? 'phone-pad' : 'decimal-pad'
          }
          autoCorrect={false}
          style={[style, { fontFamily: fonts.medium, paddingEnd: suffix ? 56 : spacing.md }]}
        />
        {suffix ? (
          <Text
            variant="subhead"
            tone="secondary"
            style={{ position: 'absolute', end: spacing.md }}>
            {suffix}
          </Text>
        ) : null}
      </View>
    </FieldFrame>
  );
}
