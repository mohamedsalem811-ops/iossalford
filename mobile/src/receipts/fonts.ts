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

const cache = new Map<SystemId, Promise<string>>();

async function load(system: SystemId): Promise<string> {
  const faces = await Promise.all(
    FAMILIES[system].map(async (family) => {
      const asset = Asset.fromModule(fontAssets[family]);
      await asset.downloadAsync();
      const base64 = await new File(asset.localUri ?? asset.uri).base64();
      return `@font-face{font-family:'${family}';src:url(data:font/ttf;base64,${base64}) format('truetype');}`;
    }),
  );
  return faces.join('\n');
}

/** The @font-face rules for the system's logo; read once per app run. */
export function logoFontCss(system: SystemId): Promise<string> {
  let css = cache.get(system);
  if (!css) {
    css = load(system).catch(() => {
      cache.delete(system);
      return '';
    });
    cache.set(system, css);
  }
  return css;
}
