import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '@/components';
import { photoUri } from '@/lib/photos';
import { brandBadge, fonts, type SystemId } from '@/theme';

import { brandLook } from './brand-look';

/**
 * A round brand picture: the shop's own photo if it set one, otherwise a built-in look for the
 * main brands, otherwise the brand's initials.
 */
export function BrandBadge({
  name,
  imageFile,
  system,
  size = 32,
}: {
  name: string;
  imageFile?: string | null;
  system: SystemId;
  size?: number;
}) {
  const frame = {
    width: size,
    height: size,
    borderRadius: size / 2,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: brandBadge.edge,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  if (imageFile) {
    return (
      <View style={frame} accessibilityElementsHidden importantForAccessibility="no">
        <Image
          source={{ uri: photoUri(system, imageFile) }}
          style={{ width: size, height: size }}
          contentFit="cover"
        />
      </View>
    );
  }
  const look = brandLook(name);
  const long = look.label.length > 6;
  const fontSize = size * (look.kind === 'builtIn' ? (long ? 0.17 : 0.3) : 0.38);
  return (
    <View
      style={[frame, { backgroundColor: look.background, paddingHorizontal: size * 0.08 }]}
      accessibilityElementsHidden
      importantForAccessibility="no">
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        allowFontScaling={false}
        center
        style={{
          color: look.text,
          fontSize,
          lineHeight: fontSize * 1.2,
          fontFamily:
            look.kind === 'builtIn' && look.serif ? fonts.logoJewelryText : fonts.semibold,
          letterSpacing: long ? 0.3 : 0,
        }}>
        {look.label}
      </Text>
    </View>
  );
}
