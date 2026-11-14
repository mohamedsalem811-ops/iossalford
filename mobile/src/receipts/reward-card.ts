/**
 * The rewards card for customers ("بطاقة المكافآت", H3): a two-sided A6 card in the ivory design
 * (warm paper, black lettering, gold hairlines), printed from Settings → الولاء والمكافآت. It is
 * written from the owner's rules as they are now, so it never promises what the shop doesn't
 * give: a part that is off is left out (VIP only with the points, since it doubles them).
 *
 * Three outputs of the same card:
 * - "screen": the preview in the app, `previewWidth` pixels wide;
 * - "a6": A6 for the shop's printer (AirPrint), edge to edge;
 * - "press": for a print shop: 3 mm of bleed on every side and crop marks around it. Text stays at
 *   least 5 mm inside the cut.
 *
 * Sizes are in card units ("12u"): 1/420 of the card's width (0.25 mm on paper). Arabic, digits
 * 0-9, like the app.
 */
import { countText, MONTHS, PURCHASES } from '@/lib/arabic-count';
import { birthdayOn, NOTICE_DAYS, WINDOW_DAYS, type BirthdayRules } from '@/domain/birthday';
import {
  SOCIALS,
  whatsappDigits,
  whatsappText,
  type ShopContact,
  type Social,
} from '@/domain/contact';
import type { LoyaltyRules } from '@/domain/loyalty';
import type { RewardRules } from '@/domain/rewards';
import { formatLyd } from '@/lib/money';
import type { SystemId } from '@/theme';

import { logoHtml, type LogoColors } from './logo-html';
import { qrSvg } from './qr';
import { escapeHtml, toCss } from './templates/html';

export type CardInput = {
  system: SystemId;
  loyalty: LoyaltyRules;
  rewards: RewardRules;
  birthday: BirthdayRules;
  contact: ShopContact;
};

export type CardMode = 'screen' | 'a6' | 'press';

/** The card, in millimetres: A6. */
export const CARD_MM = { width: 105, height: 148 };
/** For the print shop: the bleed past the cut, and the room for the crop marks around it. */
export const BLEED_MM = 3;
export const MARKS_MM = 8;

/** The PDF's page in points (1/72 inch), for expo-print. */
export function cardPage(mode: Exclude<CardMode, 'screen'>): { width: number; height: number } {
  const pad = mode === 'press' ? 2 * (BLEED_MM + MARKS_MM) : 0;
  const pt = (mm: number) => Math.round(((mm * 72) / 25.4) * 100) / 100;
  return { width: pt(CARD_MM.width + pad), height: pt(CARD_MM.height + pad) };
}

type Look = {
  page: string;
  ink: string;
  soft: string;
  accent: string;
  line: string;
  band: string;
  logo: LogoColors;
};

const LOOKS: Record<SystemId, Look> = {
  jewelry: {
    page: 'linear-gradient(180deg,#FBF8F1 0%,#F4EEE1 100%)',
    ink: '#15151A',
    soft: '#5E5A52',
    accent: '#9A7A3C',
    line: 'rgba(154,122,60,0.55)',
    band: '#F4EEE1',
    logo: { ink: '#15151A', accent: '#9A7A3C', gap: '#FBF8F1' },
  },
  scarves: {
    page: 'linear-gradient(180deg,#FBF7F4 0%,#F3EAE6 100%)',
    ink: '#2A1018',
    soft: '#6A5A5E',
    accent: '#A0637A',
    line: 'rgba(160,99,122,0.5)',
    band: '#F3EAE6',
    logo: { ink: '#2A1018', accent: '#A0637A', gap: '#FBF7F4' },
  },
};

export type CardSection = {
  /** For the front's band. */
  short: string;
  title: string;
  lines: string[];
  note?: string;
};

