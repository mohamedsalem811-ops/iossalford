import { brandInitials, brandLook } from './brand-look';

describe('brandLook', () => {
  it('uses the built-in look for the main brands, in any case', () => {
    expect(brandLook('swarovski')).toMatchObject({ kind: 'builtIn', label: 'SWAROVSKI' });
    expect(brandLook('Tiffany & Co')).toMatchObject({ kind: 'builtIn', label: 'T&Co.' });
    expect(brandLook('PANDORA Moments')).toMatchObject({ kind: 'builtIn', label: 'PANDORA' });
  });

  it('gives other brands initials in a colour that never changes for that name', () => {
    const look = brandLook('Van Cleef');
    expect(look).toMatchObject({ kind: 'initials', label: 'VC' });
    expect(brandLook('Van Cleef').background).toBe(look.background);
  });
});

describe('brandInitials', () => {
  it('takes the first letter of up to two words', () => {
    expect(brandInitials('  van  cleef arpels ')).toBe('VC');
    expect(brandInitials('Lazurde')).toBe('L');
    expect(brandInitials('لازوردي')).toBe('ل');
  });
});
