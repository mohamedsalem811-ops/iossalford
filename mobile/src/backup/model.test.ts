import {
  agoText,
  backupFileName,
  copyFileName,
  copyOverdueDays,
  copyReminder,
  copyReminderTitle,
  daysBetween,
  parseBackupName,
  replacedAuto,
  toDelete,
  type BackupInfo,
} from './model';

const at = (d: number, h = 10) => new Date(2026, 10, d, h, 5, 12);

describe('backup names', () => {
  it('names a backup by time and kind, date first, and reads it back', () => {
    const name = backupFileName('jewelry', at(10, 14), 'auto');
    expect(name).toBe('2026-11-10_14.05.12_auto.db');
    expect(parseBackupName(name)).toEqual({ name, kind: 'auto', at: at(10, 14), format: 'db' });
    // A copy for the other device says its system (it lands in Downloads, not in a system folder).
    expect(copyFileName('scarves', at(10, 14))).toBe('scarves_2026-11-10_14.05.db');
    expect(parseBackupName('notes.json')).toBeNull();
    expect(parseBackupName('scarves_2026-11-10_14.05.db')).toBeNull();
    // A file still being written is never listed.
    expect(parseBackupName(`${name}.part`)).toBeNull();
  });

  it('still reads the names used before (Phase 7 .json and Phase 8 .db)', () => {
    const old = 'SALFORD-jewelry-2026-11-10-140512-manual.json';
    expect(parseBackupName(old)).toEqual({
      name: old,
      kind: 'manual',
      at: at(10, 14),
      format: 'json',
    });
    expect(parseBackupName('SALFORD-jewelry-2026-11-10-140512-upgrade.db')?.kind).toBe('upgrade');
  });
});

describe('which backups are kept', () => {
  const b = (name: string, when: Date, kind: BackupInfo['kind'] = 'auto'): BackupInfo => ({
    name,
    kind,
    at: when,
    format: 'db',
  });
  const list = (n: number, kind: BackupInfo['kind'] = 'auto') =>
    Array.from({ length: n }, (_, i) => b(`${kind}${i}`, at(i + 1), kind));

  it('deletes the oldest beyond 10, counting safety copies on their own', () => {
    // 12 backups on 12 different days: the 10 newest stay, and the 2 older ones go (more than
    // 7 days with a backup are already kept).
    const gone = toDelete([...list(12), ...list(3, 'safety')]);
    expect(gone.map((x) => x.name)).toEqual(['auto1', 'auto0']);
    expect(toDelete(list(10))).toEqual([]);
    expect(toDelete(list(12, 'safety')).map((x) => x.name)).toEqual(['safety1', 'safety0']);
    // Copies made before an upgrade never push out the owner's backups either.
    expect(toDelete([...list(10), ...list(11, 'upgrade')]).map((x) => x.name)).toEqual([
      'upgrade0',
    ]);
  });

  it("keeps the newest of each of the last 7 days, so a busy day never pushes out yesterday's", () => {
    const older = [8, 7, 6, 5, 4, 3].map((d) => b(`day${d}`, at(d, 20)));
    const busy = Array.from({ length: 12 }, (_, i) => b(`today${i}`, at(10, 8 + i)));
    const morning = b('day9-morning', at(9, 8));
    const evening = b('day9-evening', at(9, 21));
    const gone = toDelete([...older, morning, evening, ...busy]).map((x) => x.name);
    // Today's 10 newest stay; the 2 oldest of today go. Each of the 6 earlier days with a backup
    // up to 7 days in all keeps its newest: day 3 is the 8th day back, so it goes.
    expect(gone).toEqual(['today1', 'today0', 'day9-morning', 'day3']);
  });

  it('replaces an automatic backup made less than an hour ago', () => {
    const last = b('a', at(10, 14));
    expect(replacedAuto([last], new Date(2026, 10, 10, 14, 50))).toBe(last);
    expect(replacedAuto([last], new Date(2026, 10, 10, 15, 6))).toBeNull();
    // Never a manual backup, a safety copy, or when the newest one isn't automatic.
    expect(replacedAuto([b('m', at(10, 14), 'manual')], new Date(2026, 10, 10, 14, 10))).toBeNull();
    expect(
      replacedAuto([last, b('m', new Date(2026, 10, 10, 14, 30), 'manual')], at(10, 15)),
    ).toBeNull();
    expect(replacedAuto([], at(10))).toBeNull();
  });
});

describe('the copy reminder', () => {
  it('counts the days since a copy left the device, from the 7th day', () => {
    expect(copyOverdueDays(at(4), at(10))).toBeNull();
    expect(copyOverdueDays(at(3), at(10))).toBe(7);
    expect(copyOverdueDays(null, at(10))).toBeNull();
    expect(copyOverdueDays(null, at(10), at(1))).toBe(9);
    // A copy confirmed after the first backup counts, not the first backup.
    expect(copyOverdueDays(at(8), at(10), at(1))).toBeNull();
    expect(copyReminderTitle(9)).toBe('لا نسخة خارج الجهاز منذ 9 أيام');
    expect(copyReminderTitle(21)).toBe('لا نسخة خارج الجهاز منذ 21 يوماً');
  });

  it('shows after 7 days without a copy off the device', () => {
    expect(copyReminder(at(4), at(10))).toBeNull();
    expect(copyReminder(at(3), at(10))).toBe(
      'آخر نسخة نُسخت خارج الجهاز قبل 7 أيام. انسخ نسخة جديدة إلى الجهاز الآخر أو إلى كمبيوتر.',
    );
    // Before any copy: counted from the first backup on the device, not from day one.
    expect(copyReminder(null, at(10))).toBeNull();
    expect(copyReminder(null, at(10), at(5))).toBeNull();
    expect(copyReminder(null, at(10), at(1))).toBe(
      'لم تُنسخ أي نسخة احتياطية خارج الجهاز منذ 9 أيام. انسخ نسخة إلى الجهاز الآخر أو إلى كمبيوتر.',
    );
  });

  it('counts whole days', () => {
    expect(daysBetween(at(9, 23), at(10, 1))).toBe(1);
    expect(agoText(at(10, 1), at(10, 23))).toBe('اليوم');
    expect(agoText(at(9), at(10))).toBe('أمس');
    expect(agoText(at(8), at(10))).toBe('قبل يومين');
    expect(agoText(at(5), at(10))).toBe('قبل 5 أيام');
    expect(agoText(new Date(2026, 9, 20), at(10))).toBe('قبل 21 يوماً');
  });
});
