import { palettes } from '@/theme/palette';

import { memberLook } from './member-card';

describe('the membership card (I3, design B)', () => {
  const colors = palettes.jewelry.light;
  it('is black and gold for VIP, the shop colour for returning, ivory for new', () => {
    expect(memberLook('vip', colors)).toMatchObject({ background: '#141416', mark: '#D9B977' });
    expect(memberLook('returning', colors)).toMatchObject({
      background: colors.accent,
      ink: colors.onAccent,
    });
    expect(memberLook('new', colors)).toMatchObject({
      background: '#FBF8F1',
      border: colors.separator,
    });
  });
  it('looks the same in dark mode, like a card in the hand (VIP and new)', () => {
    const dark = palettes.jewelry.dark;
    expect(memberLook('vip', dark)).toEqual(memberLook('vip', colors));
    expect(memberLook('new', dark).background).toBe('#FBF8F1');
  });
});
