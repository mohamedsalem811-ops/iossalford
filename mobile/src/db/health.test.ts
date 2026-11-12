/**
 * @jest-environment node
 */
import { healthProblem, weeklyHealthCheck } from './health';
import { migrate } from './migrate';
import { openMemoryDb } from './testing/node-db';
import type { Db } from './types';

const day = (d: number) => new Date(2026, 10, d, 10);

describe('the weekly database check', () => {
  it('runs about once a week and remembers a problem until a check finds none', () => {
    const db = openMemoryDb();
    migrate(db);
    expect(weeklyHealthCheck(db, day(1))).toBe('ok');
    expect(weeklyHealthCheck(db, day(5))).toBe('not-due');
    expect(healthProblem(db)).toBeNull();

    // A check that finds the file damaged (simulated: quick_check reports a problem).
    const damaged: Db = {
      ...db,
      get: <T>(sql: string, params?: readonly unknown[]) =>
        sql.includes('quick_check')
          ? ({ quick_check: 'row 3 missing from index' } as T)
          : db.get<T>(sql, params as never),
    };
    expect(weeklyHealthCheck(damaged, day(9))).toBe('problem');
    expect(healthProblem(db)).toBe('row 3 missing from index');
    expect(weeklyHealthCheck(db, day(17))).toBe('ok');
    expect(healthProblem(db)).toBeNull();
  });
});
