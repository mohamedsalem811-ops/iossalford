import {
  addEmployee,
  activeEmployees,
  EMPTY_STAFF,
  idlePhase,
  mergeTransfer,
  nameProblem,
  parseStaff,
  pinAccountOf,
  setActive,
  transferText,
  OWNER,
} from './model';

const now = new Date(2026, 10, 13, 10);

describe('the staff list', () => {
  it('adds employees with a unique name, never the word "المالك"', () => {
    const s = addEmployee(EMPTY_STAFF, '  سارة  ', 'a', now);
    expect(s.employees[0]).toMatchObject({ name: 'سارة', active: true, mustChangePin: true });
    expect(nameProblem(s, 'سارة')).toBe('يوجد موظف بهذا الاسم');
    expect(nameProblem(s, 'المالك')).toBe('هذا الاسم محجوز للمالك');
    expect(nameProblem(s, ' ')).toBe('اكتب اسم الموظف');
    expect(() => addEmployee(s, 'سارة', 'b', now)).toThrow('يوجد');
  });

  it('suspends instead of deleting; only active people can sign in', () => {
    let s = addEmployee(EMPTY_STAFF, 'سارة', 'a', now);
    s = addEmployee(s, 'علي', 'b', now);
    s = setActive(s, 'a', false);
    expect(s.employees).toHaveLength(2);
    expect(activeEmployees(s).map((e) => e.name)).toEqual(['علي']);
  });

  it("opens with the owner's system PIN or the employee's own PIN", () => {
    expect(pinAccountOf(OWNER, 'jewelry')).toBe('jewelry');
    expect(pinAccountOf({ kind: 'employee', id: 'a', name: 'سارة' }, 'scarves')).toBe('user.a');
  });

  it('reads a damaged file as empty, and unknown lock values as the defaults', () => {
    expect(parseStaff('{oops')).toEqual(EMPTY_STAFF);
    expect(parseStaff(JSON.stringify({ employees: [], lock: { lockMinutes: 999 } })).lock).toEqual({
      lockMinutes: 7,
      warnMinutes: 2,
      ownerToo: false,
    });
  });

  it('copies the list to the other device without PINs; new people choose theirs there', () => {
    let here = addEmployee(EMPTY_STAFF, 'سارة', 'a', now);
    here = addEmployee(here, 'علي', 'b', now);
    const text = transferText(here);
    expect(text).not.toMatch(/pin/i);
    const there = addEmployee(EMPTY_STAFF, 'سارة', 'a', now);
    const r = mergeTransfer(there, text, now);
    expect(r.added).toBe(1);
    expect(r.staff.employees.find((e) => e.id === 'b')).toMatchObject({
      name: 'علي',
      mustChangePin: true,
    });
    expect(() => mergeTransfer(there, '{"kind":"other"}', now)).toThrow('ليس قائمة موظفين');
  });
});

describe('the idle timer', () => {
  const lock = { lockMinutes: 7, warnMinutes: 2 };
  it('warns 2 minutes before locking at 7', () => {
    expect(idlePhase(4 * 60_000, lock).phase).toBe('ok');
    expect(idlePhase(5 * 60_000, lock)).toEqual({ phase: 'warn', leftMs: 120_000 });
    expect(idlePhase(6.5 * 60_000, lock)).toEqual({ phase: 'warn', leftMs: 30_000 });
    expect(idlePhase(7 * 60_000, lock).phase).toBe('lock');
  });
});
