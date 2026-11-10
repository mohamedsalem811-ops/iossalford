/**
 * The SALFORD logos as HTML for the receipts: the same lettering, sizes and positions as the
 * logo in the centre of the app (components/logo.tsx), drawn at 260×230 and scaled. The logo
 * fonts are embedded in the page (fonts.ts), so the PDF uses the exact same letters.
 */
import type { SystemId } from '@/theme';
import { fonts } from '@/theme/tokens';

export type LogoColors = {
  ink: string;
  accent: string;
  /** The colour behind the logo: the thin cut between the S and the J. */
  gap: string;
};

const BASE_W = 260;
const BASE_H = 230;

const star = (size: number, color: string, style = '') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="flex:none;${style}"><path d="M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z" fill="${color}"/></svg>`;

const font = (family: string) => `font-family:'${family}',Georgia,serif;font-weight:normal`;

function jewelry(c: LogoColors) {
  const cut = `text-shadow:0 0 2.5px ${c.gap},0 0 2.5px ${c.gap},0 0 1px ${c.gap}`;
  return `
  <div style="position:absolute;left:0;right:0;top:4px;height:124px;display:flex;justify-content:center">
    <div style="position:relative;width:96px;height:124px">
      <div style="position:absolute;left:6px;top:-18px;width:90px;text-align:center;${font(fonts.logoJewelry)};font-size:128px;line-height:150px;color:${c.ink}">S</div>
      <div style="position:absolute;left:8px;top:-6px;width:90px;text-align:center;${font(fonts.logoJewelryLight)};font-size:104px;line-height:124px;color:${c.ink};${cut}">J</div>
    </div>
  </div>
  <div style="position:absolute;left:0;right:0;top:138px;display:flex;flex-direction:column;align-items:center">
    <div style="display:flex;align-items:flex-start">
      ${star(13, c.ink, 'margin-top:4px;margin-right:4px')}
      <div style="${font(fonts.logoJewelryText)};font-size:42px;line-height:50px;letter-spacing:0.5px;color:${c.ink};white-space:nowrap">SALFORD</div>
      ${star(22, c.ink, 'margin-top:-10px;margin-left:-2px')}
    </div>
    <div style="${font(fonts.logoJewelryLight)};font-size:18px;line-height:22px;margin-top:2px;color:${c.accent}">jewelry</div>
  </div>`;
}

function scarves(c: LogoColors) {
  return `
  <div style="position:absolute;left:0;right:0;top:0;height:110px;display:flex;align-items:center;justify-content:center;gap:4px">
    ${star(12, c.ink, 'margin-top:10px')}
    <div style="display:flex;align-items:center">
      <div style="${font(fonts.logoScarves)};font-size:118px;line-height:120px;color:${c.ink}">S</div>
      <div style="${font(fonts.logoScarves)};font-size:118px;line-height:120px;margin-left:-34px;color:${c.ink};opacity:0.72">S</div>
    </div>
    ${star(12, c.ink, 'margin-top:26px')}
  </div>
  <div style="position:absolute;left:0;right:0;top:122px;display:flex;flex-direction:column;align-items:center;gap:10px">
    <div style="display:flex;align-items:center;gap:8px">
      <div style="width:46px;height:1px;background:${c.accent}"></div>
      ${star(8, c.accent)}
      <div style="width:46px;height:1px;background:${c.accent}"></div>
    </div>
    <div style="${font(fonts.logoScarvesText)};font-size:40px;line-height:48px;letter-spacing:9px;margin-right:-9px;color:${c.ink};white-space:nowrap">SALFORD</div>
    <div style="${font(fonts.logoScarvesItalic)};font-style:normal;font-size:19px;line-height:24px;letter-spacing:6px;margin-right:-6px;color:${c.accent}">scarfs</div>
  </div>`;
}

/** The system's logo at `width` points wide (the height follows the 260×230 drawing). */
export function logoHtml(system: SystemId, width: number, colors: LogoColors): string {
  const scale = width / BASE_W;
  return `<div role="img" aria-label="SALFORD ${system === 'jewelry' ? 'jewelry' : 'scarfs'}" style="width:${width}px;height:${(BASE_H * scale).toFixed(2)}px;margin:0 auto;direction:ltr;overflow:visible">
  <div style="position:relative;width:${BASE_W}px;height:${BASE_H}px;transform:scale(${scale.toFixed(4)});transform-origin:top left">
    ${system === 'jewelry' ? jewelry(colors) : scarves(colors)}
  </div>
</div>`;
}
