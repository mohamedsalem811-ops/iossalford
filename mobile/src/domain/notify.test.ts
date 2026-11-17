/**
 * Reminders on the device while the app is closed (J6): what is scheduled for the coming week,
 * each kind on or off, at the owner's time of day, and with names hidden on the lock screen when
 * the owner asks. Never a phone number.
 */
import { PermissionError, RuleError } from './context';
import { saveCustomer } from './customers';
import { saveGift } from './marketing';
import {
  DEFAULT_NOTIFY,
  getNotifyRules,
  planReminders,
  setNotifyRules,
  type PlannedReminder,
} from './notify';
import { markPurchased, takeOrder, type TakeOrderInput } from './orders';
import { moveRepair, takeRepair } from './repairs';
import { OWNER } from '@/staff/model';

import { EMPLOYEE, makeCtx, type TestCtx } from './testing/ctx';

let ctx: TestCtx;
// Tuesday 17 November 2026, 8 in the morning.
beforeEach(() => {
  ctx = makeCtx('jewelry', new Date(2026, 10, 17, 8));
});
afterEach(() => ctx.close());

const MONA = { name: 'منى', phone: '0912345678' };
const repair = (readyBy: string, customer = MONA) =>
  takeRepair(ctx, {
    customer,
    description: 'خاتم ذهب',
    work: 'resize',
    price: 50_000,
    readyBy,
  }).repairId;
const order = (eta: string) => {
  const { orderId } = takeOrder(ctx, {
    kind: 'order',
    customer: { name: 'سعاد', phone: '0923456789' },
    description: 'سوار تيفاني',
    brand: 'Tiffany',
    unitPrice: 1_000_000,
    deposit: { amount: 500_000, method: 'cash' },
  } as TakeOrderInput);
  markPurchased(ctx, orderId, { cost: 400_000, eta });
  return orderId;
};
const of = (list: PlannedReminder[], kind: PlannedReminder['kind']) =>
  list.filter((r) => r.kind === kind);
const at = (r: PlannedReminder) =>
  `${r.at.getMonth() + 1}/${r.at.getDate()} ${r.at.getHours()}:${String(r.at.getMinutes()).padStart(2, '0')}`;
const noBackup = { lastCopied: null, firstBackup: null };

describe('repairs and orders', () => {
  it('reminds on the morning a repair is due, then each morning it is late', () => {
    repair('2026-11-19');
    const list = of(planReminders(ctx, noBackup), 'repairs');
    expect(list.map(at)).toEqual([
      '11/19 9:00',
      '11/20 9:00',
      '11/21 9:00',
      '11/22 9:00',
      '11/23 9:00',
    ]);
    expect(list[0]).toMatchObject({ title: 'الصيانة', body: 'موعدها اليوم: منى' });
    expect(list[1].body).toBe('متأخرة: منى');
  });

  it('reminds about a ready repair not collected after the owner’s days', () => {
    const id = repair('2026-11-17');
    moveRepair(ctx, id, 'ready');
    ctx.setNow(new Date(2026, 11, 1, 8)); // 14 days later
    const [first] = of(planReminders(ctx, noBackup), 'repairs');
    expect(first.body).toBe('جاهزة ولم تُستلم: منى');
    expect(at(first)).toBe('12/1 9:00');
  });

  it('reminds about an order due and then late', () => {
    order('2026-11-18');
    const list = of(planReminders(ctx, noBackup), 'orders');
    expect(list[0]).toMatchObject({ title: 'الطلبيات', body: 'موعد وصولها اليوم: سعاد' });
    expect(at(list[0])).toBe('11/18 9:00');
    expect(list[1].body).toBe('متأخرة عن موعدها: سعاد');
  });

  it('names three people at most, and counts the rest', () => {
    ['أ', 'ب', 'ج', 'د', 'هـ'].forEach((name, i) =>
      repair('2026-11-18', { name, phone: `091000000${i}` }),
    );
    const [first] = of(planReminders(ctx, noBackup), 'repairs');
    expect(first.body).toBe('موعدها اليوم: أ، ب، ج و2 غيرهن');
  });
});

describe('the customers', () => {
  it('wishes happy birthday on the morning of the day', () => {
    saveCustomer(ctx, { name: 'ليلى', phone: '0931111111', birthMonth: 11, birthDay: 20 });
    const list = of(planReminders(ctx, noBackup), 'birthdays');
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ title: 'أعياد الميلاد اليوم', body: 'ليلى' });
    expect(at(list[0])).toBe('11/20 9:00');
  });

  it('reminds of a gift date a week before', () => {
    const id = saveCustomer(ctx, { name: 'هدى', phone: '0932222222' });
    saveGift(ctx, id, null, { forWhom: 'زوجها', occasion: 'ذكرى الزواج', month: 11, day: 27 });
    ctx.db.run("UPDATE gifts SET created_at = '2025-11-20T10:00:00'");
    const list = of(planReminders(ctx, noBackup), 'gifts');
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ title: 'هدايا الأسبوع القادم', body: 'هدى: ذكرى الزواج' });
    // 27 November: a week before is the 20th.
    expect(at(list[0])).toBe('11/20 9:00');
  });
});

