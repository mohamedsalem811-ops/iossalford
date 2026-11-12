import {
  agoText,
  backupFileName,
  copyFileName,
  copyReminder,
  daysBetween,
  parseBackupName,
  toDelete,
  type BackupInfo,
} from './model';

const at = (d: number, h = 10) => new Date(2026, 10, d, h, 5, 12);

describe('backup names', () => {
  it('names a backup by system, time and kind, and reads it back', () => {
    const name = backupFileName('jewelry', at(10, 14), 'auto');
    expect(name).toBe('SALFORD-jewelry-2026-11-10-140512-auto.db');
    expect(parseBackupName(name)).toEqual({ name, kind: 'auto', at: at(10, 14), format: 'db' });
    expect(copyFileName('scarves', at(10, 14))).toBe('SALFORD-scarves-2026-11-10-140512-copy.db');
    expect(parseBackupName('notes.json')).toBeNull();
    expect(parseBackupName('SALFORD-scarves-2026-11-10-140512-copy.db')).toBeNull();
    // A file still being written is never listed.
    expect(parseBackupName(`${name}.part`)).toBeNull();
  });

  it('still reads the names of backups made before Phase 8 (.json)', () => {
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

describe('keeping the last 10', () => {
  const list = (n: number, kind: BackupInfo['kind'] = 'auto') =>
    Array.from({ length: n }, (_, i) => ({
      name: `${kind}${i}`,
      kind,
      at: at(i + 1),
      format: 'db' as const,
    }));

  it('deletes the oldest beyond 10, counting safety copies on their own', () => {
    const regular = list(12);
    const gone = toDelete([...regular, ...list(3, 'safety')]);
    expect(gone.map((b) => b.name)).toEqual(['auto1', 'auto0']);
    expect(toDelete(list(10))).toEqual([]);
    expect(toDelete(list(12, 'safety')).map((b) => b.name)).toEqual(['safety1', 'safety0']);
    // Copies made before an upgrade never push out the owner's backups either.
    expect(toDelete([...list(10), ...list(11, 'upgrade')]).map((b) => b.name)).toEqual([
      'upgrade0',
    ]);
  });
});

describe('the copy reminder', () => {
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
