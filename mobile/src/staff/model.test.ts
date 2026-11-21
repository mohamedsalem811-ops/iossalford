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
  employeesOf,
  setWorksIn,
  worksIn,
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

  it('keeps the systems ticked for each person on the other device (rule A)', () => {
    let here = addEmployee(EMPTY_STAFF, 'سارة', 'a', now);
    here = addEmployee(here, 'علي', 'b', now);
    here = addEmployee(here, 'هدى', 'c', now);
    here = setWorksIn(here, 'a', 'jewelry', false);
    here = setWorksIn(here, 'c', 'scarves', false);
    // On the other device: Huda is already there in both systems, and Ali in the scarves only.
    let there = addEmployee(EMPTY_STAFF, 'هدى', 'c', now);
    there = addEmployee(there, 'علي', 'b', now);
    there = setWorksIn(there, 'b', 'jewelry', false);
    const r = mergeTransfer(there, transferText(here), now);
    expect(r.added).toBe(1);
    expect(r.updated).toBe(2);
    const of = (id: string) => r.staff.employees.find((e) => e.id === id)!;
    expect(worksIn(of('a'), 'jewelry')).toBe(false);
    expect(worksIn(of('a'), 'scarves')).toBe(true);
    expect(worksIn(of('b'), 'jewelry')).toBe(true);
    expect(worksIn(of('c'), 'scarves')).toBe(false);
    // A list from an older app (no systems) changes nothing for people already here.
    const old = JSON.stringify({ kind: 'salford-staff', employees: [{ id: 'c', name: 'هدى' }] });
    expect(mergeTransfer(r.staff, old, now)).toMatchObject({ added: 0, updated: 0 });
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

describe('which systems an employee works in (rule A)', () => {
  const base = addEmployee(EMPTY_STAFF, 'سارة', 's1', new Date(2026, 10, 21));

  it('works in both systems until the owner unticks one', () => {
    const s = base.employees[0];
    expect(worksIn(s, 'jewelry')).toBe(true);
    expect(worksIn(s, 'scarves')).toBe(true);
    expect(employeesOf(base, 'jewelry').map((e) => e.name)).toEqual(['سارة']);
  });

  it('leaves a system out of the sign-in once unticked, and keeps at least one', () => {
    const scarvesOnly = setWorksIn(base, 's1', 'jewelry', false);
    expect(employeesOf(scarvesOnly, 'jewelry')).toEqual([]);
    expect(employeesOf(scarvesOnly, 'scarves').map((e) => e.name)).toEqual(['سارة']);
    expect(() => setWorksIn(scarvesOnly, 's1', 'scarves', false)).toThrow('نظام واحد على الأقل');
    const both = setWorksIn(scarvesOnly, 's1', 'jewelry', true);
    expect(worksIn(both.employees[0], 'jewelry')).toBe(true);
  });

  it('reads the choice back from the saved file, and an old file as both systems', () => {
    const saved = JSON.stringify(setWorksIn(base, 's1', 'scarves', false));
    expect(worksIn(parseStaff(saved).employees[0], 'scarves')).toBe(false);
    const old = JSON.stringify({ employees: [{ id: 'x', name: 'هدى', active: true }] });
    expect(worksIn(parseStaff(old).employees[0], 'scarves')).toBe(true);
  });
});
