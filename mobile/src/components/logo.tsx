import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { fonts, useTheme, type SystemId } from '@/theme';

/** The four-point star from both logos. */
function Star({ size, color, style }: { size: number; color: string; style?: object }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path
        d="M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z"
        fill={color}
      />
    </Svg>
  );
}

const BASE_W = 260;
const BASE_H = 230;

/**
 * The SALFORD logos redrawn as lettering (docs/DESIGN.md): SJ + SALFORD + stars + "jewelry",
 * or SS + stars + divider + SALFORD + "scarfs". Drawn at 260×230 and scaled to `width`.
 * Ink follows the theme's text colour; the accent colours "jewelry", "scarfs" and the divider.
 */
export function Logo({
  system,
  width = 120,
  markOnly = false,
}: {
  system: SystemId;
  width?: number;
  markOnly?: boolean;
}) {
  const { colors } = useTheme();
  const scale = width / BASE_W;
  const ink = colors.text;
  const accent = colors.accent;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={system === 'jewelry' ? 'SALFORD jewelry' : 'SALFORD scarfs'}
      style={{ width, height: BASE_H * scale, direction: 'ltr' }}>
      <View
        style={{
          width: BASE_W,
          height: BASE_H,
          transform: [{ scale }],
          transformOrigin: 'top left',
        }}>
        {system === 'jewelry' ? (
          <JewelryMark ink={ink} accent={accent} gap={colors.background} markOnly={markOnly} />
        ) : (
          <ScarvesMark ink={ink} accent={accent} markOnly={markOnly} />
        )}
      </View>
    </View>
  );
}

function JewelryMark({
  ink,
  accent,
  gap,
  markOnly,
}: {
  ink: string;
  accent: string;
  gap: string;
  markOnly: boolean;
}) {
  const top = markOnly ? 52 : 0;
  return (
    <>
      <View style={{ position: 'absolute', left: 70, top, width: 120, height: 128 }}>
        <Text
          allowFontScaling={false}
          style={{
            position: 'absolute',
            left: 22,
            top: -14,
            fontFamily: fonts.logoJewelry,
            fontSize: 128,
            lineHeight: 150,
            color: ink,
          }}>
          S
        </Text>
        <Text
          allowFontScaling={false}
          style={{
            position: 'absolute',
            left: 47,
            top: -2,
            fontFamily: fonts.logoJewelryLight,
            fontSize: 104,
            lineHeight: 124,
            color: ink,
            textShadowColor: gap,
            textShadowRadius: 3,
            textShadowOffset: { width: 0, height: 0 },
          }}>
          J
        </Text>
      </View>
      {markOnly ? null : (
        <View style={{ position: 'absolute', left: 0, right: 0, top: 136, alignItems: 'center' }}>
          <View style={{ paddingHorizontal: 22 }}>
            <Star size={14} color={ink} style={{ position: 'absolute', left: 0, top: 2 }} />
            <Text
              allowFontScaling={false}
              style={{
                fontFamily: fonts.logoJewelryText,
                fontSize: 50,
                lineHeight: 58,
                letterSpacing: 0.5,
                color: ink,
              }}>
              SALFORD
            </Text>
            <Star size={24} color={ink} style={{ position: 'absolute', right: -4, top: -10 }} />
          </View>
          <Text
            allowFontScaling={false}
            style={{
              fontFamily: fonts.logoJewelryLight,
              fontSize: 18,
              lineHeight: 22,
              color: accent,
            }}>
            jewelry
          </Text>
        </View>
      )}
    </>
  );
}

function ScarvesMark({
  ink,
  accent,
  markOnly,
}: {
  ink: string;
  accent: string;
  markOnly: boolean;
}) {
  const top = markOnly ? 60 : 0;
  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top,
          height: 110,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}>
        <Star size={12} color={ink} style={{ marginTop: 10 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text
            allowFontScaling={false}
            style={{ fontFamily: fonts.logoScarves, fontSize: 118, lineHeight: 120, color: ink }}>
            S
          </Text>
          <Text
            allowFontScaling={false}
            style={{
              fontFamily: fonts.logoScarves,
              fontSize: 118,
              lineHeight: 120,
              marginLeft: -34,
              color: ink,
              opacity: 0.72,
            }}>
            S
          </Text>
        </View>
        <Star size={12} color={ink} style={{ marginTop: 26 }} />
      </View>
      {markOnly ? null : (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 122,
            alignItems: 'center',
            gap: 10,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 46, height: 1, backgroundColor: accent }} />
            <Star size={8} color={accent} />
            <View style={{ width: 46, height: 1, backgroundColor: accent }} />
          </View>
          <Text
            allowFontScaling={false}
            style={{
              fontFamily: fonts.logoScarvesText,
              fontSize: 42,
              lineHeight: 48,
              letterSpacing: 9,
              marginRight: -9,
              color: ink,
            }}>
            SALFORD
          </Text>
          <Text
            allowFontScaling={false}
            style={{
              fontFamily: fonts.logoScarvesItalic,
              fontSize: 19,
              lineHeight: 24,
              letterSpacing: 6,
              marginRight: -6,
              color: accent,
            }}>
            scarfs
          </Text>
        </View>
      )}
    </>
  );
}
