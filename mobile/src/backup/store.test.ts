/**
 * @jest-environment node
 *
 * The backup store end to end, on real files in a temporary folder and a real database: saving
 * (copies made by SQLite, skipped when nothing changed, never half-written), keeping 10, copying
 * off the device with its photos, checking a file, restoring with the safety copy saved first,
 * and old (.json) backups still restoring.
 */
import { openFileDb } from '@/db/testing/node-db';
import { exportBackup } from '@/domain/backup';
import { getProduct, listProducts, saveProduct } from '@/domain/products';
import { EMPLOYEE, makeCtx, type TestCtx } from '@/domain/testing/ctx';
import { getCart, putCart } from '@/state/cart';

import * as engine from './engine';
import {
  deleteBackup,
  firstBackup,
  lastCopied,
  listBackups,
  pickBackupFile,
  readBackupFile,
  restore,
  saveBackup,
  savedBackupUri,
  confirmCopied,
  shareCopy,
} from './store';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use imports
jest.mock('expo-file-system', () => require('@/testing/disk-fs').diskFs());
jest.mock('expo', () => ({ isRunningInExpoGo: () => false }));
jest.mock('@/db/expo-db', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use imports
  openExpoDbAt: (uri: string) => require('@/db/testing/node-db').openFileDb(uri),
}));
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
  };
});
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(() =>
    Promise.resolve({ canceled: false, assets: [{ uri: 'file:///picked.db' }] }),
  ),
}));

const fsMock = jest.requireMock('expo-file-system');
const { File, Directory, Paths } = fsMock;
const backupsDir = () => new Directory(Paths.document, 'Backups', 'jewelry');
const photosDir = () =>
  new Directory(
    Paths.document.parentDirectory,
    'Library',
    'Application Support',
    'SALFORD',
    'photos',
    'jewelry',
  );

let ctx: TestCtx;
let clock = new Date(2026, 10, 10, 9, 0, 0);
const tick = () => {
  clock = new Date(clock.getTime() + 60_000);
  ctx.setNow(clock);
};
const ring = () =>
  saveProduct(ctx, { name: 'Ring', category: 'خواتم', price: 350_000, cost: 1, stock: 3 });

beforeEach(() => {
  backupsDir().delete();
  photosDir().delete();
  new Directory(Paths.cache).delete();
  new Directory(Paths.cache).create();
  ctx = makeCtx('jewelry', clock);
});
afterEach(() => {
  jest.restoreAllMocks();
  ctx.close();
});

describe('saving on the device', () => {
  it('saves a copy that can be checked, and skips an automatic one when nothing changed', async () => {
    ring();
    const first = saveBackup(ctx, 'auto')!;
    expect(first.name).toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}\.\d{2}\.\d{2}_auto\.db$/);
    expect(firstBackup('jewelry')).toEqual(clock);
    tick();
    expect(saveBackup(ctx, 'auto')).toBeNull();
    // A manual backup is always saved.
    expect(saveBackup(ctx, 'manual')?.kind).toBe('manual');
    tick();
    ring();
    expect(saveBackup(ctx, 'auto')).not.toBeNull();
    expect(listBackups('jewelry')).toHaveLength(3);
    const picked = await readBackupFile(ctx, savedBackupUri('jewelry', first.name));
    expect(picked.contents.products).toBe(1);
  });

  it('keeps one automatic backup per hour: a newer one within the hour replaces it', () => {
    const at = (h: number, m: number) => {
      clock = new Date(2026, 10, 10, h, m, 0);
      ctx.setNow(clock);
    };
    ring();
    saveBackup(ctx, 'auto');
    at(9, 30);
    ring();
    const latest = saveBackup(ctx, 'auto')!;
    expect(listBackups('jewelry').map((b) => b.name)).toEqual([latest.name]);
    at(10, 31);
    ring();
    saveBackup(ctx, 'auto');
    expect(listBackups('jewelry')).toHaveLength(2);
  });

  it('skips an unchanged automatic backup after the app restarts too (same data, same file)', () => {
    ring();
    saveBackup(ctx, 'auto');
    // A new run of the app: a new connection to the same data.
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- a fresh copy of the module
      const fresh = require('./store') as typeof import('./store');
      tick();
      expect(fresh.saveBackup(ctx, 'auto')).toBeNull();
    });
  });

  it('never leaves or lists a half-written backup', () => {
    ring();
    const spy = jest.spyOn(engine, 'labelSnapshot').mockImplementation(() => {
      throw new Error('the app was closed in the middle');
    });
    expect(() => saveBackup(ctx, 'manual')).toThrow();
    spy.mockRestore();
    expect(listBackups('jewelry')).toEqual([]);
    // The next backup cleans the leftover.
    tick();
    saveBackup(ctx, 'manual');
    expect(
      backupsDir()
        .list()
        .map((f: { name: string }) => f.name),
    ).toEqual([listBackups('jewelry')[0].name]);
  });

  it('keeps the last 10', () => {
    for (let i = 0; i < 12; i++) {
      tick();
      saveBackup(ctx, 'manual');
    }
    expect(listBackups('jewelry')).toHaveLength(10);
  });
});

