/**
 * The rewards card (H3): written from the rules that are on, in correct Arabic, with the shop's
 * contact and a WhatsApp QR code that really decodes to the shop's link; the print shop's file
 * has the bleed and the crop marks.
 */
import jsQR from 'jsqr';

import { DEFAULT_BIRTHDAY } from '@/domain/birthday';
import { EMPTY_CONTACT } from '@/domain/contact';
import { DEFAULT_LOYALTY } from '@/domain/loyalty';
import { DEFAULT_REWARDS } from '@/domain/rewards';

import { qrMatrix, qrSvg } from './qr';
import { cardPage, cardSections, rewardCardHtml, type CardInput } from './reward-card';

const all: CardInput = {
  system: 'jewelry',
  loyalty: { ...DEFAULT_LOYALTY, enabled: true },
  rewards: { ...DEFAULT_REWARDS, enabled: true },
  birthday: { ...DEFAULT_BIRTHDAY, enabled: true, maxOff: 200_000 },
  contact: {
    whatsapp: '0912345678',
    instagram: 'salford.ly',
    facebook: 'shop-5u',
    tiktok: null,
  },
};
const titles = (i: Partial<CardInput>) => cardSections({ ...all, ...i }).map((s) => s.title);

describe('what the card says', () => {
  it('has every part that is on, numbered', () => {
    expect(titles({})).toEqual(['مكافأة الزيارة', 'نقاط الولاء', 'VIP', 'خصم عيد الميلاد']);
  });

  it('leaves out what is off, and VIP without the points', () => {
    expect(titles({ rewards: { ...all.rewards, enabled: false } })).toEqual([
      'نقاط الولاء',
      'VIP',
      'خصم عيد الميلاد',
    ]);
    expect(titles({ loyalty: { ...all.loyalty, enabled: false } })).toEqual([
      'مكافأة الزيارة',
      'خصم عيد الميلاد',
    ]);
    expect(titles({ rewards: { ...all.rewards, vipPointsTimes: 1 } })).not.toContain('VIP');
    expect(titles({ birthday: { ...all.birthday, enabled: false } })).not.toContain(
      'خصم عيد الميلاد',
    );
    // On but with no cap yet is not on.
    expect(titles({ birthday: { ...all.birthday, maxOff: 0 } })).not.toContain('خصم عيد الميلاد');
  });

  it('writes the numbers in correct Arabic', () => {
    const [visit, , vip] = cardSections({
      ...all,
      rewards: { ...all.rewards, every: 2, vipMonths: 6 },
    });
    expect(visit.lines[0]).toBe('بعد شراءين، خصم 10% على شرائك التالي، حتى 250 د.ل.');
    expect(vip.lines[0]).toContain('خلال 6 أشهر');
    expect(cardSections(all)[2].lines[0]).toContain('خلال 12 شهراً');
  });

  it('shows the visit dots only while they fit', () => {
    expect(cardSections(all)[0].lines[1]).toBe('●●●○');
    expect(cardSections({ ...all, rewards: { ...all.rewards, every: 12 } })[0].lines).toHaveLength(
      1,
    );
  });

  it('says the birthday rules as the app applies them', () => {
    const b = cardSections(all)[3];
    expect(b.lines[0]).toBe('خصم 10% على شرائك في أسبوع ميلادك، حتى 200 د.ل.');
    expect(b.note).toContain('من 3 أيام قبل يوم ميلادك إلى 3 أيام بعده، مرة في السنة');
    expect(b.note).toContain('قبل 30 يوماً');
  });

  it('prints the fine print, the band of the parts that are on, and the contact', () => {
    const html = rewardCardHtml({ ...all, loyalty: { ...all.loyalty, enabled: false } });
    expect(html).toContain('لا تُجمع المكافآت مع أي خصم آخر، ومكافأة واحدة في كل شراء.');
    expect(html).toContain('مكافأة الزيارة <span>•</span> عيد الميلاد');
    expect(html).not.toContain('النقاط <span>');
    expect(html).toContain('091 234 5678');
    expect(html).toContain('salford.ly');
    // A name with "5u" in it is printed as typed, not turned into a size.
    expect(html).toContain('shop-5u');
    expect(html).not.toContain('VIP');
  });

  it('prints no contact block and no QR without any contact', () => {
    const html = rewardCardHtml({ ...all, contact: EMPTY_CONTACT });
    expect(html).not.toContain('class="reach"');
    expect(html).not.toContain('<svg xmlns');
  });

  it('says so when nothing is on', () => {
    const none = rewardCardHtml({
      ...all,
      loyalty: DEFAULT_LOYALTY,
      rewards: DEFAULT_REWARDS,
      birthday: DEFAULT_BIRTHDAY,
    });
    expect(none).toContain('لا مكافآت مفعّلة الآن.');
    expect(none).not.toContain('class="band"');
  });

  it('keeps the fonts as they are', () => {
    const fontCss = "@font-face{font-family:'X';src:url(data:font/ttf;base64,AA+5u+BB)}";
    expect(rewardCardHtml(all, { fontCss })).toContain(fontCss);
  });
});

