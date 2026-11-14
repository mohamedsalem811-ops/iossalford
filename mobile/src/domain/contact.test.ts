/**
 * The shop's contact details and the "needs setup" list (H2): the owner's, logged, cleaned
 * (a pasted link keeps just the name), and kept per shop.
 */
import { OWNER } from '@/staff/model';

import { listActivity } from './activity';
import { setBirthday } from './birthday';
import { cleanHandle, getContact, setContact, whatsappDigits, whatsappText } from './contact';
import { PermissionError, RuleError } from './context';
import { setLoyalty } from './loyalty';
import { setRewards } from './rewards';
import { dismissSetup, restoreSetup, setupCount, setupNeeds } from './setup';
import { EMPLOYEE, makeCtx, type TestCtx } from './testing/ctx';

let ctx: TestCtx;
beforeEach(() => {
  ctx = makeCtx();
});
afterEach(() => ctx.close());

describe('contact details', () => {
  it('keep a WhatsApp number the Libyan way, and refuse a wrong one', () => {
    expect(setContact(ctx, { whatsapp: '+218 91 234 5678' }).whatsapp).toBe('0912345678');
    expect(whatsappDigits('0912345678')).toBe('218912345678');
    expect(whatsappText('0912345678')).toBe('091 234 5678');
    expect(() => setContact(ctx, { whatsapp: '123' })).toThrow(/واتساب/);
    expect(setContact(ctx, { whatsapp: '' }).whatsapp).toBeNull();
  });

  it('keep just the account name from a name or a link', () => {
    expect(cleanHandle('instagram', '@salford.ly')).toBe('salford.ly');
    expect(cleanHandle('instagram', 'https://www.instagram.com/salford.ly/?hl=ar')).toBe(
      'salford.ly',
    );
    expect(cleanHandle('instagram', 'instagram.com/salford_ly')).toBe('salford_ly');
    expect(cleanHandle('tiktok', 'https://www.tiktok.com/@salford')).toBe('salford');
    expect(cleanHandle('facebook', 'https://m.facebook.com/SalfordLibya')).toBe('SalfordLibya');
    expect(cleanHandle('facebook', '  ')).toBeNull();
    expect(() => cleanHandle('instagram', 'https://www.tiktok.com/@salford')).toThrow(RuleError);
    expect(() => cleanHandle('instagram', 'سالفورد')).toThrow(RuleError);
    expect(() => cleanHandle('tiktok', 'a'.repeat(25))).toThrow(RuleError);
  });

  it('are the owner’s and logged', () => {
    setContact(ctx, { instagram: '@salford.ly' });
    expect(getContact(ctx)).toMatchObject({ instagram: 'salford.ly', whatsapp: null });
    expect(listActivity(ctx, {})[0]).toMatchObject({ action: 'contact.set' });
    ctx.setActor(EMPLOYEE);
    expect(() => setContact(ctx, { tiktok: 'x' })).toThrow(PermissionError);
    ctx.setActor(OWNER);
  });
});

describe('what needs setting up', () => {
  const ids = () => setupNeeds(ctx).map((i) => i.id);

  it('starts with the birthday discount and WhatsApp to do', () => {
    expect(ids()).toEqual(['birthday', 'whatsapp', 'social', 'visit-off', 'points-off']);
    expect(setupCount(ctx)).toBe(2);
  });

  it('goes away as each is done, then asks to review the card', () => {
    setBirthday(ctx, { enabled: true, maxOff: 200_000 });
    setContact(ctx, { whatsapp: '0912345678', instagram: 'salford.ly' });
    setRewards(ctx, { enabled: true });
    setLoyalty(ctx, { enabled: true });
    expect(ids()).toEqual(['card-review']);
    expect(setupCount(ctx)).toBe(0);
    dismissSetup(ctx, 'card-review');
    expect(ids()).toEqual([]);
  });

  it('puts items aside and shows them again', () => {
    dismissSetup(ctx, 'birthday');
    dismissSetup(ctx, 'social');
    expect(ids()).toEqual(['whatsapp', 'visit-off', 'points-off']);
    expect(setupCount(ctx)).toBe(1);
    expect(setupNeeds(ctx, { withDismissed: true })).toHaveLength(5);
    expect(listActivity(ctx, {})[0]).toMatchObject({ action: 'setup.dismiss' });
    restoreSetup(ctx);
    expect(setupCount(ctx)).toBe(2);
  });

  it('is shown to the owner only', () => {
    ctx.setActor(EMPLOYEE);
    expect(setupNeeds(ctx)).toEqual([]);
    expect(setupCount(ctx)).toBe(0);
    expect(() => dismissSetup(ctx, 'birthday')).toThrow(PermissionError);
    ctx.setActor(OWNER);
  });
});
