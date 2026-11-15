/**
 * Every message the app prepares (I4), typed by the owner with fill-ins: the marketing messages,
 * the birthday wishes and the three deposit-order messages. The app never sends anything itself:
 * each one opens WhatsApp ready and the person sends it.
 */

export type TemplateKind =
  | 'thanks'
  | 'occasion'
  | 'vip'
  | 'missYou'
  | 'gift'
  | 'birthday'
  | 'orderEta'
  | 'orderArrived'
  | 'orderWaiting';

export const TEMPLATE_KINDS: TemplateKind[] = [
  'thanks',
  'occasion',
  'vip',
  'missYou',
  'gift',
  'birthday',
  'orderEta',
  'orderArrived',
  'orderWaiting',
];

export const TEMPLATE_LABELS: Record<TemplateKind, string> = {
  thanks: 'شكراً بعد الشراء',
  occasion: 'المناسبات',
  vip: 'VIP: أول من يرى',
  missYou: 'نفتقدك',
  gift: 'تذكير الهدية',
  birthday: 'تهنئة عيد الميلاد',
  orderEta: 'الطلب: موعد الوصول',
  orderArrived: 'الطلب: جاهز للاستلام',
  orderWaiting: 'الطلب: تذكير بالاستلام',
};

/** The fill-ins each message may use, as the owner types them. */
export const FILL_INS: Record<TemplateKind, string[]> = {
  thanks: ['{الاسم}'],
  occasion: ['{الاسم}', '{المناسبة}', '{التاريخ}'],
  vip: ['{الاسم}'],
  missYou: ['{الاسم}', '{الخصم}', '{الحد}', '{حتى}'],
  gift: ['{الاسم}', '{لمن}', '{المناسبة}', '{التاريخ}'],
  birthday: ['{الاسم}', '{عزيزتنا}', '{الهدية}'],
  orderEta: ['{الاسم}', '{القطعة}', '{رقم}', '{الموعد}'],
  orderArrived: ['{الاسم}', '{طلبك}', '{القطعة}', '{رقم}', '{الباقي}'],
  orderWaiting: ['{الاسم}', '{طلبك}', '{القطعة}', '{رقم}', '{الباقي}'],
};

export const DEFAULT_TEMPLATES: Record<TemplateKind, string> = {
  thanks: 'أهلاً {الاسم}، شكراً لزيارتك اليوم 🤍 نتمنى أن تسعدك قطعتك.\nSALFORD',
  occasion:
    'أهلاً {الاسم}، بمناسبة {المناسبة} ({التاريخ}) وصلتنا قطع مميزة تليق بالهدية 🎁\nSALFORD',
  vip: 'أهلاً {الاسم}، لأنك من زبائننا المميزين: وصلتنا قطع جديدة، وأنت أول من يراها قبل الجميع ✨\nSALFORD',
  missYou:
    'أهلاً {الاسم}، اشتقنا لزيارتك! هديتك عندنا: خصم {الخصم} (بحد أقصى {الحد} للخصم) على مشترياتك حتى {حتى}.\nSALFORD',
  gift: 'أهلاً {الاسم}، اقتربت {المناسبة} لـ{لمن} ({التاريخ}). عندنا قطع جديدة تناسب الهدية 🎁\nSALFORD',
  birthday: '{عزيزتنا} {الاسم}، كل عام وأنت بخير بمناسبة عيد ميلادك 🎂{الهدية}\nSALFORD',
  orderEta:
    'أهلاً {الاسم}،\nطلبك «{القطعة}» (رقم {رقم}) تم طلبه من المورد، والوصول المتوقع {الموعد}. سنخبرك فور وصوله.\nSALFORD',
  orderArrived:
    'أهلاً {الاسم}،\n{طلبك} «{القطعة}» (رقم {رقم}) بانتظارك للاستلام 🎁{الباقي}\nبانتظارك في SALFORD',
  orderWaiting:
    'أهلاً {الاسم}، تذكير لطيف: {طلبك} «{القطعة}» (رقم {رقم}) ما زال بانتظارك للاستلام 🎁{الباقي}\nSALFORD',
};

/** Defaults the app once had: a saved copy of one of these follows the new default. */
export const OLD_DEFAULTS: Partial<Record<TemplateKind, string[]>> = {
  missYou: [
    'أهلاً {الاسم}، اشتقنا لزيارتك! هديتك عندنا: خصم {الخصم} (حتى {الحد}) على مشترياتك حتى {حتى}.\nSALFORD',
  ],
};

/** "زبون 0912345678": the name the app gave a customer typed by phone only. */
export const isAutoName = (name: string) => /^زبون\s+[+\d\s\-٠-٩]+$/.test(name.trim());

/**
 * The template with its fill-ins replaced; one left unknown stays as typed. A customer known only
 * by phone is greeted without the made-up name («أهلاً،»).
 */
export function fill(template: string, values: Record<string, string>): string {
  return template
    .replace(/\{([^{}]+)\}/g, (all, key: string) => {
      const v = values[key];
      if (v === undefined) return all;
      return key === 'الاسم' && isAutoName(v) ? '' : v;
    })
    .replace(/[ \t]+([،,.!؟])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ');
}