/** The parts of the back, from the rules that are on. Empty: nothing to give yet. */
export function cardSections(
  input: Pick<CardInput, 'loyalty' | 'rewards' | 'birthday'>,
): CardSection[] {
  const { loyalty: p, rewards: r, birthday: b } = input;
  const sections: CardSection[] = [];
  if (r.enabled) {
    sections.push({
      short: 'مكافأة الزيارة',
      title: 'مكافأة الزيارة',
      lines: [
        `بعد ${countText(r.every, PURCHASES)}، خصم ${r.percent}% على شرائك التالي، حتى ${formatLyd(r.maxOff)}.`,
        // The dots only while they fit on one line.
        ...(r.every <= 8 ? ['●'.repeat(r.every) + '○'] : []),
      ],
      note: [
        `يُحسب كل يوم شراء من ${formatLyd(r.minPurchase)}`,
        r.minRewardSale > 0 ? `وتُستخدم المكافأة في شراء من ${formatLyd(r.minRewardSale)}` : null,
        'ولا تنتهي.',
      ]
        .filter(Boolean)
        .join('، '),
    });
  }
  if (p.enabled) {
    const per100 = Math.floor(100_000 / p.spendPerPoint) * p.pointValue;
    sections.push({
      short: 'النقاط',
      title: 'نقاط الولاء',
      lines: [
        per100 > 0
          ? `كل 100 د.ل تشتري بها تمنحك ${formatLyd(per100)} رصيداً.`
          : `نقطة لكل ${formatLyd(p.spendPerPoint)} تشتري بها.`,
      ],
      note: `ادفع بنقاطك حتى ${p.maxShare}% من قيمة الشراء، من ${p.minRedeem} نقطة.`,
    });
    // VIP gives more points: without the points it would promise nothing.
    if (r.vipPointsTimes > 1)
      sections.push({
        short: 'VIP',
        title: 'VIP',
        lines: [
          `اشترِ بأكثر من ${formatLyd(r.vipSpend)} خلال ${countText(r.vipMonths, MONTHS)} لتصبح VIP.`,
        ],
        note:
          r.vipPointsTimes === 2
            ? 'وتكسب نقاطاً مضاعفة.'
            : `وتكسب النقاط ${r.vipPointsTimes} أضعاف.`,
      });
  }
  if (birthdayOn(b)) {
    sections.push({
      short: 'عيد الميلاد',
      title: 'خصم عيد الميلاد',
      lines: [`خصم ${b.percent}% على شرائك في أسبوع ميلادك، حتى ${formatLyd(b.maxOff)}.`],
      note: [
        `من ${WINDOW_DAYS} أيام قبل يوم ميلادك إلى ${WINDOW_DAYS} أيام بعده، مرة في السنة`,
        b.minSale > 0 ? `على شراء من ${formatLyd(b.minSale)}` : null,
        `سجّل تاريخ ميلادك عندنا قبل ${NOTICE_DAYS} يوماً على الأقل.`,
      ]
        .filter(Boolean)
        .join('، '),
    });
  }
  return sections;
}

/** Simple one-colour glyphs for the accounts (not the brands' own artwork). */
const SOCIAL_ICON: Record<Social, string> = {
  instagram:
    '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="0.6" fill="currentColor"/>',
  facebook:
    '<path d="M14.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H9.2v3h2.5V21"/>',
  tiktok: '<path d="M14 3.5v11.2a3.6 3.6 0 1 1-3.6-3.6M14 3.5c.4 2.6 2.2 4.3 4.8 4.5"/>',
};
const glyph = (k: Social, color: string) =>
  `<svg viewBox="0 0 24 24" style="width:10u;height:10u;flex:none" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${SOCIAL_ICON[k]}</svg>`;

/** "✦": the small star of the dividers. */
const STAR = (size: number, color: string) =>
  `<svg viewBox="0 0 24 24" style="width:${size}u;height:${size}u;flex:none"><path d="M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z" fill="${color}"/></svg>`;

