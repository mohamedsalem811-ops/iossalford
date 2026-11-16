/**
 * The owner's messages (I4): fill-ins, a customer known by phone only greeted without the made-up
 * name, the order messages and the old default that follows the new wording.
 */
import { getMarketing, MARKETING_KEY } from './marketing';
import { arrivedMessage, etaMessage } from './orders';
import { setSetting } from './settings';
import { DEFAULT_TEMPLATES, fill, isAutoName, OLD_DEFAULTS, TEMPLATE_KINDS } from './templates';
import { makeCtx } from './testing/ctx';

describe('fill-ins', () => {
  it('greet a customer typed by phone only without the made-up name', () => {
    expect(isAutoName('زبون 0912345678')).toBe(true);
    expect(isAutoName('زبون +218 91 234 5678')).toBe(true);
    expect(isAutoName('زبونة جديدة')).toBe(false);
    expect(fill(DEFAULT_TEMPLATES.thanks, { الاسم: 'زبون 0912345678' })).toMatch(/^أهلاً، شكراً/);
    expect(fill(DEFAULT_TEMPLATES.thanks, { الاسم: 'منى' })).toMatch(/^أهلاً منى، شكراً/);
  });

  it('every message has its fill-ins and a default', () => {
    for (const k of TEMPLATE_KINDS) expect(DEFAULT_TEMPLATES[k].length).toBeGreaterThan(10);
  });
});

describe('the order messages', () => {
  const o = {
    customerName: 'منى',
    description: 'سوار',
    eta: '2026-12-01',
    id: 7,
    kind: 'order' as const,
    remaining: 200_000,
  };
  it('follow the owner’s wording', () => {
    expect(etaMessage(o, 'وصل {القطعة} رقم {رقم} يوم {الموعد}')).toBe(
      'وصل سوار رقم 7 يوم 1/12/2026',
    );
    expect(arrivedMessage({ ...o, kind: 'hold' }, '{طلبك}{الباقي}')).toBe(
      'قطعتك المحجوزة\nالباقي: 200 د.ل.',
    );
    expect(arrivedMessage({ ...o, customerName: 'زبون 0912345678' })).toMatch(/^أهلاً،\n/);
  });
});

describe('saved messages', () => {
  it('an old default the owner never changed follows the new wording', () => {
    const ctx = makeCtx();
    setSetting(
      ctx,
      MARKETING_KEY,
      JSON.stringify({
        templates: { missYou: OLD_DEFAULTS.missYou![0], vip: 'لكِ أولاً {الاسم}' },
      }),
    );
    const { templates } = getMarketing(ctx);
    expect(templates.missYou).toContain('بحد أقصى');
    expect(templates.vip).toBe('لكِ أولاً {الاسم}');
    expect(templates.birthday).toBe(DEFAULT_TEMPLATES.birthday);
    ctx.close();
  });
});
