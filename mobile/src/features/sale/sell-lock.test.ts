/** @jest-environment node */
import { openShift } from '@/domain/shifts';
import { EMPLOYEE, makeCtx } from '@/domain/testing/ctx';
import { OWNER } from '@/staff/model';

import { sellLocked } from './sell-lock';

it('locks selling for an employee until her shift is open, never for the owner', () => {
  const ctx = makeCtx('jewelry', new Date(2026, 10, 9, 10, 0, 0), { autoShift: false });
  expect(sellLocked(ctx, OWNER)).toBe(false);
  expect(sellLocked(ctx, EMPLOYEE)).toBe(true);
  ctx.setActor(EMPLOYEE);
  openShift(ctx, 0);
  expect(sellLocked(ctx, EMPLOYEE)).toBe(false);
  expect(sellLocked(ctx, null)).toBe(false);
  ctx.close();
});