describe('copying off the device', () => {
  it('shares one file with the data and the photos, and remembers when', async () => {
    saveProduct(ctx, { name: 'Ring', category: 'خواتم', price: 1, stock: 1, imageFile: 'r.jpg' });
    new File(photosDir(), 'r.jpg').writeSync(new Uint8Array([1, 2, 3]));
    expect(lastCopied('jewelry')).toBeNull();
    const sharing = jest.requireMock('expo-sharing');
    let shared = '';
    let photos: Record<string, number[]> = {};
    sharing.shareAsync.mockImplementationOnce(async (uri: string) => {
      shared = uri;
      engine.eachPhoto(openFileDb, uri, (n, b) => (photos[n] = [...b]));
    });
    await shareCopy(ctx);
    expect(shared).toMatch(/\/jewelry_\d{4}-\d{2}-\d{2}_\d{2}\.\d{2}\.db$/);
    expect(photos).toEqual({ 'r.jpg': [1, 2, 3] });
    // iOS reports a cancelled share sheet like a sent one: only the owner's "yes" counts as a copy
    // off the device, and it is logged.
    expect(lastCopied('jewelry')).toBeNull();
    confirmCopied(ctx);
    expect(lastCopied('jewelry')).toEqual(clock);
    expect(
      ctx.db.get<{ action: string }>('SELECT action FROM activity ORDER BY id DESC LIMIT 1')
        ?.action,
    ).toBe('backup.copied');
    // It is also kept as a backup on this device; the shared file is not left in the cache.
    expect(listBackups('jewelry')[0].kind).toBe('manual');
    expect(new File(shared).exists).toBe(false);
    photos = {};
  });
});

describe('picking a backup', () => {
  it('lets every file be chosen: iOS has no type for a ".db" file, so asking for one greyed out every backup', async () => {
    const picker = jest.requireMock('expo-document-picker');
    await expect(pickBackupFile()).resolves.toBe('file:///picked.db');
    expect(picker.getDocumentAsync).toHaveBeenCalledWith(expect.objectContaining({ type: '*/*' }));
  });
});

