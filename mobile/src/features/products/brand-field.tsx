import { View } from 'react-native';

import { FilterChip, Text, TextField } from '@/components';

import { brandSuggestions } from './form-model';

/**
 * Type any brand; the shop's brands are suggested while typing (tap one to use the same
 * spelling). A brand that is not in the list yet is added when the piece is saved.
 */
export function BrandField({
  value,
  onChange,
  brands,
}: {
  value: string;
  onChange: (brand: string) => void;
  /** The shop's brand names. */
  brands: string[];
}) {
  const suggestions = brandSuggestions(brands, value);
  const typed = value.trim();
  const isNew = typed !== '' && !brands.some((b) => b.toLowerCase() === typed.toLowerCase());
  return (
    <View style={{ gap: 6 }}>
      <TextField
        label="الماركة (اختياري)"
        value={value}
        onChangeText={onChange}
        placeholder="اكتب أي ماركة"
        autoCorrect={false}
        clearButtonMode="while-editing"
        testID="product-brand"
      />
      {suggestions.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {suggestions.map((s) => (
            <FilterChip key={s} label={s} selected={false} onPress={() => onChange(s)} />
          ))}
        </View>
      ) : null}
      {isNew ? (
        <Text variant="caption" tone="secondary" style={{ paddingHorizontal: 4 }}>
          ماركة جديدة — ستُضاف للقائمة عند الحفظ
        </Text>
      ) : null}
    </View>
  );
}
