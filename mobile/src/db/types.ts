/**
 * The small database interface every business rule uses. Two implementations run the same SQL:
 * expo-sqlite in the app (expo-db.ts) and Node's built-in SQLite in tests (testing/node-db.ts).
 */

/** A value SQLite stores; Uint8Array is a BLOB (photos inside a copy made to leave the device). */
export type SqlValue = string | number | null | Uint8Array;
export type Params = readonly (SqlValue | undefined | boolean)[];

export type RunResult = { changes: number; lastInsertRowId: number };

export interface Db {
  /** Runs one or more statements with no parameters (schema, pragmas). */
  exec(sql: string): void;
  /** Runs one statement; returns changed rows and the new row id. */
  run(sql: string, params?: Params): RunResult;
  /** All rows of a query. */
  all<T>(sql: string, params?: Params): T[];
  /** The first row of a query, or undefined. */
  get<T>(sql: string, params?: Params): T | undefined;
  /**
   * Runs `fn` all-or-nothing: if it throws, every change it made is rolled back and the error
   * is re-thrown. Nested calls join the outer transaction.
   */
  transaction<T>(fn: () => T): T;
  close(): void;
}

/** Turns booleans into 0/1 and undefined into null, as SQLite expects. */
export function bindable(params: Params = []): SqlValue[] {
  return params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p));
}

/** Shared transaction logic for both implementations. */
export function makeTransaction(exec: (sql: string) => void) {
  let depth = 0;
  return function transaction<T>(fn: () => T): T {
    if (depth > 0) {
      depth++;
      try {
        return fn();
      } finally {
        depth--;
      }
    }
    depth = 1;
    exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      exec('COMMIT');
      return result;
    } catch (error) {
      // The first error is the one to report (audit F-10): an undo that fails too (a full disk)
      // must not replace it. SQLite has already undone the transaction in that case.
      try {
        exec('ROLLBACK');
      } catch {
        // Nothing more to undo.
      }
      throw error;
    } finally {
      depth = 0;
    }
  };
}
