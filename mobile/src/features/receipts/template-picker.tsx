import { Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components';
import { templatesFor, type TemplateId } from '@/domain/receipts';
import { radius, spacing, useTheme, type SystemId } from '@/theme';

import { templateName } from './model';

/** The small colour sample on each design card. */
const SWATCH: Record<TemplateId, { bg: string; fg: string; label: string }> = {
  salford_dark: { bg: '#0B0B18', fg: '#FFFFFF', label: 'SJ' },
  salford_light: { bg: '#FFFFFF', fg: '#000000', label: 'SJ' },
  swarovski: { bg: '#FFFFFF', fg: '#000000', label: 'SALFORD' },
  scarves_libya: { bg: '#FFFFFF', fg: '#000000', label: 'SALFORD' },
  scarves_salford: { bg: '#6E1E3E', fg: '#FFFFFF', label: 'SALFORD' },
};

/** The receipt designs of a system as cards with a colour sample; the chosen one is outlined. */
export function TemplatePicker({
  system,
  value,
  onChange,
}: {
  system: SystemId;
  value: TemplateId;
  onChange: (template: TemplateId) => void;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {templatesFor(system).map((t) => {
          const on = value === t;
          const s = SWATCH[t];
          return (
            <Pressable
              key={t}
              onPress={() => onChange(t)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`تصميم ${templateName(t)}`}
              testID={`template-${t}`}
              style={{
                width: 132,
                padding: spacing.sm,
                gap: spacing.xs,
                borderRadius: radius.lg,
                borderCurve: 'continuous',
                backgroundColor: colors.surface,
                borderWidth: 2,
                borderColor: on ? colors.accent : colors.separator,
              }}>
              <View
                style={{
                  height: 52,
                  borderRadius: radius.sm,
                  backgroundColor: s.bg,
                  borderWidth: 1,
                  borderColor: '#d9d9d9',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Text
                  variant="headline"
                  style={{ color: s.fg, fontFamily: undefined, fontWeight: '900' }}>
                  {s.label}
                </Text>
              </View>
              <Text variant="caption" numberOfLines={1} center>
                {templateName(t)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
