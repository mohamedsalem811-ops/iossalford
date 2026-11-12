import type { Db } from './types';

/** A statement that changes data (not a read, a pragma or a backup copy). */
const WRITES = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i;
const writesData = (sql: string) => sql.split(';').some((statement) => WRITES.test(statement));

/**
 * The open system's database, telling `onChange` after every change to its data: each saved
 * statement outside a transaction, or once when a transaction that changed something commits.
 * Screens re-read when told, so no save can forget to refresh them; a transaction that fails
 * (rolled back) changes nothing and tells nothing.
 */
export function withChangeSignal(db: Db, onChange: () => void): Db {
  let depth = 0;
  let changed = false;
  const mark = () => {
    if (depth > 0) changed = true;
    else onChange();
  };
  return {
    exec(sql) {
      db.exec(sql);
      if (writesData(sql)) mark();
    },
    run(sql, params) {
      const r = db.run(sql, params);
      if (r.changes > 0 && writesData(sql)) mark();
      return r;
    },
    all: (sql, params) => db.all(sql, params),
    get: (sql, params) => db.get(sql, params),
    transaction(fn) {
      depth++;
      try {
        const result = db.transaction(fn);
        if (depth === 1 && changed) onChange();
        return result;
      } finally {
        depth--;
        if (depth === 0) changed = false;
      }
    },
    close: () => db.close(),
  };
}
