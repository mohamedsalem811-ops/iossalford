/**
 * @jest-environment node
 */
import { withChangeSignal } from './change-signal';
import { openMemoryDb } from './testing/node-db';

function setup() {
  const raw = openMemoryDb();
  raw.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)');
  const onChange = jest.fn();
  return { db: withChangeSignal(raw, onChange), onChange };
}

describe('the database tells the screens about every change', () => {
  it('after a save, but not after a read', () => {
    const { db, onChange } = setup();
    db.all('SELECT * FROM t');
    db.get('SELECT count(*) n FROM t');
    expect(onChange).not.toHaveBeenCalled();
    db.run('INSERT INTO t (v) VALUES (?)', ['a']);
    expect(onChange).toHaveBeenCalledTimes(1);
    // An update that changes no row is not a change.
    db.run('UPDATE t SET v = ? WHERE id = ?', ['b', 999]);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('once per transaction, when it commits; never for one rolled back', () => {
    const { db, onChange } = setup();
    db.transaction(() => {
      db.run('INSERT INTO t (v) VALUES (?)', ['a']);
      db.transaction(() => db.run('INSERT INTO t (v) VALUES (?)', ['b']));
      expect(onChange).not.toHaveBeenCalled();
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(() =>
      db.transaction(() => {
        db.run('INSERT INTO t (v) VALUES (?)', ['c']);
        throw new Error('refused');
      }),
    ).toThrow('refused');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(db.get<{ n: number }>('SELECT count(*) n FROM t')?.n).toBe(2);
  });
});
