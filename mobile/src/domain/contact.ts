/**
 * The shop's contact details (H2), printed on the rewards card: a WhatsApp number (with its QR
 * code) and the Instagram, Facebook and TikTok names. Each shop (jewelry, scarves) keeps its
 * own, set by the owner in Settings → الولاء والمكافآت. Empty ones are not printed.
 */
import { logAction } from './activity';
import { allow, RuleError, type Ctx } from './context';
import { phoneKey } from './customers';
import { getSetting, setSetting } from './settings';

export type ShopContact = {
  /** As it is printed: "0912345678". */
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
};

export type Social = Exclude<keyof ShopContact, 'whatsapp'>;
export const SOCIALS: readonly Social[] = ['instagram', 'facebook', 'tiktok'];
export const SOCIAL_LABELS: Record<Social, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};

export const EMPTY_CONTACT: ShopContact = {
  whatsapp: null,
  instagram: null,
  facebook: null,
  tiktok: null,
};

export const CONTACT_KEY = 'shop_contact';

export function getContact(ctx: Ctx): ShopContact {
  try {
    const saved = JSON.parse(getSetting(ctx, CONTACT_KEY) ?? '{}') as Partial<ShopContact>;
    return { ...EMPTY_CONTACT, ...saved };
  } catch {
    return EMPTY_CONTACT;
  }
}

/** A Libyan mobile as it is kept and printed ("0912345678"), or null when it isn't one. */
export function cleanWhatsapp(text: string): string | null {
  const key = phoneKey(text);
  if (!key) return null;
  return key.length === 9 ? `0${key}` : key;
}

/** "218912345678": for the wa.me link and its QR code. */
export const whatsappDigits = (local: string) => {
  const key = phoneKey(local) ?? '';
  return key.length === 9 ? `218${key}` : key;
};

/** "091 234 5678": easy to read on the card. */
export const whatsappText = (local: string) =>
  /^0\d{9}$/.test(local) ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}` : local;

const MAX: Record<Social, number> = { instagram: 30, facebook: 50, tiktok: 24 };
const HOSTS: Record<Social, RegExp> = {
  instagram: /(^|\.)instagram\.com$/i,
  facebook: /(^|\.)(facebook|fb)\.com$/i,
  tiktok: /(^|\.)tiktok\.com$/i,
};

/**
 * The account name from what the owner typed or pasted: "@salford.ly", "salford.ly" or a link
 * ("https://www.instagram.com/salford.ly/?hl=ar"). Null when empty; refuses what isn't a name.
 */
export function cleanHandle(kind: Social, text: string): string | null {
  let t = text.trim();
  if (!t) return null;
  if (/^(https?:\/\/)?([a-z0-9-]+\.)*[a-z0-9-]+\.[a-z]{2,}\//i.test(t)) {
    const url = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    if (!HOSTS[kind].test(url.hostname))
      throw new RuleError(`الرابط ليس رابط ${SOCIAL_LABELS[kind]}`);
    t = url.pathname.split('/').filter(Boolean)[0] ?? '';
  }
  t = t.replace(/^@+/, '');
  if (!t || t.length > MAX[kind] || !/^[A-Za-z0-9._-]+$/.test(t))
    throw new RuleError(
      `اكتب اسم حساب ${SOCIAL_LABELS[kind]} بالأحرف الإنجليزية والأرقام فقط (حتى ${MAX[kind]} حرفاً)`,
    );
  return t;
}

/** The owner sets the contact details; empty clears one. Logged. */
export function setContact(
  ctx: Ctx,
  input: Partial<Record<keyof ShopContact, string>>,
): ShopContact {
  allow(ctx, 'settings.edit');
  const old = getContact(ctx);
  const next: ShopContact = { ...old };
  if (input.whatsapp !== undefined) {
    const typed = input.whatsapp.trim();
    next.whatsapp = typed ? cleanWhatsapp(typed) : null;
    if (typed && !next.whatsapp) throw new RuleError('رقم واتساب غير صحيح');
  }
  for (const k of SOCIALS) if (input[k] !== undefined) next[k] = cleanHandle(k, input[k]!);
  if (JSON.stringify(next) === JSON.stringify(old)) return old;
  ctx.db.transaction(() => {
    setSetting(ctx, CONTACT_KEY, JSON.stringify(next));
    logAction(
      ctx,
      'contact.set',
      `بيانات التواصل: ${
        [
          next.whatsapp && `واتساب ${next.whatsapp}`,
          ...SOCIALS.map((k) => next[k] && `${SOCIAL_LABELS[k]} ${next[k]}`),
        ]
          .filter(Boolean)
          .join('، ') || 'لا شيء'
      }`,
      { from: old, to: next },
    );
  });
  return next;
}
