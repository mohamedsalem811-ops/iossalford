/**
 * @jest-environment node
 */
import { DB_FILES, openSystemDb, setAsideName } from './manager';

import { LATEST_VERSION } from './schema';
import { openMemoryDb } from './testing/node-db';
import type { Db } from './types';

// Jest hoists this above the imports, so expo-sqlite's native module is never loaded.
jest.mock('expo-sqlite', () => ({ openDatabaseSync: jest.fn() }));

describe('openSystemDb', () => {
  it('opens a separate file per system and upgrades it', () => {
    const opened: string[] = [];
    const open = (file: string) => (opened.push(file), openMemoryDb());
    const jewelry = openSystemDb('jewelry', open);
    const scarves = openSystemDb('scarves', open);
    expect(opened).toEqual(['jewelry.db', 'scarves.db']);
    expect(jewelry.status).toBe('ok');
    expect(scarves.status).toBe('ok');
    if (jewelry.status === 'ok') {
      expect(jewelry.db.get<{ user_version: number }>('PRAGMA user_version')?.user_version).toBe(
        LATEST_VERSION,
      );
      jewelry.db.close();
    }
    if (scarves.status === 'ok') scarves.db.close();
  });

  it('reports a database from a newer app without touching it', () => {
    let db: Db | undefined;
    const result = openSystemDb('jewelry', () => {
      db = openMemoryDb();
      db.exec(`PRAGMA user_version = ${LATEST_VERSION + 3};`);
      db.exec('CREATE TABLE keep_me (x INTEGER); INSERT INTO keep_me VALUES (1);');
      return db;
    });
    expect(result.status).toBe('too-new');
  });

  it('reports an unreadable database instead of wiping it', () => {
    const result = openSystemDb('scarves', () => {
      throw new Error('file is not a database');
    });
    expect(result).toEqual({ status: 'unreadable', message: 'file is not a database' });
  });

  it('reports a failed upgrade as unreadable', () => {
    const result = openSystemDb('jewelry', () => {
      const db = openMemoryDb();
      // A table the first migration also creates: the upgrade fails and nothing is changed.
      db.exec('CREATE TABLE settings (x INTEGER);');
      return db;
    });
    expect(result.status).toBe('unreadable');
  });
});

describe('before an upgrade (8.0i)', () => {
  // This app knows one more migration than the database on the device.
  const { migrations } = jest.requireActual<typeof import('./schema')>('./schema');
  const next = [
    ...migrations,
    { version: LATEST_VERSION + 1, name: 'next', sql: 'CREATE TABLE extra (x INTEGER);' },
  ];
  const withNewerApp = <T>(run: (m: typeof import('./manager')) => T): T => {
    let out!: T;
    jest.isolateModules(() => {
      jest.doMock('./schema', () => ({ migrations: next, LATEST_VERSION: LATEST_VERSION + 1 }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- a fresh copy of the module
      out = run(require('./manager') as typeof import('./manager'));
    });
    return out;
  };
  const deviceDb = () => {
    const db = openMemoryDb();
    jest.requireActual<typeof import('./migrate')>('./migrate').migrate(db, migrations);
    db.exec("INSERT INTO settings (key, value) VALUES ('exchange_rate', '7000')");
    return db;
  };

  it('saves a copy of the data as it was, then upgrades', () => {
    const versionsSeen: number[] = [];
    const result = withNewerApp((m) =>
      m.openSystemDb('jewelry', deviceDb, (db) =>
        versionsSeen.push(db.get<{ user_version: number }>('PRAGMA user_version')!.user_version),
      ),
    );
    expect(versionsSeen).toEqual([LATEST_VERSION]);
    expect(result.status).toBe('ok');
  });

  it('does not upgrade when the copy cannot be saved, and keeps the data', () => {
    const result = withNewerApp((m) =>
      m.openSystemDb('jewelry', deviceDb, () => {
        throw new Error('no space left on device');
      }),
    );
    expect(result.status).toBe('unreadable');
  });

  it('saves nothing when there is no upgrade (every normal start)', () => {
    const before = jest.fn();
    const result = openSystemDb('jewelry', openMemoryDb, before);
    expect(before).not.toHaveBeenCalled();
    expect(result.status).toBe('ok');
  });
});

describe('setAsideName', () => {
  it('keeps the system name and adds a date', () => {
    expect(setAsideName('jewelry', new Date('2026-11-09T10:15:00Z'))).toBe(
      'jewelry.unreadable-2026-11-09T10-15-00.db',
    );
    expect(DB_FILES.scarves).toBe('scarves.db');
  });
});
