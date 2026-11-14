/**
 * A QR code as an SVG (H3), made in the app (no network): for the shop's WhatsApp link on the
 * rewards card. Error correction M; a 4-module quiet zone on a white square, so it scans on the
 * ivory paper.
 */
import qrcode from 'qrcode-generator';

/** The QR's modules: true is dark. Rows top to bottom. */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/** The SVG, `size` wide (any CSS length), in `ink` on white. */
export function qrSvg(text: string, size: string, ink: string): string {
  const m = qrMatrix(text);
  const n = m.length;
  const q = 4;
  let path = '';
  m.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) path += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-q} ${-q} ${n + 2 * q} ${n + 2 * q}" style="width:${size};height:${size};display:block" shape-rendering="crispEdges"><rect x="${-q}" y="${-q}" width="${n + 2 * q}" height="${n + 2 * q}" fill="#FFFFFF"/><path d="${path}" fill="${ink}"/></svg>`;
}