/** Both sides as one HTML document: the front, then the back (two pages). */
export function rewardCardHtml(
  input: CardInput,
  opts: { mode?: CardMode; fontCss?: string; previewWidth?: number } = {},
): string {
  const mode = opts.mode ?? 'screen';
  const l = LOOKS[input.system];
  // Text that is not the design's own (the fonts, the owner's names and numbers) is kept out of
  // the "u" conversion below, so "shop-5u" or a font's data is never changed.
  const kept: string[] = [];
  const keep = (text: string) => `\u0001${kept.push(text) - 1}\u0001`;
  const e = (text: string) => keep(escapeHtml(text));
  const press = mode === 'press';
  // Card units and, for the print shop, the bleed and the marks' room.
  const sizes =
    mode === 'screen'
      ? `:root { --u: ${+((opts.previewWidth ?? 420) / 420).toFixed(5)}px; --bleed: 0px; --marks: 0px; }`
      : `:root { --u: ${CARD_MM.width / 420}mm; --bleed: ${press ? BLEED_MM : 0}mm; --marks: ${press ? MARKS_MM : 0}mm; }`;
  const pageW = `calc(420u + 2 * (var(--bleed) + var(--marks)))`;
  const pageH = `calc(592u + 2 * (var(--bleed) + var(--marks)))`;
  const list = cardSections(input);
  const lines = (s: CardSection) =>
    s.lines
      .map((t) => `<div class="${/^[●○]+$/.test(t) ? 'dots' : 'text'}">${e(t)}</div>`)
      .join('') + (s.note ? `<div class="note">${e(s.note)}</div>` : '');
  const sections = list
    .map(
      (s, i) => `
      <div class="row">
        <div class="num">0${i + 1}</div>
        <div class="body"><div class="title">${e(s.title)}</div>${lines(s)}</div>
      </div>`,
    )
    .join('<div class="rule"></div>');

  const c = input.contact;
  const socials = SOCIALS.filter((k) => c[k]);
  const reach =
    c.whatsapp || socials.length
      ? `<div class="reach">
    ${c.whatsapp ? `<div class="qr">${keep(qrSvg(`https://wa.me/${whatsappDigits(c.whatsapp)}`, 'calc(76 * var(--u))', l.ink))}</div>` : ''}
    <div class="reach-text">
      ${c.whatsapp ? `<div class="r1">امسح الرمز لمراسلتنا على واتساب</div><div class="r2" dir="ltr">${e(whatsappText(c.whatsapp))}</div>` : '<div class="r1">تابعنا</div>'}
      ${socials.length ? `<div class="soc" dir="ltr">${socials.map((k) => `<span>${glyph(k, l.accent)}${e(c[k]!)}</span>`).join('')}</div>` : ''}
    </div>
  </div>`
      : '';
  const band = list.length
    ? `<div class="band"><span>✦</span> ${list.map((s) => e(s.short)).join(' <span>•</span> ')} <span>✦</span></div>`
    : '';
  const marks = press ? cropMarks() : '';

  const front = `<div class="sheet">${marks}<div class="art"><section class="side front">
  <div class="hair top"></div>
  <div class="kicker">بطاقة المكافآت</div>
  <div class="logo-wrap">${logoHtml(input.system, 250, l.logo)}</div>
  <div class="tagline">كل زيارة<br>لها قيمة عندنا</div>
  ${reach}
  ${band}
</section></div></div>`;
  const back = `<div class="sheet">${marks}<div class="art"><section class="side back">
  <div class="head">
    <div class="h">مكافآتك عندنا</div>
    <div class="s">تُحسب تلقائياً برقم هاتفك</div>
  </div>
  <div class="divider"><span style="background:${l.line}"></span>${STAR(9, l.accent)}<span style="background:${l.line}"></span></div>
  <div class="secs">${sections || '<div class="empty">لا مكافآت مفعّلة الآن.</div>'}</div>
  <div class="foot">
    <div class="how">سجّل برقم هاتفك عند كل شراء لتُحسب مكافآتك.</div>
    <div class="fine">${[
      'لا تُجمع المكافآت مع أي خصم آخر، ومكافأة واحدة في كل شراء.',
      input.rewards.enabled ? 'الاستبدال لا يُحسب زيارة جديدة.' : null,
    ]
      .filter(Boolean)
      .join(' ')}</div>
  </div>
</section></div></div>`;

  const html = toCss(`<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  ${keep(opts.fontCss ?? '')}
  ${sizes}
  @page { size: ${mode === 'screen' ? 'auto' : `${CARD_MM.width + (press ? 2 * (BLEED_MM + MARKS_MM) : 0)}mm ${CARD_MM.height + (press ? 2 * (BLEED_MM + MARKS_MM) : 0)}mm`}; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: ${mode === 'screen' ? 'transparent' : '#fff'}; }
  body { font-family: 'IBMPlexSansArabic_400Regular', -apple-system, 'Geeza Pro', sans-serif; color: ${l.ink}; }
  .sheet { position: relative; width: ${pageW}; height: ${pageH}; overflow: hidden; background: #fff; page-break-after: always; break-after: page; }
  .sheet:last-child { page-break-after: auto; break-after: auto; }
  ${mode === 'screen' ? '.sheet + .sheet { margin-top: 16px; } .sheet { border-radius: 6px; box-shadow: 0 1px 8px rgba(0,0,0,.12); }' : ''}
  /* The art runs past the cut by the bleed; the card's content is placed on the cut. */
  .art { position: absolute; top: var(--marks); left: var(--marks); width: calc(420u + 2 * var(--bleed)); height: calc(592u + 2 * var(--bleed)); background: ${l.page}; }
  .side { position: absolute; top: var(--bleed); left: var(--bleed); width: 420u; height: 592u; display: flex; flex-direction: column; }
  .mark { position: absolute; background: #000; }
  /* The front: logo high, the line large, how to reach the shop, a dark band at the foot. */
  .front { align-items: center; text-align: center; }
  .hair { position: absolute; left: 28u; right: 28u; height: 0.8u; background: ${l.line}; }
  .hair.top { top: 28u; }
  .kicker { margin-top: 48u; font-size: 12u; color: ${l.accent}; }
  .logo-wrap { margin-top: 30u; }
  .tagline { font-family: 'IBMPlexSansArabic_600SemiBold', sans-serif; font-size: 27u; line-height: 1.35; margin-top: 26u; }
  .reach { margin: auto 0 74u; display: flex; align-items: center; gap: 14u; padding: 0 34u; text-align: right; }
  .qr { flex: none; border-radius: 4u; overflow: hidden; }
  .reach-text { display: flex; flex-direction: column; gap: 3u; }
  .r1 { font-size: 10.5u; color: ${l.soft}; }
  .r2 { font-family: 'IBMPlexSansArabic_600SemiBold', sans-serif; font-size: 15u; text-align: right; }
  .soc { display: flex; flex-wrap: wrap; gap: 4u 10u; font-size: 9.6u; color: ${l.ink}; justify-content: flex-end; }
  .soc span { display: inline-flex; align-items: center; gap: 3u; }
  .band { position: absolute; left: calc(-1 * var(--bleed)); right: calc(-1 * var(--bleed)); bottom: calc(-1 * var(--bleed)); padding: 16u calc(24u + var(--bleed)) calc(18u + var(--bleed)); background: ${l.ink}; color: ${l.band}; font-size: 11u; line-height: 1.5; }
  .band span { color: ${l.accent}; margin: 0 4u; }
  /* The back: a column, so the foot always sits under the parts and never over them. */
  .back { padding: 36u 40u 32u; }
  .head { text-align: center; }
  .head .h { font-family: 'IBMPlexSansArabic_600SemiBold', sans-serif; font-size: 21u; }
  .head .s { font-size: 10.5u; color: ${l.soft}; margin-top: 2u; }
  .divider { display: flex; align-items: center; justify-content: center; gap: 10u; margin: 14u 0 0; }
  .divider span { width: 40u; height: 1u; display: block; }
  .secs { margin-top: 14u; display: flex; flex-direction: column; gap: 7u; }
  .row { display: flex; gap: 14u; align-items: flex-start; padding: 2u 4u; }
  .num { font-family: 'PlayfairDisplay_500Medium', 'CormorantGaramond_500Medium', serif; font-size: 24u; line-height: 1; color: ${l.accent}; width: 32u; flex: none; text-align: center; padding-top: 2u; }
  .body { flex: 1; }
  .title { font-family: 'IBMPlexSansArabic_600SemiBold', sans-serif; font-size: 13.5u; color: ${l.accent}; }
  .text { font-size: 11.5u; line-height: 1.5; margin-top: 1u; }
  .dots { font-size: 11u; letter-spacing: 4u; color: ${l.accent}; margin-top: 1u; }
  .note { font-size: 9.2u; line-height: 1.45; color: ${l.soft}; margin-top: 2u; }
  .rule { height: 0.7u; background: ${l.line}; margin: 2u 46u 2u 4u; }
  .empty { text-align: center; font-size: 12u; color: ${l.soft}; margin-top: 40u; }
  .foot { margin-top: auto; text-align: center; padding-top: 10u; }
  .foot .how { font-family: 'IBMPlexSansArabic_500Medium', sans-serif; font-size: 11u; }
  .foot .fine { font-size: 8.6u; color: ${l.soft}; margin-top: 4u; line-height: 1.45; }
</style></head><body>
${front}
${back}
</body></html>`);
  return html.replace(/\u0001(\d+)\u0001/g, (_, n: string) => kept[Number(n)]);
}

/**
 * The crop marks: at each corner of the cut, a short line on each side, in the room outside the
 * bleed (they never touch the art).
 */
function cropMarks(): string {
  const len = `calc(var(--marks) - 2mm)`;
  const cut = (n: number) => `calc(var(--marks) + var(--bleed) + ${n}u)`;
  const t = '0.1mm';
  const out: string[] = [];
  for (const y of [cut(0), cut(592)])
    for (const side of ['left', 'right'])
      out.push(
        `<div class="mark" style="top:${y};${side}:1mm;width:${len};height:${t};margin-top:-0.05mm"></div>`,
      );
  for (const x of [cut(0), cut(420)])
    for (const side of ['top', 'bottom'])
      out.push(
        `<div class="mark" style="left:${x};${side}:1mm;height:${len};width:${t};margin-left:-0.05mm"></div>`,
      );
  return out.join('');
}
