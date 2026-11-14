/**
 * The rewards card for customers ("بطاقة المكافآت"): a two-sided A6 card, printed from Settings →
 * الولاء والمكافآت. It is written from the owner's rules as they are now, so it never promises
 * what the shop no longer gives: a part that is switched off is left out. Two designs:
 *
 * - "night": the shop's dark colours (deep indigo for jewelry, wine for scarves), light lettering
 *   and fine lines;
 * - "ivory": warm paper, black lettering and gold hairlines.
 *
 * Sizes are in card units ("12u"): 1/420 of the card's width, so it fills any paper the same.
 * Arabic and digits 0-9, like the app.
 */
import type { LoyaltyRules } from '@/domain/loyalty';
import type { RewardRules } from '@/domain/rewards';
import { formatLyd } from '@/lib/money';
import type { SystemId } from '@/theme';

import { logoHtml, type LogoColors } from './logo-html';
import { escapeHtml, toCss } from './templates/html';

export type CardDesign = 'night' | 'ivory';
export const CARD_DESIGNS: { value: CardDesign; label: string }[] = [
  { value: 'night', label: 'ليلي' },
  { value: 'ivory', label: 'عاجي' },
];

export type CardInput = {
  system: SystemId;
  design: CardDesign;
  loyalty: LoyaltyRules;
  rewards: RewardRules;
  /** The shop's WhatsApp and social names, printed at the bottom when given. */
  whatsapp?: string | null;
  social?: string | null;
};

type Look = {
  page: string;
  ink: string;
  soft: string;
  accent: string;
  line: string;
  logo: LogoColors;
  panel: string;
};

const LOOKS: Record<CardDesign, Record<SystemId, Look>> = {
  night: {
    jewelry: {
      page: 'linear-gradient(160deg,#2B1954 0%,#12102A 55%,#06060E 100%)',
      ink: '#FFFFFF',
      soft: 'rgba(255,255,255,0.72)',
      accent: '#C8D8F0',
      line: 'rgba(200,216,240,0.45)',
      logo: { ink: '#FFFFFF', accent: '#C8D8F0', gap: '#1A1438' },
      panel: 'rgba(255,255,255,0.06)',
    },
    scarves: {
      page: 'linear-gradient(160deg,#6E1E3E 0%,#3A1024 55%,#1A0610 100%)',
      ink: '#FFFFFF',
      soft: 'rgba(255,255,255,0.74)',
      accent: '#F0BED0',
      line: 'rgba(240,190,208,0.45)',
      logo: { ink: '#FFFFFF', accent: '#F0BED0', gap: '#4A1529' },
      panel: 'rgba(255,255,255,0.06)',
    },
  },
  ivory: {
    jewelry: {
      page: 'linear-gradient(180deg,#FBF8F1 0%,#F4EEE1 100%)',
      ink: '#15151A',
      soft: '#5E5A52',
      accent: '#9A7A3C',
      line: 'rgba(154,122,60,0.55)',
      logo: { ink: '#15151A', accent: '#9A7A3C', gap: '#FBF8F1' },
      panel: 'rgba(154,122,60,0.07)',
    },
    scarves: {
      page: 'linear-gradient(180deg,#FBF7F4 0%,#F3EAE6 100%)',
      ink: '#2A1018',
      soft: '#6A5A5E',
      accent: '#A0637A',
      line: 'rgba(160,99,122,0.5)',
      logo: { ink: '#2A1018', accent: '#A0637A', gap: '#FBF7F4' },
      panel: 'rgba(160,99,122,0.07)',
    },
  },
};

const STAR = (size: number, color: string) =>
  `<svg viewBox="0 0 24 24" style="width:${size}u;height:${size}u;flex:none"><path d="M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z" fill="${color}"/></svg>`;

/** "──── ✦ ────": the fine divider. */
const divider = (l: Look, width = 70) => `
  <div class="divider"><span style="width:${width}u;background:${l.line}"></span>${STAR(9, l.accent)}<span style="width:${width}u;background:${l.line}"></span></div>`;

