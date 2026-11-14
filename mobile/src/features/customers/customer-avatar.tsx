import { Image } from 'expo-image';
import { View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';

import type { Gender } from '@/domain/customers';
import { photoUri } from '@/lib/photos';
import { radius, useTheme, type SystemId } from '@/theme';

/**
 * The customer's picture (feature 30): their photo when there is one, otherwise a portrait drawn
 * in the system's colours, a woman (hair down, no hijab), a man, or a neutral one when the gender
 * isn't known. Drawn on a 100 × 100 grid inside a circle.
 */
export function CustomerAvatar({
  system,
  gender,
  imageFile,
  size = 40,
  testID,
}: {
  system: SystemId;
  gender: Gender | null;
  imageFile: string | null;
  size?: number;
  testID?: string;
}) {
  const { colors } = useTheme();
  if (imageFile) {
    return (
      <Image
        source={{ uri: photoUri(system, imageFile) }}
        style={{ width: size, height: size, borderRadius: radius.full }}
        contentFit="cover"
        accessibilityLabel="صورة الزبون"
        testID={testID}
      />
    );
  }
  const ink = colors.accent;
  const label = gender === 'female' ? 'صورة زبونة' : 'صورة زبون';
  return (
    <View
      testID={testID ?? `avatar-${gender ?? 'neutral'}`}
      accessible
      accessibilityLabel={label}
      style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <ClipPath id="round">
            <Circle cx={50} cy={50} r={50} />
          </ClipPath>
        </Defs>
        <G clipPath="url(#round)">
          <Rect x={0} y={0} width={100} height={100} fill={colors.accentSoft} />
          {gender === 'female' ? (
            <Woman ink={ink} />
          ) : gender === 'male' ? (
            <Man ink={ink} />
          ) : (
            <Person ink={ink} />
          )}
        </G>
      </Svg>
    </View>
  );
}

/** Hair down to the shoulders behind the face, a side-swept fringe, a soft neckline. */
function Woman({ ink }: { ink: string }) {
  return (
    <>
      <Path
        d="M28 50 C25 28 37 15 50 15 C63 15 75 28 72 50 C71 62 75 70 80 77 L20 77 C25 70 29 62 28 50 Z"
        fill={ink}
        opacity={0.9}
      />
      <Path d="M44 58 L56 58 L57 72 L43 72 Z" fill={ink} opacity={0.4} />
      <Path d="M14 104 C15 84 30 72 50 72 C70 72 85 84 86 104 Z" fill={ink} />
      <Path d="M40 73 C43 81 57 81 60 73 C57 76 43 76 40 73 Z" fill={ink} opacity={0.4} />
      <Ellipse cx={50} cy={44} rx={13} ry={15.5} fill={ink} opacity={0.4} />
      <Path
        d="M36.5 43 C36 30 43 25 51 25 C59 25 64.5 30 63.8 40 C58 34 50 33.5 44 37 C41 39 38.5 41 36.5 43 Z"
        fill={ink}
      />
    </>
  );
}

/** Short hair, a broader neck and shoulders, an open collar. */
function Man({ ink }: { ink: string }) {
  return (
    <>
      <Path d="M43 57 L57 57 L58 72 L42 72 Z" fill={ink} opacity={0.4} />
      <Path d="M10 104 C11 83 28 71 50 71 C72 71 89 83 90 104 Z" fill={ink} />
      <Path d="M40 71 L50 84 L60 71 C57 73 43 73 40 71 Z" fill={ink} opacity={0.4} />
      <Ellipse cx={50} cy={43} rx={13.5} ry={15.5} fill={ink} opacity={0.4} />
      <Path
        d="M36.2 41 C35 27 42 21 51 21 C60 21 66 27 63.8 41 C62.5 34 58 30.5 50 30.5 C42 30.5 37.5 34 36.2 41 Z"
        fill={ink}
      />
    </>
  );
}

/** A plain head and shoulders. */
function Person({ ink }: { ink: string }) {
  return (
    <>
      <Circle cx={50} cy={41} r={16} fill={ink} opacity={0.75} />
      <Path d="M14 104 C15 82 30 69 50 69 C70 69 85 82 86 104 Z" fill={ink} opacity={0.75} />
    </>
  );
}
