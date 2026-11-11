/**
 * The backup store against an in-memory file system (the device's own is not available in
 * tests) and a real database: saving, skipping identical automatic backups, keeping 10, copying
 * off the device with photos, checking a file, and restoring with a safety copy.
 */
import { exportBackup } from '@/domain/backup';
import { getProduct, listProducts, saveProduct } from '@/domain/products';
import { makeCtx, type TestCtx } from '@/domain/testing/ctx';
import { getCart, putCart } from '@/state/cart';

import {
  firstBackup,
  lastCopied,
  listBackups,
  readBackupFile,
  restore,
  saveBackup,
  savedBackupUri,
  shareCopy,
} from './store';

jest.mock('expo-file-system', () => {
  const files = new Map<string, string>();
  const dirs = new Set<string>();
  const join = (parts: unknown[]) =>
    parts.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/');
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get name() {
      return this.uri.split('/').pop()!;
    }
    get exists() {
      return files.has(this.uri);
    }
    create() {
      files.set(this.uri, '');
    }
    delete() {
      files.delete(this.uri);
    }
    writeSync(content: string, o?: { encoding?: string }) {
      files.set(this.uri, o?.encoding === 'base64' ? `b64:${content}` : content);
    }
    async text() {
      if (!files.has(this.uri)) throw new Error('missing');
      return files.get(this.uri)!;
    }
    async base64() {
      return files.get(this.uri)!.replace(/^b64:/, '');
    }
  }
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return dirs.has(this.uri);
    }
    create() {
      dirs.add(this.uri);
    }
    list() {
      return [...files.keys()]
        .filter((k) => k.startsWith(`${this.uri}/`) && !k.slice(this.uri.length + 1).includes('/'))
        .map((k) => new File(k));
    }
  }
  return { File, Directory, Paths: { document: 'doc', cache: 'cache' }, __files: files };
});
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
  };
});
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('expo-document-picker', () => ({}));

const files: Map<string, string> = jest.requireMock('expo-file-system').__files;

let ctx: TestCtx;
let clock = new Date(2026, 10, 10, 9, 0, 0);
const tick = () => {
  clock = new Date(clock.getTime() + 60_000);
  ctx.setNow(clock);
};
beforeEach(() => {
  files.clear();
  ctx = makeCtx('jewelry');
  tick();
});
afterEach(() => ctx.close());

describe('saving backups on the device', () => {
  it('saves one now, and skips an automatic one when nothing changed', () => {
    saveProduct(ctx, { name: 'Ring', category: 'خواتم', price: 1, stock: 1 });
    expect(saveBackup(ctx, 'manual')?.kind).toBe('manual');
    tick();
    expect(saveBackup(ctx, 'auto')).toBeNull();
    saveProduct(ctx, { name: 'Chain', category: 'سلاسل', price: 1, stock: 1 });
    tick();
    expect(saveBackup(ctx, 'auto')?.kind).toBe('auto');
    expect(listBackups('jewelry').map((b) => b.kind)).toEqual(['auto', 'manual']);
  });

  it('keeps the last 10', () => {
    for (let i = 0; i < 12; i++) {
      saveProduct(ctx, { name: `P${i}`, category: 'خواتم', price: 1, stock: 1 });
      tick();
      saveBackup(ctx, 'auto');
    }
    const list = listBackups('jewelry');
    expect(list).toHaveLength(10);
    // The first backup's date is kept for the reminder, though that file is gone.
    expect(firstBackup('jewelry')!.getTime()).toBeLessThan(list[9].at.getTime());
    expect(list[0].at.getTime()).toBeGreaterThan(list[9].at.getTime());
  });
});

describe('copying off the device', () => {
  it('shares one file with the data and the photos, and remembers when', async () => {
    saveProduct(ctx, { name: 'Ring', category: 'خواتم', price: 1, stock: 1, imageFile: 'r.jpg' });
    files.set('doc/photos/jewelry/r.jpg', 'b64:AAAA');
    expect(lastCopied('jewelry')).toBeNull();
    await shareCopy(ctx);
    const copy = [...files.keys()].find((k) => k.startsWith('cache/'))!;
    expect(copy).toMatch(/SALFORD-jewelry-.*-copy\.json$/);
    expect(JSON.parse(files.get(copy)!).photos).toEqual({ 'r.jpg': 'AAAA' });
    expect(lastCopied('jewelry')).toEqual(clock);
    // It is also kept as a backup on this device.
    expect(listBackups('jewelry')[0].kind).toBe('manual');
  });
});

describe('restoring', () => {
  it('refuses a damaged file, another system and anything that is not a backup', async () => {
    files.set('cache/bad.json', '{"format":"salford-pos-backup"');
    await expect(readBackupFile(ctx, 'cache/bad.json')).rejects.toThrow(
      'هذا الملف ليس نسخة احتياطية من SALFORD POS',
    );
    const scarves = makeCtx('scarves');
    files.set('cache/scarves.json', JSON.stringify(exportBackup(scarves)));
    scarves.close();
    await expect(readBackupFile(ctx, 'cache/scarves.json')).rejects.toThrow('نظام الأوشحة');
    const b = exportBackup(ctx);
    files.set('cache/edited.json', JSON.stringify({ ...b, sequences: { products: 99 } }));
    await expect(readBackupFile(ctx, 'cache/edited.json')).rejects.toThrow('تالف');
  });

  it('replaces the data, keeps a safety copy of what it replaced, puts photos back', async () => {
    saveProduct(ctx, { name: 'Old', category: 'خواتم', price: 1, stock: 1, imageFile: 'o.jpg' });
    files.set('doc/photos/jewelry/o.jpg', 'b64:OOOO');
    tick();
    await shareCopy(ctx);
    const copy = [...files.keys()].find((k) => k.startsWith('cache/'))!;

    // Later: different data, and the photo is gone.
    saveProduct(ctx, { name: 'New', category: 'خواتم', price: 1, stock: 1 });
    files.delete('doc/photos/jewelry/o.jpg');
    const id = listProducts(ctx).find((p) => p.name === 'New')!.id;
    putCart('jewelry', [{ key: 'k', productId: id, name: 'New', quantity: 1, unitPrice: 1 }]);
    tick();

    await restore(ctx, await readBackupFile(ctx, copy));
    expect(listProducts(ctx).map((p) => p.name)).toEqual(['Old']);
    expect(files.get('doc/photos/jewelry/o.jpg')).toBe('b64:OOOO');
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
});