/** The parts of the back, from the rules that are on. */
export function cardSections(input: Pick<CardInput, 'loyalty' | 'rewards'>) {
  const { loyalty: p, rewards: r } = input;
  const sections: { title: string; lines: string[]; note?: string }[] = [];
  if (r.enabled) {
    const dots = '●'.repeat(r.every) + '○';
    sections.push({
      title: 'مكافأة الزيارة',
      lines: [
        `بعد ${r.every} مشتريات، خصم ${r.percent}% على شرائك التالي، حتى ${formatLyd(r.maxOff)}.`,
        dots,
      ],
      note: `يُحسب كل يوم شراء من ${formatLyd(r.minPurchase)}، وتُستخدم المكافأة في شراء من ${formatLyd(r.minRewardSale)}، ولا تنتهي.`,
    });
  }
  if (p.enabled) {
    const per100 = Math.floor(100_000 / p.spendPerPoint) * p.pointValue;
    sections.push({
      title: 'نقاط الولاء',
      lines: [
        per100 > 0
          ? `كل 100 د.ل تشتري بها تمنحك ${formatLyd(per100)} رصيداً.`
          : `نقطة لكل ${formatLyd(p.spendPerPoint)}.`,
      ],
      note: `ادفع بنقاطك حتى ${p.maxShare}% من قيمة الشراء، من ${p.minRedeem} نقطة.`,
    });
  }
  sections.push({
    title: 'VIP',
    lines: [`اشترِ بأكثر من ${formatLyd(r.vipSpend)} خلال ${r.vipMonths} شهراً لتصبح VIP.`],
    note:
      p.enabled && r.vipPointsTimes > 1
        ? r.vipPointsTimes === 2
          ? 'وتكسب نقاطاً مضاعفة.'
          : `وتكسب النقاط ${r.vipPointsTimes} أضعاف.`
        : undefined,
  });
  sections.push({
    title: 'عيد ميلادك',
    lines: [
      r.birthdayGift
        ? `سجّل يوم ميلادك، وانتظر ${r.birthdayGift} في أسبوع ميلادك.`
        : 'سجّل يوم ميلادك، ولك منّا مفاجأة في أسبوع ميلادك.',
    ],
  });
  return sections;
}

/** Plain line icons (one colour), so the card prints the same everywhere. */
const ICON: Record<string, string> = {
  'مكافأة الزيارة':
    '<path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1.5-3-5-3.5-5-1.2C7 7 9.5 7 12 7zm0 0c1.5-3 5-3.5 5-1.2C17 7 14.5 7 12 7z"/>',
  'نقاط الولاء':
    '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  VIP: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>',
  'عيد ميلادك':
    '<path d="M4 13h16v7H4zM6 13V10h12v3M12 10V7M12 4.5c.8.8.8 1.7 0 2.5-.8-.8-.8-1.7 0-2.5z"/>',
};
const icon = (title: string, color: string, size: number) =>
  `<svg viewBox="0 0 24 24" style="width:${size}u;height:${size}u" fill="none" stroke="${color}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">${ICON[title] ?? ''}</svg>`;

