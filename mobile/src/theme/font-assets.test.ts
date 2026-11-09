import { fontAssets } from './font-assets';
import { fonts, type } from './tokens';

describe('fonts', () => {
  it('loads a file for every font family the app names', () => {
    for (const family of Object.values(fonts)) {
      expect(fontAssets).toHaveProperty(family);
      expect(fontAssets[family as keyof typeof fontAssets]).toBeTruthy();
    }
  });

  it('every text style uses a loaded family', () => {
    for (const style of Object.values(type)) {
      expect(Object.values(fonts)).toContain(style.fontFamily);
    }
  });
});
