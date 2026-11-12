/**
 * Where the shop's files live: databases and photos in the private folder (not shown in Files),
 * and an older install's files moved there once without ever overwriting or losing anything.
 */
import {
  databaseDirectory,
  moveLegacyData,
  photoFile,
  photoFolder,
  privateRoot,
  toPath,
} from './storage';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use imports
jest.mock('expo-file-system', () => require('@/testing/memory-fs').memoryFs());
jest.mock('expo', () => ({ isRunningInExpoGo: () => false }));

const fs = jest.requireMock('expo-file-system');
const files: Map<string, string> = fs.__files;
const PRIVATE = 'container/Library/Application Support/SALFORD';
const put = (uri: string, content = 'x') => new fs.File(uri).writeSync(content);

beforeEach(() => {
  files.clear();
  fs.__failMoves.count = 0;
});

describe('the private folder', () => {
  it('is in Library/Application Support, outside Documents (which Files shows)', () => {
    expect(privateRoot().uri).toBe(PRIVATE);
    expect(photoFolder('jewelry').uri).toBe(`${PRIVATE}/photos/jewelry`);
  });

  it('gives expo-sqlite a plain path', () => {
    expect(toPath('file:///var/mobile/Application%20Support/SQLite/')).toBe(
      '/var/mobile/Application Support/SQLite',
    );
  });
});

describe('moving an older install', () => {
  it('moves the databases with their -wal and -shm files, and the photos', () => {
    put('container/Documents/SQLite/jewelry.db', 'data');
    put('container/Documents/SQLite/jewelry.db-wal', 'recent');
    put('container/Documents/SQLite/jewelry.db-shm');
    put('container/Documents/photos/jewelry/p1.jpg', 'photo');

    expect(moveLegacyData(['jewelry', 'scarves'])).toEqual({ moved: true, leftBehind: 0 });

    expect(files.get(`${PRIVATE}/SQLite/jewelry.db`)).toBe('data');
    expect(files.get(`${PRIVATE}/SQLite/jewelry.db-wal`)).toBe('recent');
    expect(files.has(`${PRIVATE}/SQLite/jewelry.db-shm`)).toBe(true);
    expect(files.get(`${PRIVATE}/photos/jewelry/p1.jpg`)).toBe('photo');
    expect([...files.keys()].filter((k) => k.startsWith('container/Documents/'))).toEqual([]);
    expect(databaseDirectory('jewelry.db').uri).toBe(`${PRIVATE}/SQLite`);
  });

  it('does nothing when there is nothing to move (every later start)', () => {
    expect(moveLegacyData(['jewelry', 'scarves'])).toEqual({ moved: false, leftBehind: 0 });
  });

  it('never overwrites a database already in the private folder', () => {
    put(`${PRIVATE}/SQLite/jewelry.db`, 'new');
    put('container/Documents/SQLite/jewelry.db', 'old');
    expect(moveLegacyData(['jewelry']).leftBehind).toBe(1);
    expect(files.get(`${PRIVATE}/SQLite/jewelry.db`)).toBe('new');
    expect(files.get('container/Documents/SQLite/jewelry.db')).toBe('old');
  });

  it('keeps a database whole in the old place when a move fails, and still opens it there', () => {
    put('container/Documents/SQLite/scarves.db', 'data');
    put('container/Documents/SQLite/scarves.db-wal', 'recent');
    fs.__failMoves.count = 1;
    const report = moveLegacyData(['scarves']);
    expect(report.leftBehind).toBe(2);
    expect(files.get('container/Documents/SQLite/scarves.db')).toBe('data');
    expect(files.get('container/Documents/SQLite/scarves.db-wal')).toBe('recent');
    expect(databaseDirectory('scarves.db').uri).toBe('container/Documents/SQLite');
    // The next start moves it.
    expect(moveLegacyData(['scarves']).leftBehind).toBe(0);
    expect(databaseDirectory('scarves.db').uri).toBe(`${PRIVATE}/SQLite`);
  });

  it('rolls back a half-moved database (wal moved, main file failed)', () => {
    put('container/Documents/SQLite/scarves.db', 'data');
    put('container/Documents/SQLite/scarves.db-wal', 'recent');
    // The -wal moves first; the main file's move fails: the -wal is put back.
    const realMove = fs.File.prototype.moveSync;
    let calls = 0;
    const spy = jest.spyOn(fs.File.prototype, 'moveSync').mockImplementation(function (
      this: unknown,
      ...args: unknown[]
    ) {
      calls++;
      if (calls === 2) throw new Error('move failed');
      return realMove.apply(this, args);
    });
    expect(moveLegacyData(['scarves']).leftBehind).toBe(2);
    spy.mockRestore();
    expect(files.get('container/Documents/SQLite/scarves.db')).toBe('data');
    expect(files.get('container/Documents/SQLite/scarves.db-wal')).toBe('recent');
    expect(files.has(`${PRIVATE}/SQLite/scarves.db-wal`)).toBe(false);
  });

  it('reads a photo where it is when it could not be moved', () => {
    put('container/Documents/photos/jewelry/p2.jpg');
    fs.__failMoves.count = 1;
    moveLegacyData(['jewelry']);
    expect(photoFile('jewelry', 'p2.jpg').uri).toBe('container/Documents/photos/jewelry/p2.jpg');
    expect(photoFile('jewelry', 'new.jpg').uri).toBe(`${PRIVATE}/photos/jewelry/new.jpg`);
  });
});
