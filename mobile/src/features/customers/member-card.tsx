import { View } from 'react-native';

import { Text } from '@/components';
import { BADGE_LABELS, type Badge } from '@/domain/customer-stats';
import type { Gender } from '@/domain/customers';
import { radius, spacing, useTheme, type Palette, type SystemId } from '@/theme';

import { CustomerAvatar } from './customer-avatar';

export type MemberLook = {
  background: string;
  ink: string;
  soft: string;
  mark: string;
  border?: string;
};

/** The ivory of the rewards card (H3), for new customers. */
const IVORY = { background: '#FBF8F1', ink: '#15151A', soft: '#5E5A52', mark: '#806229' };
/** Black and gold for VIP. */
const VIP = { background: '#141416', ink: '#F4E7C8', soft: '#BFAE86', mark: '#D9B977' };

/**
 * The card's colours (I3, design B): black and gold for VIP, the shop's colour for a returning
 * customer, ivory for a new one. The same in light and dark mode, like a card in the hand.
 */
export function memberLook(
  badge: Badge,
  colors: Pick<Palette, 'accent' | 'onAccent' | 'separator'>,
): MemberLook {
  if (badge === 'vip') return VIP;
  if (badge === 'returning')
    return {
      background: colors.accent,
      ink: colors.onAccent,
      soft: colors.onAccent,
      mark: colors.onAccent,
    };
  return { ...IVORY, border: colors.separator };
}

/** "برتبة VIP" … the tier as the card prints it. */
const TIER: Record<Badge, string> = {
  vip: 'عضوية VIP',
  returning: `زبون ${BADGE_LABELS.returning}`,
  new: BADGE_LABELS.new,
};

/**
 * The membership card (I3, design B) that heads the customer at checkout and on her page: the
 * shop's name and her tier, her photo or portrait and name, and at the foot her points (only when
 * points are on) and her visit dots (only when the visit reward is on).
 */
export function MemberCard({
  system,
  name,
  gender,
  imageFile,
  badge,
  points,
  dots,
  avatarSize = 52,
  avatarTestID,
  testID,
}: {
  system: SystemId;
  /** As this person may see it (feature 26). */
  name: string;
  gender: Gender | null;
  imageFile: string | null;
  badge: Badge;
  /** Null when points are off. */
  points: number | null;
  /** "●●○○○", or null when the visit reward is off. */
  dots: string | null;
  avatarSize?: number;
  avatarTestID?: string;
  testID?: string;
}) {
  const { colors } = useTheme();
  const look = memberLook(badge, colors);
  const foot = points !== null || dots !== null;
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={[name, TIER[badge], points !== null ? `${points} نقطة` : null]
        .filter(Boolean)
        .join('، ')}
      style={{
        gap: spacing.ms,
        padding: spacing.md,
        minHeight: 148,
        justifyContent: 'space-between',
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        backgroundColor: look.background,
        borderWidth: look.border ? 1 : 0,
        borderColor: look.border,
        boxShadow: '0 6px 18px rgba(0,0,0,0.16)',
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="caption" style={{ color: look.mark, letterSpacing: 3, fontWeight: '700' }}>
          SALFORD
        </Text>
        <Text
          variant="caption"
          style={{ color: look.mark, fontWeight: '700' }}
          testID={`${testID}-tier`}>
          {TIER[badge]}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.ms }}>
        <CustomerAvatar
          system={system}
          gender={gender}
          imageFile={imageFile}
          size={avatarSize}
          testID={avatarTestID}
        />
        <Text
          variant="title"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ flex: 1, color: look.ink }}>
          {name}
        </Text>
      </View>
      {foot ? (
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {dots !== null ? (
            <Text
              variant="body"
              style={{ color: look.mark, letterSpacing: 2 }}
              testID={`${testID}-dots`}>
              {dots}
            </Text>
          ) : (
            <View />
          )}
          {points !== null ? (
            <Text variant="bodyStrong" style={{ color: look.ink }} testID={`${testID}-points`}>
              {`${points} نقطة`}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