describe('the shift and the backup', () => {
  const openToday = () => {
    ctx.setActor(EMPLOYEE); // signed in with her shift open
    ctx.db.run("UPDATE shifts SET opened_at = '2026-11-17T10:00:00'");
    ctx.setActor(OWNER);
  };

  it('reminds at each closing time while a shift is open, and the morning after', () => {
    ctx.setNow(new Date(2026, 10, 17, 12));
    openToday();
    const list = of(planReminders(ctx, noBackup), 'shift');
    expect(list.map(at)).toEqual([
      '11/17 21:30',
      '11/18 9:00',
      '11/18 21:30',
      '11/19 21:30',
      '11/20 21:30',
      '11/21 21:30',
      '11/22 21:30',
      '11/23 21:30',
    ]);
    expect(list[0]).toMatchObject({
      id: 'jewelry-shift-2026-11-17',
      title: 'الوردية ما زالت مفتوحة',
    });
    expect(list[1]).toMatchObject({
      id: 'jewelry-shift-morning-2026-11-18',
      title: 'وردية أمس ما زالت مفتوحة',
      body: 'أغلق الوردية وعُدّ الصندوق.',
    });
  });

  it('left open past closing: the next morning, then each closing time', () => {
    openToday();
    ctx.setNow(new Date(2026, 10, 17, 23)); // put away after closing
    expect(of(planReminders(ctx, noBackup), 'shift').map(at).slice(0, 3)).toEqual([
      '11/18 9:00',
      '11/18 21:30',
      '11/19 21:30',
    ]);
  });

  it('reminds the morning after only once, however long it stays open', () => {
    openToday();
    ctx.setNow(new Date(2026, 10, 19, 8));
    const list = of(planReminders(ctx, noBackup), 'shift');
    expect(list.map(at)[0]).toBe('11/19 21:30');
    expect(list.filter((r) => r.id.includes('morning'))).toEqual([]);
  });

  it('reminds nothing once the shift is closed', () => {
    openToday();
    ctx.db.run("UPDATE shifts SET closed_at = '2026-11-17T21:00:00'");
    expect(of(planReminders(ctx, noBackup), 'shift')).toEqual([]);
  });

  it('reminds once the off-device copy is due', () => {
    const list = of(
      planReminders(ctx, { lastCopied: new Date(2026, 10, 12, 10), firstBackup: null }),
      'backup',
    );
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('النسخ الاحتياطي');
    expect(list[0].body).toContain('خارج الجهاز');
  });
});

describe('the owner’s choices', () => {
  it('turns a kind off, and moves the time of day', () => {
    repair('2026-11-19');
    order('2026-11-18');
    setNotifyRules(ctx, { on: { ...DEFAULT_NOTIFY.on, orders: false }, hour: 10, minute: 15 });
    const list = planReminders(ctx, noBackup);
    expect(of(list, 'orders')).toEqual([]);
    expect(at(of(list, 'repairs')[0])).toBe('11/19 10:15');
  });

  it('hides names on the lock screen when asked', () => {
    repair('2026-11-18');
    repair('2026-11-18', { name: 'سلمى', phone: '0941111111' });
    setNotifyRules(ctx, { hideNames: true });
    expect(of(planReminders(ctx, noBackup), 'repairs')[0].body).toBe('موعدها اليوم: 2');
  });

  it('never shows a phone number', () => {
    repair('2026-11-18');
    const text = planReminders(ctx, noBackup)
      .map((r) => r.title + r.body)
      .join(' ');
    expect(text).not.toContain('0912345678');
  });

  it('plans nothing before now, at most 60, each with its own id', () => {
    ctx.setNow(new Date(2026, 10, 17, 11));
    repair('2026-11-17');
    const list = planReminders(ctx, noBackup);
    expect(list.every((r) => r.at.getTime() > ctx.now().getTime())).toBe(true);
    expect(list.length).toBeLessThanOrEqual(60);
    expect(new Set(list.map((r) => r.id)).size).toBe(list.length);
    expect(list[0].id).toMatch(/^jewelry-repairs-2026-11-18$/);
  });

  it('checks the times, and only the owner changes them (logged)', () => {
    expect(getNotifyRules(ctx)).toEqual(DEFAULT_NOTIFY);
    expect(() => setNotifyRules(ctx, { hour: 24 })).toThrow(RuleError);
    expect(() => setNotifyRules(ctx, { closeMinute: 60 })).toThrow(RuleError);
    ctx.setActor(EMPLOYEE);
    expect(() => setNotifyRules(ctx, { hour: 8 })).toThrow(PermissionError);
  });
});