describe('restoring', () => {
  it('refuses a damaged file, another system and anything that is not a backup', async () => {
    // Every file can be picked in Files (iOS has no type for ".db"): a photo is "not a backup".
    const bad = new File(Paths.cache, 'IMG_0001.jpg');
    bad.writeSync('not a database');
    await expect(readBackupFile(ctx, bad.uri)).rejects.toThrow('ليس نسخة');
    const scarves = makeCtx('scarves');
    const other = new File(Paths.cache, 'scarves.db');
    engine.writeSnapshot(scarves.db, openFileDb, other.uri, { system: 'scarves', madeAt: 'x' });
    scarves.close();
    await expect(readBackupFile(ctx, other.uri)).rejects.toThrow('نظام الأوشحة');
    // The file chosen is never changed by checking it.
    expect(other.exists).toBe(true);
  });

  it('saves the safety copy before replacing anything, and puts photos back', async () => {
    saveProduct(ctx, { name: 'Old', category: 'خواتم', price: 1, stock: 1, imageFile: 'o.jpg' });
    new File(photosDir(), 'o.jpg').writeSync(new Uint8Array([7, 7]));
    tick();
    let copy = '';
    jest.requireMock('expo-sharing').shareAsync.mockImplementationOnce(async (uri: string) => {
      copy = new File(Paths.cache, 'kept.db').uri;
      new File(uri).copySync(new File(copy));
    });
    await shareCopy(ctx);

    // Later: different data, and the photo is gone.
    saveProduct(ctx, { name: 'New', category: 'خواتم', price: 1, stock: 1 });
    new File(photosDir(), 'o.jpg').delete();
    const id = listProducts(ctx).find((p) => p.name === 'New')!.id;
    putCart('jewelry', [{ key: 'k', productId: id, name: 'New', quantity: 1, unitPrice: 1 }]);
    tick();

    const order: string[] = [];
    const realCopy = engine.copyDatabase;
    const realRestore = engine.restoreSnapshot;
    const restoreSpy = jest.spyOn(engine, 'restoreSnapshot');
    const copySpy = jest.spyOn(engine, 'copyDatabase');
    copySpy.mockImplementation((...a) => (order.push('safety copy'), realCopy(...a)));
    restoreSpy.mockImplementation((...a) => (order.push('replace'), realRestore(...a)));
    await restore(ctx, await readBackupFile(ctx, copy));
    copySpy.mockRestore();
    restoreSpy.mockRestore();
    expect(order).toEqual(['safety copy', 'replace']);

    expect(listProducts(ctx).map((p) => p.name)).toEqual(['Old']);
    expect([...new File(photosDir(), 'o.jpg').bytesSync()]).toEqual([7, 7]);
    expect(getCart('jewelry')).toEqual([]);

    // The safety copy holds the data before the restore, and can itself be restored.
    const safety = listBackups('jewelry').find((b) => b.kind === 'safety')!;
    await restore(ctx, await readBackupFile(ctx, savedBackupUri('jewelry', safety.name)));
    expect(
      listProducts(ctx)
        .map((p) => p.name)
        .sort(),
    ).toEqual(['New', 'Old']);
    expect(getProduct(ctx, id)?.name).toBe('New');
  });

  it('does not replace anything when the safety copy cannot be saved', async () => {
    ring();
    tick();
    const backup = saveBackup(ctx, 'manual')!;
    saveProduct(ctx, { name: 'After', category: 'خواتم', price: 1, stock: 1 });
    const picked = await readBackupFile(ctx, savedBackupUri('jewelry', backup.name));
    const spy = jest.spyOn(engine, 'copyDatabase').mockImplementation(() => {
      throw new Error('no space left on device');
    });
    await expect(restore(ctx, picked)).rejects.toThrow('no space');
    spy.mockRestore();
    expect(
      listProducts(ctx)
        .map((p) => p.name)
        .sort(),
    ).toEqual(['After', 'Ring']);
  });

  it('still restores a backup made before Phase 8 (.json, photos inside)', async () => {
    saveProduct(ctx, { name: 'Old', category: 'خواتم', price: 1, stock: 1, imageFile: 'j.jpg' });
    const old = new File(Paths.cache, 'SALFORD-jewelry-2026-11-01-100000-copy.json');
    old.writeSync(JSON.stringify({ ...exportBackup(ctx), photos: { 'j.jpg': 'AQI=' } }));
    saveProduct(ctx, { name: 'New', category: 'خواتم', price: 1, stock: 1 });
    tick();
    const picked = await readBackupFile(ctx, old.uri);
    expect(picked.contents).toMatchObject({ products: 1, photos: 1 });
    await restore(ctx, picked);
    expect(listProducts(ctx).map((p) => p.name)).toEqual(['Old']);
    expect([...new File(photosDir(), 'j.jpg').bytesSync()]).toEqual([1, 2]);
    expect(listBackups('jewelry').some((b) => b.kind === 'safety')).toBe(true);
  });
});

describe('who may', () => {
  it('refuses an employee restoring, copying off or deleting a backup, before touching anything', async () => {
    ring();
    const saved = saveBackup(ctx, 'manual')!;
    const picked = await readBackupFile(ctx, savedBackupUri('jewelry', saved.name));
    const before = listBackups('jewelry').map((b) => b.name);
    ctx.setActor(EMPLOYEE);
    await expect(restore(ctx, picked)).rejects.toThrow('استرجاع نسخة احتياطية: للمالك فقط.');
    await expect(shareCopy(ctx)).rejects.toThrow('النسخ الاحتياطي: للمالك فقط.');
    const copied = lastCopied('jewelry');
    expect(() => confirmCopied(ctx)).toThrow('النسخ الاحتياطي: للمالك فقط.');
    expect(lastCopied('jewelry')).toEqual(copied);
    expect(() => deleteBackup(ctx, saved.name)).toThrow('للمالك فقط');
    // No safety copy, no shared copy, nothing deleted.
    expect(listBackups('jewelry').map((b) => b.name)).toEqual(before);
    expect(listProducts(ctx)).toHaveLength(1);
  });
});
