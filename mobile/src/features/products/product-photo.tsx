import { Image } from 'expo-image';
import { View } from 'react-native';

import { Icon } from '@/components';
import { photoUri } from '@/lib/photos';
import { radius, useTheme, type SystemId } from '@/theme';

/** A product's photo in a rounded square, or a soft placeholder when it has none. */
export function ProductPhoto({
  system,
  imageFile,
  size,
  rounded = radius.md,
}: {
  system: SystemId;
  imageFile: string | null;
  size: number;
  rounded?: number;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        borderCurve: 'continuous',
        overflow: 'hidden',
        backgroundColor: colors.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {imageFile ? (
        <Image
          source={{ uri: photoUri(system, imageFile) }}
          style={{ width: size, height: size }}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <Icon name="photo" size={size * 0.38} color={colors.accent} />
      )}
    </View>
  );
}
