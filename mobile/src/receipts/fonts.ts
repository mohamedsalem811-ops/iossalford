/**
 * The logo fonts embedded in the receipt pages. iOS prints the receipt's HTML in a web view that
 * cannot read the app's own font files, so each font is read once and inlined (base64). If a
 * font can't be read, the receipt still prints with a serif fallback.
 */
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';

import type { SystemId } from '@/theme';
import { fontAssets } from '@/theme/font-assets';
import { fonts } from '@/theme/tokens';

type Family = keyof typeof fontAssets;

const FAMILIES: Record<SystemId, Family[]> = {
  jewelry: [fonts.logoJewelry, fonts.logoJewelryText, fonts.logoJewelryLight],
  scarves: [fonts.logoScarves, fonts.logoScarvesText, fonts.logoScarvesItalic],
};

/** The rewards card (H3) also needs the Arabic text font, in its three weights. */
const CARD_FAMILIES: Family[] = [fonts.regular, fonts.medium, fonts.semibold];

const cache = new Map<string, Promise<string>>();

async function load(families: Family[]): Promise<string> {
  const faces = await Promise.all(
    families.map(async (family) => {
      const asset = Asset.fromModule(fontAssets[family]);
      await asset.downloadAsync();
      const base64 = await new File(asset.localUri ?? asset.uri).base64();
      return `@font-face{font-family:'${family}';src:url(data:font/ttf;base64,${base64}) format('truetype');}`;
    }),
  );
  return faces.join('\n');
}

function cached(key: string, families: Family[]): Promise<string> {
  let css = cache.get(key);
  if (!css) {
    css = load(families).catch(() => {
      cache.delete(key);
      return '';
    });
    cache.set(key, css);
  }
  return css;
}

/** The @font-face rules for the system's logo; read once per app run. */
export const logoFontCss = (system: SystemId): Promise<string> => cached(system, FAMILIES[system]);

/** The logo's fonts and the Arabic text font, for the rewards card; read once per app run. */
export const cardFontCss = (system: SystemId): Promise<string> =>
  cached(`card-${system}`, [
    ...new Set([...FAMILIES[system], fonts.logoJewelryLight, ...CARD_FAMILIES]),
  ]);
