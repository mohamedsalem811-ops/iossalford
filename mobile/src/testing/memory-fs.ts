/**
 * An in-memory stand-in for expo-file-system (the device's own is not available in tests):
 *
 *   jest.mock('expo-file-system', () => require('@/testing/memory-fs').memoryFs());
 *
 * Paths: Documents is "container/Documents" (its parent is the app's container), the cache is
 * "container/Library/Caches". `__files` (uri → content) and `__dirs` let a test look inside, and
 * `__failMoves` makes the next moves throw.
 */
type Part = string | { uri: string };

export function memoryFs() {
  const files = new Map<string, string>();
  const dirs = new Set<string>();
  const failMoves = { count: 0 };
  const join = (parts: Part[]) =>
    parts
      .map((p) => (typeof p === 'string' ? p : p.uri))
      .join('/')
      .replace(/\/+/g, '/')
      .replace(/\/$/, '');
  const parentOf = (uri: string) => uri.slice(0, uri.lastIndexOf('/'));
  const addParents = (uri: string) => {
    for (let p = parentOf(uri); p; p = parentOf(p)) dirs.add(p);
  };

  class File {
    uri: string;
    constructor(...parts: Part[]) {
      this.uri = join(parts);
    }
    get name() {
      return this.uri.split('/').pop()!;
    }
    get exists() {
      return files.has(this.uri);
    }
    get size() {
      return files.get(this.uri)?.length ?? 0;
    }
    get parentDirectory() {
      return new Directory(parentOf(this.uri));
    }
    create(o?: { overwrite?: boolean }) {
      if (files.has(this.uri) && !o?.overwrite) throw new Error(`exists: ${this.uri}`);
      addParents(this.uri);
      files.set(this.uri, '');
    }
    delete() {
      if (!files.delete(this.uri)) throw new Error(`missing: ${this.uri}`);
    }
    write(content: string, o?: { encoding?: string }) {
      this.writeSync(content, o);
    }
    writeSync(content: string, o?: { encoding?: string }) {
      addParents(this.uri);
      files.set(this.uri, o?.encoding === 'base64' ? `b64:${content}` : content);
    }
    textSync() {
      if (!files.has(this.uri)) throw new Error(`missing: ${this.uri}`);
      return files.get(this.uri)!;
    }
    async text() {
      return this.textSync();
    }
    async base64() {
      return this.textSync().replace(/^b64:/, '');
    }
    moveSync(to: File | Directory) {
      if (failMoves.count > 0) {
        failMoves.count--;
        throw new Error('move failed');
      }
      const target = to instanceof Directory ? new File(to, this.name) : to;
      if (files.has(target.uri)) throw new Error(`exists: ${target.uri}`);
      const content = this.textSync();
      files.delete(this.uri);
      addParents(target.uri);
      files.set(target.uri, content);
      this.uri = target.uri;
    }
    async move(to: File | Directory) {
      this.moveSync(to);
    }
    copySync(to: File | Directory) {
      const target = to instanceof Directory ? new File(to, this.name) : to;
      addParents(target.uri);
      files.set(target.uri, this.textSync());
    }
    rename(newName: string) {
      this.moveSync(new File(parentOf(this.uri), newName));
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
      return dirs.has(this.uri);
    }
    get parentDirectory() {
      return new Directory(parentOf(this.uri));
    }
    create() {
      addParents(`${this.uri}/x`);
    }
    delete() {
      for (const k of [...files.keys()]) if (k.startsWith(`${this.uri}/`)) files.delete(k);
      for (const d of [...dirs]) if (d === this.uri || d.startsWith(`${this.uri}/`)) dirs.delete(d);
    }
    list(): (File | Directory)[] {
      const prefix = `${this.uri}/`;
      const direct = (k: string) => k.startsWith(prefix) && !k.slice(prefix.length).includes('/');
      return [
        ...[...dirs].filter(direct).map((d) => new Directory(d)),
        ...[...files.keys()].filter(direct).map((k) => new File(k)),
      ];
    }
  }

  const document = new Directory('container/Documents');
  const cache = new Directory('container/Library/Caches');
  dirs.add('container/Documents');
  dirs.add('container/Library/Caches');
  addParents('container/Documents/x');
  return {
    File,
    Directory,
    Paths: { document, cache },
    __files: files,
    __dirs: dirs,
    __failMoves: failMoves,
  };
}
