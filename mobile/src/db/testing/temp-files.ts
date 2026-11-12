/** Tests only: a temporary folder on disk for database files (backups copy whole files). */
/* eslint-disable @typescript-eslint/no-require-imports -- Node-only modules, loaded in tests */
const fs = require('node:fs') as {
  mkdtempSync(prefix: string): string;
  rmSync(path: string, o: { recursive: boolean; force: boolean }): void;
  writeFileSync(path: string, data: string): void;
  existsSync(path: string): boolean;
};
const os = require('node:os') as { tmpdir(): string };
/* eslint-enable @typescript-eslint/no-require-imports */

export type TempDir = {
  /** The full path of a file in the folder. */
  at: (name: string) => string;
  write: (name: string, content: string) => void;
  exists: (name: string) => boolean;
  remove: () => void;
};

export function tempDir(): TempDir {
  const dir = fs.mkdtempSync(`${os.tmpdir()}/salford-`);
  return {
    at: (name) => `${dir}/${name}`,
    write: (name, content) => fs.writeFileSync(`${dir}/${name}`, content),
    exists: (name) => fs.existsSync(`${dir}/${name}`),
    remove: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}