describe('the WhatsApp QR code', () => {
  /** Draws the modules as pixels and reads them back as a phone camera would. */
  const decode = (m: boolean[][]) => {
    const scale = 4;
    const quiet = 4;
    const size = (m.length + 2 * quiet) * scale;
    const data = new Uint8ClampedArray(size * size * 4).fill(255);
    m.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (!dark) return;
        for (let dy = 0; dy < scale; dy++)
          for (let dx = 0; dx < scale; dx++) {
            const i = (((y + quiet) * scale + dy) * size + (x + quiet) * scale + dx) * 4;
            data[i] = data[i + 1] = data[i + 2] = 0;
          }
      }),
    );
    return jsQR(data, size, size)?.data;
  };

  it('decodes to the shop’s wa.me link', () => {
    expect(decode(qrMatrix('https://wa.me/218912345678'))).toBe('https://wa.me/218912345678');
  });

  it('draws every dark module, on white with a quiet zone', () => {
    const m = qrMatrix('https://wa.me/218912345678');
    const svg = qrSvg('https://wa.me/218912345678', '76px', '#15151A');
    const dark = m.flat().filter(Boolean).length;
    expect(svg.match(/h1v1h-1z/g)).toHaveLength(dark);
    expect(svg).toContain(`viewBox="-4 -4 ${m.length + 8} ${m.length + 8}"`);
    expect(svg).toContain('fill="#FFFFFF"');
  });

  it('is on the card, for the shop’s number', () => {
    const html = rewardCardHtml(all);
    expect(html).toContain(qrSvg('https://wa.me/218912345678', 'calc(76 * var(--u))', '#15151A'));
  });
});

describe('the sizes', () => {
  it('is A6, and the print shop’s page adds 3 mm bleed and the marks’ room', () => {
    expect(cardPage('a6')).toEqual({ width: 297.64, height: 419.53 });
    // 105 + 2 × (3 + 8) = 127 mm by 148 + 22 = 170 mm.
    expect(cardPage('press')).toEqual({ width: 360, height: 481.89 });
    const press = rewardCardHtml(all, { mode: 'press' });
    // Sized from the page's width (127 mm wide), like the receipts.
    expect(press).toContain('--mm: calc(100cqw / 127)');
    expect(press).toContain('--bleed: calc(var(--mm) * 3); --marks: calc(var(--mm) * 8)');
    expect(press).toContain('size: 127mm 170mm');
    expect(press.match(/class="mark"/g)).toHaveLength(16);
    expect(rewardCardHtml(all, { mode: 'a6' })).toContain('size: 105mm 148mm');
    expect(rewardCardHtml(all, { mode: 'a6' })).not.toContain('class="mark"');
  });
});
