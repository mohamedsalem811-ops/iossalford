/**
 * Tests only: expo-file-system on a real temporary folder (Node's fs), so backups made by SQLite
 * (VACUUM INTO, ATTACH) can be tested end to end with real files, fingerprints and renames:
 *
 *   jest.mock('expo-file-system', () => require('@/testing/disk-fs').diskFs());
 *
 * Documents is "<root>/Documents" and the cache "<root>/Library/Caches"; `__root` is the folder.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- Node-only modules, loaded in tests */
type Stat = { isDirectory(): boolean; size: number };
const fs = require('node:fs') as {
  mkdtempSync(prefix: string): string;
  mkdirSync(path: string, o: { recursive: boolean }): void;
  existsSync(path: string): boolean;
  statSync(path: string): Stat;
  readdirSync(path: string): string[];
  readFileSync(path: string, enc?: string): Uint8Array & { toString(enc?: string): string };
  writeFileSync(path: string, data: string | Uint8Array, enc?: string): void;
  copyFileSync(from: string, to: string): void;
  renameSync(from: string, to: string): void;
  rmSync(path: string, o?: { recursive?: boolean; force?: boolean }): void;
  openSync(path: string, flags: string): number;
  readSync(fd: number, buf: Uint8Array, off: number, len: number, pos: number | null): number;
  writeSync(fd: number, buf: Uint8Array): number;
  closeSync(fd: number): void;
  fstatSync(fd: number): { size: number };
};
const os = require('node:os') as { tmpdir(): string };
const crypto = require('node:crypto') as {
  createHash(a: string): { update(d: Uint8Array): { digest(e: string): string } };
};
/* eslint-enable @typescript-eslint/no-require-imports */

type Part = string | { uri: string };

export function diskFs() {
  const root = fs.mkdtempSync(`${os.tmpdir()}/salford-fs-`);
  const join = (parts: Part[]) =>
    parts
      .map((p) => (typeof p === 'string' ? p : p.uri))
      .join('/')
      .replace(/\/+/g, '/')
      .replace(/\/$/, '');
  const parentOf = (p: string) => p.slice(0, p.lastIndexOf('/'));
  const isDir = (p: string) => fs.existsSync(p) && fs.statSync(p).isDirectory();

  class File {
    uri: string;
    constructor(...parts: Part[]) {
      this.uri = join(parts);
    }
    get name() {
      return this.uri.split('/').pop()!;
    }
    get exists() {
      return fs.existsSync(this.uri) && !isDir(this.uri);
    }
    get md5() {
      if (!this.exists) return null;
      return crypto.createHash('md5').update(fs.readFileSync(this.uri)).digest('hex');
    }
    create(o?: { overwrite?: boolean }) {
      if (this.exists && !o?.overwrite) throw new Error(`exists: ${this.uri}`);
      fs.mkdirSync(parentOf(this.uri), { recursive: true });
      fs.writeFileSync(this.uri, '');
    }
    delete() {
      fs.rmSync(this.uri);
    }
    writeSync(content: string | Uint8Array, o?: { encoding?: string }) {
      fs.mkdirSync(parentOf(this.uri), { recursive: true });
      if (typeof content === 'string' && o?.encoding === 'base64')
        fs.writeFileSync(this.uri, content, 'base64');
      else fs.writeFileSync(this.uri, content);
    }
    async text() {
      return fs.readFileSync(this.uri, 'utf8').toString();
    }
    bytesSync() {
      return new Uint8Array(fs.readFileSync(this.uri));
    }
    copySync(to: File | Directory) {
      const target = to instanceof Directory ? `${to.uri}/${this.name}` : to.uri;
      fs.mkdirSync(parentOf(target), { recursive: true });
      fs.copyFileSync(this.uri, target);
    }
    get size() {
      return this.exists ? fs.statSync(this.uri).size : null;
    }
    /** A handle reading or writing the file one part at a time ('r', 'w' or 'wa'). */
    open(mode = 'r') {
      if (mode !== 'r') fs.mkdirSync(parentOf(this.uri), { recursive: true });
      const fd = fs.openSync(
        this.uri,
        mode === 'wa' ? 'a' : mode === 'w' || mode === 'wt' ? 'w' : 'r',
      );
      const readBytesSync = (n: number) => {
        const buf = new Uint8Array(n);
        const got = fs.readSync(fd, buf, 0, n, null);
        return buf.slice(0, got);
      };
      const writeBytesSync = (b: Uint8Array) => void fs.writeSync(fd, b);
      return {
        readBytesSync,
        readBytes: async (n: number) => readBytesSync(n),
        writeBytesSync,
        writeBytes: async (b: Uint8Array) => writeBytesSync(b),
        get size() {
          return fs.fstatSync(fd).size;
        },
        close: () => fs.closeSync(fd),
      };
    }
    rename(newName: string) {
      const target = `${parentOf(this.uri)}/${newName}`;
      if (fs.existsSync(target)) throw new Error(`exists: ${target}`);
      fs.renameSync(this.uri, target);
      this.uri = target;
    }
  }

  class Directory {
    uri: string;
    constructor(...parts: Part[]) {
      this.uri = join(parts);
    }
    get name() {
      return this.uri.split('/').pop()!;
    }
    get exists() {
      return isDir(this.uri);
    }
    get parentDirectory() {
      return new Directory(parentOf(this.uri));
    }
    create() {
      fs.mkdirSync(this.uri, { recursive: true });
    }
    delete() {
      fs.rmSync(this.uri, { recursive: true, force: true });
    }
    list(): (File | Directory)[] {
      if (!this.exists) return [];
      return fs
        .readdirSync(this.uri)
        .map((n) => `${this.uri}/${n}`)
        .map((p) => (isDir(p) ? new Directory(p) : new File(p)));
    }
  }

  const document = new Directory(`${root}/Documents`);
  const cache = new Directory(`${root}/Library/Caches`);
  document.create();
  cache.create();
  const FileMode = { ReadOnly: 'r', WriteOnly: 'w', Append: 'wa', Truncate: 'wt', ReadWrite: 'rw' };
  return { File, Directory, FileMode, Paths: { document, cache }, __root: root };
}