/** Both sides of the card as one HTML document (two A6 pages). `previewWidth`: on screen. */
export function rewardCardHtml(
  input: CardInput,
  opts: { fontCss?: string; previewWidth?: number } = {},
): string {
  const l = LOOKS[input.design][input.system];
  const e = escapeHtml;
  const night = input.design === 'night';
  const unit = opts.previewWidth
    ? `.side { width: ${opts.previewWidth}px; height: ${+(opts.previewWidth * (148 / 105)).toFixed(1)}px; --u: ${+(opts.previewWidth / 420).toFixed(5)}px; }`
    : '.side { width: 100vw; height: 100vh; --u: calc(100vw / 420); }';
  const list = cardSections(input);
  const lines = (s: (typeof list)[number]) =>
    s.lines
      .map((t) => `<div class="${/^[●○]+$/.test(t) ? 'dots' : 'text'}">${e(t)}</div>`)
      .join('') + (s.note ? `<div class="note">${e(s.note)}</div>` : '');
  // Night: each part in its own soft panel with a round icon. Ivory: an editorial list, numbered,
  // with gold hairlines between the parts and no boxes.
  const sections = night
    ? list
        .map(
          (s) => `
      <div class="sec">
        <div class="icon">${icon(s.title, l.accent, 16)}</div>
        <div class="body"><div class="title">${e(s.title)}</div>${lines(s)}</div>
      </div>`,
        )
        .join('')
    : list
        .map(
          (s, i) => `
      <div class="row">
        <div class="num">0${i + 1}</div>
        <div class="body"><div class="title">${e(s.title)}</div>${lines(s)}</div>
      </div>`,
        )
        .join('<div class="rule"></div>');
  const contact = [
    input.whatsapp ? `واتساب ${e(input.whatsapp)}` : null,
    input.social ? e(input.social) : null,
  ].filter(Boolean);
  const logo = (w: number) => logoHtml(input.system, w, l.logo);
  const front = night
    ? `<section class="side front">
  <div class="frame"></div>
  ${logo(230)}
  ${divider(l)}
  <div class="tagline">كل زيارة لها قيمة عندنا</div>
  <div class="sub">بطاقة المكافآت</div>
</section>`
    : `<section class="side front ivory">
  <div class="hair top"></div>
  <div class="kicker">بطاقة المكافآت</div>
  <div class="logo-wrap">${logo(250)}</div>
  <div class="tagline">كل زيارة<br>لها قيمة عندنا</div>
  <div class="band"><span>✦</span> مكافأة الزيارة <span>•</span> النقاط <span>•</span> VIP <span>•</span> عيد الميلاد <span>✦</span></div>
</section>`;
  return toCss(`<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  ${opts.fontCss ?? ''}
  @page { size: A6; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: 'IBMPlexSansArabic_400Regular', -apple-system, 'Geeza Pro', sans-serif; color: ${l.ink}; }
  ${unit}
  .side { position: relative; overflow: hidden; background: ${l.page}; page-break-after: always; break-after: page; }
  .frame { position: absolute; inset: 16u; border: 1u solid ${l.line}; border-radius: 4u; pointer-events: none; }
  .frame::after { content: ''; position: absolute; inset: 5u; border: 0.6u solid ${l.line}; border-radius: 2u; opacity: .6; }
  .front { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .front .tagline { font-family: 'IBMPlexSansArabic_500Medium', sans-serif; font-size: 22u; margin-top: 34u; letter-spacing: .5u; }
  .front .sub { font-size: 13u; color: ${l.soft}; margin-top: 10u; }
  .divider { display: flex; align-items: center; justify-content: center; gap: 10u; margin: 26u 0 0; }
  .divider span { height: 1u; display: block; }
  /* Ivory front: an editorial page, logo high, the line large, a gold band at the foot. */
  .ivory { justify-content: flex-start; }
  .ivory .hair { position: absolute; left: 28u; right: 28u; height: 0.8u; background: ${l.line}; }
  .ivory .hair.top { top: 28u; }
  .ivory .kicker { margin-top: 52u; font-size: 12u; color: ${l.accent}; }
  .ivory .logo-wrap { margin-top: 46u; }
  .ivory .tagline { font-family: 'IBMPlexSansArabic_600SemiBold', sans-serif; font-size: 30u; line-height: 1.35; margin-top: 44u; }
  .ivory .band { position: absolute; left: 0; right: 0; bottom: 0; padding: 16u 20u 18u; background: ${l.ink}; color: ${night ? l.ink : '#F4EEE1'}; font-size: 11u; }
  .ivory .band span { color: ${l.accent}; margin: 0 4u; }
  /* The back: a column, so the foot always sits under the parts and never over them. */
  .back { display: flex; flex-direction: column; padding: 36u 40u 34u; }
  .head { text-align: center; }
  .head .h { font-family: 'IBMPlexSansArabic_600SemiBold', sans-serif; font-size: 21u; }
  .head .s { font-size: 10.5u; color: ${l.soft}; margin-top: 2u; }
  .secs { margin-top: 16u; display: flex; flex-direction: column; gap: 8u; }
  .sec { display: flex; gap: 11u; align-items: flex-start; padding: 9u 11u; border-radius: 6u; background: ${l.panel}; border: 0.8u solid rgba(255,255,255,0.10); }
  .icon { width: 28u; height: 28u; flex: none; border-radius: 50%; border: 0.9u solid ${l.accent}; display: flex; align-items: center; justify-content: center; }
  .body { flex: 1; }
  .title { font-family: 'IBMPlexSansArabic_600SemiBold', sans-serif; font-size: 13.5u; color: ${l.accent}; }
  .text { font-size: 11.5u; line-height: 1.5; margin-top: 1u; }
  .dots { font-size: 11u; letter-spacing: 4u; color: ${l.accent}; margin-top: 1u; }
  .note { font-size: 9.2u; line-height: 1.45; color: ${l.soft}; margin-top: 2u; }
  .row { display: flex; gap: 14u; align-items: flex-start; padding: 2u 4u; }
  .num { font-family: 'PlayfairDisplay_500Medium', 'CormorantGaramond_500Medium', serif; font-size: 24u; line-height: 1; color: ${l.accent}; width: 32u; flex: none; text-align: center; padding-top: 2u; }
  .rule { height: 0.7u; background: ${l.line}; margin: 2u 46u 2u 4u; }
  .foot { margin-top: auto; text-align: center; padding-top: 10u; }
  .foot .how { font-family: 'IBMPlexSansArabic_500Medium', sans-serif; font-size: 11u; }
  .foot .fine { font-size: 8.6u; color: ${l.soft}; margin-top: 4u; line-height: 1.45; }
  .foot .contact { font-size: 9.6u; color: ${l.accent}; margin-top: 6u; }
</style></head><body>
${front}
<section class="side back">
  ${night ? '<div class="frame"></div>' : ''}
  <div class="head">
    <div class="h">مكافآتك عندنا</div>
    <div class="s">تُحسب تلقائياً برقم هاتفك</div>
  </div>
  ${night ? '' : divider(l, 40)}
  <div class="secs">${sections}</div>
  <div class="foot">
    <div class="how">سجّل برقم هاتفك عند كل شراء لتُحسب زياراتك ونقاطك.</div>
    <div class="fine">لا تُجمع المكافأة مع الخصومات الأخرى، والاستبدال لا يُحسب زيارة جديدة.</div>
    ${contact.length ? `<div class="contact">${contact.join('  •  ')}</div>` : ''}
  </div>
</section>
</body></html>`);
}
