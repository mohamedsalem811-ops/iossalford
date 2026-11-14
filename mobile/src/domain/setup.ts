/**
 * What still needs setting up (H2), for the owner only: shown as a number on the Management tab,
 * a mark on الإعدادات and الولاء والمكافآت, a "يحتاج إعداد" card at the top of that screen and a
 * row on the dashboard. A required item goes away once it is done; any item can be put aside
 * ("تجاهل"), which is kept per shop. Other settings can add their own items here.
 */
import { can } from '@/staff/permissions';

import { logAction } from './activity';
import { birthdayOn, getBirthday } from './birthday';
import { getContact, SOCIALS } from './contact';
import { allow, RuleError, type Ctx } from './context';
import { getLoyalty } from './loyalty';
import { getRewards } from './rewards';
import { getSetting, setSetting } from './settings';

export const SETUP_IDS = [
  'birthday',
  'whatsapp',
  'social',
  'visit-off',
  'points-off',
  'card-review',
] as const;
export type SetupId = (typeof SETUP_IDS)[number];

export type SetupItem = {
  id: SetupId;
  title: string;
  detail: string;
  /** Counted on the Management tab; the others are shown in grey. */
  required: boolean;
  /** Where the tap goes: a section of الولاء والمكافآت, or the card's page. */
  goes: 'birthday' | 'contact' | 'rewards' | 'points' | 'card';
};

const DISMISSED_KEY = 'setup_dismissed';

export function dismissedSetup(ctx: Ctx): SetupId[] {
  try {
    const list = JSON.parse(getSetting(ctx, DISMISSED_KEY) ?? '[]') as unknown;
    return Array.isArray(list)
      ? list.filter((x): x is SetupId => (SETUP_IDS as readonly string[]).includes(x))
      : [];
  } catch {
    return [];
  }
}

/** The owner's list; empty for anyone else. Put-aside items are left out unless asked for. */
export function setupNeeds(ctx: Ctx, opts: { withDismissed?: boolean } = {}): SetupItem[] {
  if (!can(ctx.actor, 'settings.edit')) return [];
  const birthday = getBirthday(ctx);
  const contact = getContact(ctx);
  const rewards = getRewards(ctx);
  const loyalty = getLoyalty(ctx);
  const items: SetupItem[] = [];
  if (!birthdayOn(birthday))
    items.push({
      id: 'birthday',
      title: 'خصم عيد الميلاد',
      detail: 'حدد أكبر مبلغ للخصم ثم فعّله.',
      required: true,
      goes: 'birthday',
    });
  if (!contact.whatsapp)
    items.push({
      id: 'whatsapp',
      title: 'رقم واتساب المحل',
      detail: 'يُطبع على بطاقة المكافآت مع رمز QR.',
      required: true,
      goes: 'contact',
    });
  if (!SOCIALS.some((k) => contact[k]))
    items.push({
      id: 'social',
      title: 'حسابات التواصل',
      detail: 'Instagram وFacebook وTikTok، تُطبع على البطاقة (اختياري).',
      required: false,
      goes: 'contact',
    });
  if (!rewards.enabled)
    items.push({
      id: 'visit-off',
      title: 'مكافأة الزيارة متوقفة',
      detail: 'لا تظهر على البطاقة حتى تشغّلها.',
      required: false,
      goes: 'rewards',
    });
  if (!loyalty.enabled)
    items.push({
      id: 'points-off',
      title: 'نقاط الولاء متوقفة',
      detail: 'لا تظهر النقاط ولا VIP على البطاقة حتى تشغّلها.',
      required: false,
      goes: 'points',
    });
  if (!items.some((i) => i.required))
    items.push({
      id: 'card-review',
      title: 'راجع بطاقة المكافآت',
      detail: 'افتح المعاينة قبل إرسال الملف للمطبعة.',
      required: false,
      goes: 'card',
    });
  if (opts.withDismissed) return items;
  const aside = dismissedSetup(ctx);
  return items.filter((i) => !aside.includes(i.id));
}

/** The number on the Management tab: the required items not done and not put aside. */
export const setupCount = (ctx: Ctx) => setupNeeds(ctx).filter((i) => i.required).length;

/** Puts an item aside ("تجاهل"), or the card review once the owner printed or shared it. */
export function dismissSetup(ctx: Ctx, id: SetupId): void {
  allow(ctx, 'settings.edit');
  if (!SETUP_IDS.includes(id)) throw new RuleError('عنصر غير معروف');
  const list = dismissedSetup(ctx);
  if (list.includes(id)) return;
  ctx.db.transaction(() => {
    setSetting(ctx, DISMISSED_KEY, JSON.stringify([...list, id]));
    logAction(ctx, 'setup.dismiss', `إخفاء من «يحتاج إعداد»: ${id}`, { id });
  });
}

/** Shows every put-aside item again. */
export function restoreSetup(ctx: Ctx): void {
  allow(ctx, 'settings.edit');
  if (!dismissedSetup(ctx).length) return;
  ctx.db.transaction(() => {
    setSetting(ctx, DISMISSED_KEY, '[]');
    logAction(ctx, 'setup.restore', 'إظهار كل عناصر «يحتاج إعداد»', {});
  });
}
