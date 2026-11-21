/**
 * Database schema, one file per system (jewelry.db, scarves.db), changed only by adding a new
 * migration at the end of the list. Never edit a migration that has shipped.
 *
 * Money: LYD in whole dirhams (1 LYD = 1000), USD in cents, exchange rates in thousandths of a
 * dinar per dollar. Ids use AUTOINCREMENT, so SQLite never reuses an id after a delete (old
 * sales, returns and payments can never point at a new record). Dates are ISO 8601 text in local
 * time; `month` columns are "YYYY-MM" keys.
 */

import { nameKey } from '@/lib/names';

import type { Db } from './types';

/**
 * One database version. `sql` runs first; `after` (optional) then fills what SQL can't compute,
 * in the same all-or-nothing step.
 */
export type Migration = {
  version: number;
  name: string;
  sql: string;
  after?: (db: Db) => void;
};

/**
 * Fills customers.name_key where it is missing: after the upgrade to database 8, and after a
 * restore from a backup made before it.
 */
export function fillNameKeys(db: Db) {
  for (const c of db.all<{ id: number; name: string }>(
    'SELECT id, name FROM customers WHERE name_key IS NULL',
  ))
    db.run('UPDATE customers SET name_key = ? WHERE id = ?', [nameKey(c.name), c.id]);
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial schema',
    sql: `
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE brands (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(trim(name)) > 0),
  image_file TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE products (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  sku            TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name           TEXT NOT NULL CHECK (length(trim(name)) > 0),
  brand_id       INTEGER REFERENCES brands(id) ON DELETE SET NULL,
  category       TEXT NOT NULL DEFAULT '',
  design_id      TEXT,
  size           TEXT,
  color          TEXT,
  cost           INTEGER NOT NULL DEFAULT 0 CHECK (cost >= 0),
  cost_usd       INTEGER CHECK (cost_usd IS NULL OR cost_usd >= 0),
  cost_rate      INTEGER CHECK (cost_rate IS NULL OR cost_rate > 0),
  price          INTEGER NOT NULL CHECK (price >= 0),
  stock          INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  low_stock      INTEGER NOT NULL DEFAULT 2 CHECK (low_stock >= 0),
  image_file     TEXT,
  archived       INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX products_design ON products(design_id);
CREATE INDEX products_brand ON products(brand_id);

-- Every change to stock with its reason (sale, return, adjustment, deleted sale).
CREATE TABLE stock_moves (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  delta      INTEGER NOT NULL CHECK (delta <> 0),
  kind       TEXT NOT NULL CHECK (kind IN ('initial', 'adjust', 'sale', 'return', 'sale_deleted', 'return_deleted')),
  reason     TEXT,
  ref_id     INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX stock_moves_product ON stock_moves(product_id);

CREATE TABLE customers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL CHECK (length(trim(name)) > 0),
  phone      TEXT,
  phone_key  TEXT UNIQUE,
  area       TEXT,
  notes      TEXT,
  created_at TEXT NOT NULL
);

-- One checkout = one sale with one or more lines.
CREATE TABLE sales (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at     TEXT NOT NULL,
  month          TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer', 'credit')),
  customer_id    INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name  TEXT,
  note           TEXT,
  rate           INTEGER NOT NULL CHECK (rate > 0),
  total          INTEGER NOT NULL,
  total_cost     INTEGER NOT NULL
);
CREATE INDEX sales_month ON sales(month);
CREATE INDEX sales_customer ON sales(customer_id);

-- Each line keeps its own copy of what was sold, so later product edits never change history.
CREATE TABLE sale_lines (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id      INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id   INTEGER NOT NULL,
  name         TEXT NOT NULL,
  sku          TEXT NOT NULL,
  brand        TEXT,
  category     TEXT,
  size         TEXT,
  color        TEXT,
  quantity     INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost    INTEGER NOT NULL,
  list_price   INTEGER NOT NULL,
  unit_price   INTEGER NOT NULL,
  line_total   INTEGER NOT NULL,
  line_cost    INTEGER NOT NULL,
  set_id       INTEGER,
  set_name     TEXT,
  bundle_group TEXT
);
CREATE INDEX sale_lines_sale ON sale_lines(sale_id);
CREATE INDEX sale_lines_product ON sale_lines(product_id);

CREATE TABLE returns (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_line_id INTEGER REFERENCES sale_lines(id) ON DELETE CASCADE,
  product_id   INTEGER NOT NULL,
  name         TEXT NOT NULL,
  quantity     INTEGER NOT NULL CHECK (quantity > 0),
  refund       INTEGER NOT NULL CHECK (refund >= 0),
  cost         INTEGER NOT NULL CHECK (cost >= 0),
  reason       TEXT,
  created_at   TEXT NOT NULL,
  month        TEXT NOT NULL
);
CREATE INDEX returns_line ON returns(sale_line_id);
CREATE INDEX returns_month ON returns(month);

CREATE TABLE payments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  amount      INTEGER NOT NULL CHECK (amount > 0),
  method      TEXT NOT NULL,
  note        TEXT,
  created_at  TEXT NOT NULL,
  month       TEXT NOT NULL
);
CREATE INDEX payments_customer ON payments(customer_id);

CREATE TABLE expenses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL CHECK (length(trim(description)) > 0),
  amount      INTEGER NOT NULL CHECK (amount > 0),
  month       TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX expenses_month ON expenses(month);

CREATE TABLE sets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL CHECK (length(trim(name)) > 0),
  description TEXT,
  discount    INTEGER NOT NULL DEFAULT 0 CHECK (discount >= 0),
  created_at  TEXT NOT NULL
);

CREATE TABLE set_items (
  set_id     INTEGER NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (set_id, product_id)
);

CREATE TABLE receipts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_no TEXT NOT NULL UNIQUE,
  date       TEXT NOT NULL,
  time       TEXT NOT NULL,
  customer   TEXT NOT NULL,
  template   TEXT NOT NULL,
  show_prices INTEGER NOT NULL DEFAULT 1 CHECK (show_prices IN (0, 1)),
  sale_id    INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT
);
CREATE INDEX receipts_sale ON receipts(sale_id);

CREATE TABLE receipt_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_id INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  name       TEXT NOT NULL,
  brand      TEXT,
  color      TEXT,
  code       TEXT,
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  price      INTEGER NOT NULL CHECK (price >= 0)
);
CREATE INDEX receipt_items_receipt ON receipt_items(receipt_id);

CREATE TABLE closings (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  period_key     TEXT NOT NULL UNIQUE,
  title          TEXT NOT NULL,
  total_sales    INTEGER NOT NULL,
  total_cost     INTEGER NOT NULL,
  total_expenses INTEGER NOT NULL,
  total_refunds  INTEGER NOT NULL,
  net_profit     INTEGER NOT NULL,
  transactions   INTEGER NOT NULL,
  items_sold     INTEGER NOT NULL,
  notes          TEXT,
  closed_at      TEXT NOT NULL
);
`,
  },
  {
    // Staff phase S2: who made each sale and each receipt, so an employee sees only their own
    // and the owner sees them per person. "owner" or "emp-<id>"; older rows (NULL) were all the
    // owner's. The name is a copy, kept even after the person is suspended or renamed.
    version: 2,
    name: 'seller of each sale and receipt',
    sql: `
ALTER TABLE sales ADD COLUMN seller TEXT;
ALTER TABLE sales ADD COLUMN seller_name TEXT;
CREATE INDEX sales_seller ON sales(seller, month);
ALTER TABLE receipts ADD COLUMN issued_by TEXT;
ALTER TABLE receipts ADD COLUMN issued_by_name TEXT;
CREATE INDEX receipts_issued_by ON receipts(issued_by);
`,
  },
  {
    // Staff phase S3:
    // - who did each return, payment, stock change and expense ("owner" or "emp-<id>", with a
    //   copy of the name; older rows, NULL, were the owner's);
    // - the activity log: every action, sign-in and wrong PIN, one line each, never changed.
    //   Each line carries the fingerprint (SHA-256) of the line before, so a line changed or
    //   removed outside the app breaks the chain;
    // - a unique id and the device's id on every record, for syncing the iPhone and the iPad
    //   later. Filled by the database itself on every new row; older rows get an id now and no
    //   device.
    version: 3,
    name: 'who did what, activity log, unique ids',
    sql: `
ALTER TABLE returns ADD COLUMN by TEXT;
ALTER TABLE returns ADD COLUMN by_name TEXT;
ALTER TABLE payments ADD COLUMN by TEXT;
ALTER TABLE payments ADD COLUMN by_name TEXT;
ALTER TABLE stock_moves ADD COLUMN by TEXT;
ALTER TABLE stock_moves ADD COLUMN by_name TEXT;
ALTER TABLE expenses ADD COLUMN by TEXT;
ALTER TABLE expenses ADD COLUMN by_name TEXT;

CREATE TABLE activity (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  at         TEXT NOT NULL,
  day        TEXT NOT NULL,
  actor      TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  action     TEXT NOT NULL,
  summary    TEXT NOT NULL,
  details    TEXT,
  prev_hash  TEXT NOT NULL,
  hash       TEXT NOT NULL,
  uid        TEXT,
  device     TEXT
);
CREATE INDEX activity_day ON activity(day, id);
CREATE INDEX activity_actor ON activity(actor, id);

ALTER TABLE brands ADD COLUMN uid TEXT;
ALTER TABLE brands ADD COLUMN device TEXT;
UPDATE brands SET uid = lower(hex(randomblob(16)));
CREATE UNIQUE INDEX brands_uid ON brands(uid);
CREATE TRIGGER brands_new_uid AFTER INSERT ON brands WHEN NEW.uid IS NULL BEGIN
  UPDATE brands SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
ALTER TABLE products ADD COLUMN uid TEXT;
ALTER TABLE products ADD COLUMN device TEXT;
UPDATE products SET uid = lower(hex(randomblob(16)));
CREATE UNIQUE INDEX products_uid ON products(uid);
CREATE TRIGGER products_new_uid AFTER INSERT ON products WHEN NEW.uid IS NULL BEGIN
  UPDATE products SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
ALTER TABLE stock_moves ADD COLUMN uid TEXT;
ALTER TABLE stock_moves ADD COLUMN device TEXT;
UPDATE stock_moves SET uid = lower(hex(randomblob(16)));
CREATE UNIQUE INDEX stock_moves_uid ON stock_moves(uid);
CREATE TRIGGER stock_moves_new_uid AFTER INSERT ON stock_moves WHEN NEW.uid IS NULL BEGIN
  UPDATE stock_moves SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
ALTER TABLE customers ADD COLUMN uid TEXT;
ALTER TABLE customers ADD COLUMN device TEXT;
UPDATE customers SET uid = lower(hex(randomblob(16)));
CREATE UNIQUE INDEX customers_uid ON customers(uid);
CREATE TRIGGER customers_new_uid AFTER INSERT ON customers WHEN NEW.uid IS NULL BEGIN
  UPDATE customers SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
ALTER TABLE sales ADD COLUMN uid TEXT;
ALTER TABLE sales ADD COLUMN device TEXT;
UPDATE sales SET uid = lower(hex(randomblob(16)));
CREATE UNIQUE INDEX sales_uid ON sales(uid);
CREATE TRIGGER sales_new_uid AFTER INSERT ON sales WHEN NEW.uid IS NULL BEGIN
  UPDATE sales SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
ALTER TABLE sale_lines ADD COLUMN uid TEXT;
ALTER TABLE sale_lines ADD COLUMN device TEXT;
UPDATE sale_lines SET uid = lower(hex(randomblob(16)));
CREATE UNIQUE INDEX sale_lines_uid ON sale_lines(uid);
CREATE TRIGGER sale_lines_new_uid AFTER INSERT ON sale_lines WHEN NEW.uid IS NULL BEGIN
  UPDATE sale_lines SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
ALTER TABLE returns ADD COLUMN uid TEXT;
ALTER TABLE returns ADD COLUMN device TEXT;
UPDATE returns SET uid = lower(hex(randomblob(16)));
CREATE UNIQUE INDEX returns_uid ON returns(uid);
CREATE TRIGGER returns_new_uid AFTER INSERT ON returns WHEN NEW.uid IS NULL BEGIN
  UPDATE returns SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
ALTER TABLE payments ADD COLUMN uid TEXT;
ALTER TABLE payments ADD COLUMN device TEXT;
UPDATE payments SET uid = lower(hex(randomblob(16)));
CREATE UNIQUE INDEX payments_uid ON payments(uid);
CREATE TRIGGER payments_new_uid AFTER INSERT ON payments WHEN NEW.uid IS NULL BEGIN
  UPDATE payments SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
ALTER TABLE expenses ADD COLUMN uid TEXT;
ALTER TABLE expenses ADD COLUMN device TEXT;
UPDATE expenses SET uid = lower(hex(randomblob(16)));
CREATE UNIQUE INDEX expenses_uid ON expenses(uid);
CREATE TRIGGER expenses_new_uid AFTER INSERT ON expenses WHEN NEW.uid IS NULL BEGIN
  UPDATE expenses SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
ALTER TABLE sets ADD COLUMN uid TEXT;
ALTER TABLE sets ADD COLUMN device TEXT;
UPDATE sets SET uid = lower(hex(randomblob(16)));
CREATE UNIQUE INDEX sets_uid ON sets(uid);
CREATE TRIGGER sets_new_uid AFTER INSERT ON sets WHEN NEW.uid IS NULL BEGIN
  UPDATE sets SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
ALTER TABLE receipts ADD COLUMN uid TEXT;
ALTER TABLE receipts ADD COLUMN device TEXT;
UPDATE receipts SET uid = lower(hex(randomblob(16)));
CREATE UNIQUE INDEX receipts_uid ON receipts(uid);
CREATE TRIGGER receipts_new_uid AFTER INSERT ON receipts WHEN NEW.uid IS NULL BEGIN
  UPDATE receipts SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
ALTER TABLE receipt_items ADD COLUMN uid TEXT;
ALTER TABLE receipt_items ADD COLUMN device TEXT;
UPDATE receipt_items SET uid = lower(hex(randomblob(16)));
CREATE UNIQUE INDEX receipt_items_uid ON receipt_items(uid);
CREATE TRIGGER receipt_items_new_uid AFTER INSERT ON receipt_items WHEN NEW.uid IS NULL BEGIN
  UPDATE receipt_items SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
ALTER TABLE closings ADD COLUMN uid TEXT;
ALTER TABLE closings ADD COLUMN device TEXT;
UPDATE closings SET uid = lower(hex(randomblob(16)));
CREATE UNIQUE INDEX closings_uid ON closings(uid);
CREATE TRIGGER closings_new_uid AFTER INSERT ON closings WHEN NEW.uid IS NULL BEGIN
  UPDATE closings SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
CREATE UNIQUE INDEX activity_uid ON activity(uid);
CREATE TRIGGER activity_new_uid AFTER INSERT ON activity WHEN NEW.uid IS NULL BEGIN
  UPDATE activity SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
`,
  },
  {
    version: 4,
    name: 'discounts, return rules, exchanges, employee accounts',
    sql: `
ALTER TABLE sales ADD COLUMN discount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN discount_reason TEXT;
ALTER TABLE sales ADD COLUMN approved_by TEXT;
ALTER TABLE returns ADD COLUMN photo TEXT;
ALTER TABLE returns ADD COLUMN conditions TEXT;
ALTER TABLE returns ADD COLUMN override_reason TEXT;
ALTER TABLE returns ADD COLUMN approved_by TEXT;
ALTER TABLE returns ADD COLUMN exchange_sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL;
CREATE TABLE staff_ledger (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  employee      TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('charge', 'repay', 'waive')),
  amount        INTEGER NOT NULL CHECK (amount > 0),
  return_id     INTEGER REFERENCES returns(id) ON DELETE SET NULL,
  note          TEXT,
  created_at    TEXT NOT NULL,
  month         TEXT NOT NULL,
  by            TEXT,
  by_name       TEXT,
  uid           TEXT,
  device        TEXT
);
CREATE INDEX staff_ledger_employee ON staff_ledger(employee, id);
CREATE INDEX staff_ledger_return ON staff_ledger(return_id);
CREATE UNIQUE INDEX staff_ledger_uid ON staff_ledger(uid);
CREATE TRIGGER staff_ledger_new_uid AFTER INSERT ON staff_ledger WHEN NEW.uid IS NULL BEGIN
  UPDATE staff_ledger SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
`,
  },
  {
    version: 5,
    name: 'shifts and cash moves',
    sql: `
CREATE TABLE shifts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  person        TEXT NOT NULL,
  person_name   TEXT NOT NULL,
  opened_at     TEXT NOT NULL,
  opening_cash  INTEGER NOT NULL CHECK (opening_cash >= 0),
  closed_at     TEXT,
  counted_cash  INTEGER,
  expected_cash INTEGER,
  note          TEXT,
  closed_by     TEXT,
  closed_by_name TEXT,
  uid           TEXT,
  device        TEXT
);
CREATE UNIQUE INDEX shifts_one_open ON shifts(person) WHERE closed_at IS NULL;
CREATE INDEX shifts_opened ON shifts(opened_at);
CREATE UNIQUE INDEX shifts_uid ON shifts(uid);
CREATE TRIGGER shifts_new_uid AFTER INSERT ON shifts WHEN NEW.uid IS NULL BEGIN
  UPDATE shifts SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
CREATE TABLE cash_moves (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_id   INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('in', 'out')),
  amount     INTEGER NOT NULL CHECK (amount > 0),
  reason     TEXT NOT NULL,
  created_at TEXT NOT NULL,
  by         TEXT,
  by_name    TEXT,
  uid        TEXT,
  device     TEXT
);
CREATE INDEX cash_moves_shift ON cash_moves(shift_id);
CREATE UNIQUE INDEX cash_moves_uid ON cash_moves(uid);
CREATE TRIGGER cash_moves_new_uid AFTER INSERT ON cash_moves WHEN NEW.uid IS NULL BEGIN
  UPDATE cash_moves SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
ALTER TABLE sales ADD COLUMN shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL;
ALTER TABLE returns ADD COLUMN shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL;
ALTER TABLE staff_ledger ADD COLUMN shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL;
CREATE INDEX sales_shift ON sales(shift_id);
CREATE INDEX returns_shift ON returns(shift_id);
CREATE INDEX payments_shift ON payments(shift_id);
`,
  },
  {
    version: 6,
    name: 'stock counts',
    sql: `
-- A stock count (phase S6): pieces counted without seeing the stock (blind), then the owner
-- applies the differences as stock changes with the reason "جرد".
CREATE TABLE stock_counts (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  status            TEXT NOT NULL CHECK (status IN ('open', 'submitted', 'applied', 'cancelled')),
  started_at        TEXT NOT NULL,
  by                TEXT NOT NULL,
  by_name           TEXT NOT NULL,
  submitted_at      TEXT,
  submitted_by      TEXT,
  submitted_by_name TEXT,
  done_at           TEXT,
  done_by           TEXT,
  done_by_name      TEXT,
  note              TEXT,
  uid               TEXT,
  device            TEXT
);
CREATE UNIQUE INDEX stock_counts_one_open ON stock_counts(status) WHERE status = 'open';
CREATE UNIQUE INDEX stock_counts_uid ON stock_counts(uid);
CREATE TRIGGER stock_counts_new_uid AFTER INSERT ON stock_counts WHEN NEW.uid IS NULL BEGIN
  UPDATE stock_counts SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
-- One line per piece counted. "expected" is the stock when the count was sent to the owner;
-- "applied" the change made to the stock when the owner applied it.
CREATE TABLE stock_count_lines (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  count_id   INTEGER NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  counted    INTEGER NOT NULL CHECK (counted >= 0),
  expected   INTEGER,
  applied    INTEGER,
  counted_at TEXT NOT NULL,
  by         TEXT,
  by_name    TEXT,
  uid        TEXT,
  device     TEXT,
  UNIQUE (count_id, product_id)
);
CREATE UNIQUE INDEX stock_count_lines_uid ON stock_count_lines(uid);
CREATE TRIGGER stock_count_lines_new_uid AFTER INSERT ON stock_count_lines WHEN NEW.uid IS NULL BEGIN
  UPDATE stock_count_lines SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
`,
  },
  {
    version: 7,
    name: 'customer credit paid back, alert indexes',
    sql: `
-- Money the shop pays back to a customer it owes ("له رصيد"), from the full audit after S6
-- (F-4). It adds to what the customer owes, like a payment the other way.
CREATE TABLE payouts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  amount      INTEGER NOT NULL CHECK (amount > 0),
  method      TEXT NOT NULL,
  note        TEXT,
  created_at  TEXT NOT NULL,
  month       TEXT NOT NULL,
  by          TEXT,
  by_name     TEXT,
  shift_id    INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
  uid         TEXT,
  device      TEXT
);
CREATE INDEX payouts_customer ON payouts(customer_id);
CREATE INDEX payouts_shift ON payouts(shift_id);
CREATE UNIQUE INDEX payouts_uid ON payouts(uid);
CREATE TRIGGER payouts_new_uid AFTER INSERT ON payouts WHEN NEW.uid IS NULL BEGIN
  UPDATE payouts SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
-- The owner's alerts look at the last days by time (F-5): without these, every sale ever made.
CREATE INDEX sales_created ON sales(created_at);
CREATE INDEX returns_created ON returns(created_at);
CREATE INDEX shifts_closed ON shifts(closed_at);
`,
  },
  {
    version: 8,
    name: 'returns keep their sale, customers found by name',
    sql: `
-- A return now stops its sale from being deleted (the app already refuses; now the database does
-- too). Before, deleting a sale silently deleted its returns. SQLite changes a link by rebuilding
-- the table: same columns in the same order, only ON DELETE CASCADE becomes RESTRICT.
CREATE TEMP TABLE returns_seq AS SELECT seq FROM sqlite_sequence WHERE name = 'returns';
CREATE TABLE returns_new (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_line_id INTEGER REFERENCES sale_lines(id) ON DELETE RESTRICT,
  product_id   INTEGER NOT NULL,
  name         TEXT NOT NULL,
  quantity     INTEGER NOT NULL CHECK (quantity > 0),
  refund       INTEGER NOT NULL CHECK (refund >= 0),
  cost         INTEGER NOT NULL CHECK (cost >= 0),
  reason       TEXT,
  created_at   TEXT NOT NULL,
  month        TEXT NOT NULL,
  by TEXT, by_name TEXT, uid TEXT, device TEXT, photo TEXT, conditions TEXT,
  override_reason TEXT, approved_by TEXT,
  exchange_sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL
);
INSERT INTO returns_new SELECT * FROM returns;
DROP TABLE returns;
ALTER TABLE returns_new RENAME TO returns;
-- Ids are never given twice: the counter keeps the highest id ever used, even if the newest
-- returns were deleted.
DELETE FROM sqlite_sequence WHERE name IN ('returns', 'returns_new');
INSERT INTO sqlite_sequence (name, seq)
  SELECT 'returns', max(coalesce((SELECT seq FROM temp.returns_seq), 0),
                        coalesce((SELECT max(id) FROM returns), 0));
DROP TABLE temp.returns_seq;
CREATE INDEX returns_line ON returns(sale_line_id);
CREATE INDEX returns_month ON returns(month);
CREATE UNIQUE INDEX returns_uid ON returns(uid);
CREATE INDEX returns_shift ON returns(shift_id);
CREATE INDEX returns_created ON returns(created_at);
CREATE TRIGGER returns_new_uid AFTER INSERT ON returns WHEN NEW.uid IS NULL BEGIN
  UPDATE returns SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
-- A customer's name as it is compared (lib/names), so a sale finds the customer by name with an
-- index instead of reading every customer. Filled by the app (fillNameKeys).
ALTER TABLE customers ADD COLUMN name_key TEXT;
CREATE INDEX customers_name_key ON customers(name_key);
`,
    after: fillNameKeys,
  },
  {
    version: 9,
    name: 'product specs, customer gender and photo, loyalty points',
    sql: `
-- What a piece is made of, typed freely ("فضة 925 مطلية روديوم، زركون"), up to 300 letters.
ALTER TABLE products ADD COLUMN specs TEXT;
-- The customer's portrait: 'female' or 'male' (none: a neutral one), and an optional real photo.
ALTER TABLE customers ADD COLUMN gender TEXT CHECK (gender IN ('female', 'male'));
ALTER TABLE customers ADD COLUMN image_file TEXT;
-- The specs print under each piece on the receipt, unless the receipt turns them off.
ALTER TABLE receipt_items ADD COLUMN specs TEXT;
ALTER TABLE receipts ADD COLUMN show_specs INTEGER NOT NULL DEFAULT 1 CHECK (show_specs IN (0, 1));
-- Part of a sale paid with loyalty points (F3), in dirhams: not money in the drawer. The receipt
-- keeps its own copy, as it keeps everything it prints.
ALTER TABLE sales ADD COLUMN points_paid INTEGER NOT NULL DEFAULT 0 CHECK (points_paid >= 0);
ALTER TABLE receipts ADD COLUMN points_paid INTEGER NOT NULL DEFAULT 0 CHECK (points_paid >= 0);
-- Every change to a customer's loyalty points (F3): earned on a paid sale, redeemed at checkout,
-- taken back by a return, or adjusted by the owner. The balance is the sum, never stored. A
-- move belongs to its sale, return or payment: deleting that deletes the move with it.
CREATE TABLE loyalty_moves (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  kind        TEXT NOT NULL CHECK (kind IN ('earn', 'redeem', 'reverse', 'adjust')),
  points      INTEGER NOT NULL CHECK (points <> 0),
  sale_id     INTEGER REFERENCES sales(id) ON DELETE CASCADE,
  return_id   INTEGER REFERENCES returns(id) ON DELETE CASCADE,
  -- Points earned on a debt payment (a credit sale earns as it is paid).
  payment_id  INTEGER REFERENCES payments(id) ON DELETE CASCADE,
  -- What redeemed points were worth, in dirhams, at the time.
  value       INTEGER NOT NULL DEFAULT 0,
  note        TEXT,
  created_at  TEXT NOT NULL,
  month       TEXT NOT NULL,
  by          TEXT,
  by_name     TEXT,
  uid         TEXT,
  device      TEXT
);
CREATE INDEX loyalty_customer ON loyalty_moves(customer_id);
CREATE INDEX loyalty_sale ON loyalty_moves(sale_id);
CREATE INDEX loyalty_return ON loyalty_moves(return_id);
CREATE INDEX loyalty_payment ON loyalty_moves(payment_id);
CREATE INDEX loyalty_created ON loyalty_moves(created_at);
CREATE UNIQUE INDEX loyalty_uid ON loyalty_moves(uid);
CREATE TRIGGER loyalty_moves_new_uid AFTER INSERT ON loyalty_moves WHEN NEW.uid IS NULL BEGIN
  UPDATE loyalty_moves SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
`,
  },
  {
    version: 10,
    name: 'customer details, rewards and wanted pieces',
    sql: `
-- Optional details a customer gives (G1): the birthday as day and month only (never the year),
-- how they heard about the shop, their ring size, metal and favourite colours, and whether they
-- accept offer messages. The area and notes columns already exist.
ALTER TABLE customers ADD COLUMN birth_month INTEGER CHECK (birth_month BETWEEN 1 AND 12);
ALTER TABLE customers ADD COLUMN birth_day INTEGER CHECK (birth_day BETWEEN 1 AND 31);
ALTER TABLE customers ADD COLUMN heard TEXT
  CHECK (heard IN ('facebook', 'instagram', 'tiktok', 'friend', 'other'));
ALTER TABLE customers ADD COLUMN ring_size TEXT;
ALTER TABLE customers ADD COLUMN metal TEXT;
ALTER TABLE customers ADD COLUMN colours TEXT;
ALTER TABLE customers ADD COLUMN offers INTEGER NOT NULL DEFAULT 0 CHECK (offers IN (0, 1));
-- The owner's choice: always VIP or never VIP. Empty: worked out from what they spent (G2).
ALTER TABLE customers ADD COLUMN vip TEXT CHECK (vip IN ('always', 'never'));
-- What the visit reward took off this sale (G2), in dirhams: already in the pieces' prices, kept
-- apart so the day summary and the log can show it. The receipt keeps its own copy, and the text
-- printed under its total at the time of the sale (the points balance, purchases left).
ALTER TABLE sales ADD COLUMN reward_off INTEGER NOT NULL DEFAULT 0 CHECK (reward_off >= 0);
ALTER TABLE receipts ADD COLUMN reward_off INTEGER NOT NULL DEFAULT 0 CHECK (reward_off >= 0);
ALTER TABLE receipts ADD COLUMN footer TEXT;
-- A piece a customer asked for (G3), to remind the owner when a matching one comes in.
CREATE TABLE wanted_pieces (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  month       TEXT NOT NULL,
  done_at     TEXT,
  by          TEXT,
  by_name     TEXT,
  uid         TEXT,
  device      TEXT
);
CREATE INDEX wanted_customer ON wanted_pieces(customer_id);
CREATE UNIQUE INDEX wanted_uid ON wanted_pieces(uid);
CREATE TRIGGER wanted_pieces_new_uid AFTER INSERT ON wanted_pieces WHEN NEW.uid IS NULL BEGIN
  UPDATE wanted_pieces SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
-- A customer's sales by date, for the visit count, VIP and the last purchases.
CREATE INDEX sales_customer_created ON sales(customer_id, created_at);
`,
  },
  {
    version: 11,
    name: 'birthday discount',
    sql: `
-- What the birthday discount took off this sale (H1), in dirhams: already in the pieces' prices,
-- kept apart from the visit reward (whose count starts again after a sale with reward_off), so
-- the reward is not used up and the reports show each one. The receipt keeps its own copy.
ALTER TABLE sales ADD COLUMN birthday_off INTEGER NOT NULL DEFAULT 0 CHECK (birthday_off >= 0);
ALTER TABLE receipts ADD COLUMN birthday_off INTEGER NOT NULL DEFAULT 0 CHECK (birthday_off >= 0);
-- When the birthday was last saved or changed. Empty: saved before this version (trusted).
-- A birthday saved less than 30 days before it needs the owner for the discount.
ALTER TABLE customers ADD COLUMN birthday_set_at TEXT;
`,
  },
  {
    version: 12,
    name: 'deposit orders, gifts, referrals, offers and messages',
    sql: `
-- A piece ordered for a customer from a supplier, or a piece in stock held for her (I1), paid in
-- part with a deposit (عربون). The agreed price is fixed when the deposit is taken. An order
-- goes waiting → purchased (the owner: its cost and the expected date) → arrived (it becomes a
-- product, held for her) → delivered (a sale), or cancelled; a hold goes held → delivered or
-- cancelled. Never deleted: it keeps the deposit's history.
CREATE TABLE orders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  kind         TEXT NOT NULL CHECK (kind IN ('order', 'hold')),
  status       TEXT NOT NULL
    CHECK (status IN ('waiting', 'purchased', 'arrived', 'held', 'delivered', 'cancelled')),
  customer_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  -- What she asked for, as typed (an order), or the held piece's name (a hold).
  description  TEXT NOT NULL CHECK (length(trim(description)) > 0),
  brand        TEXT,
  category     TEXT,
  size         TEXT,
  color        TEXT,
  note         TEXT,
  image_file   TEXT,
  -- The held piece (a hold), or the product made when an ordered piece arrives.
  product_id   INTEGER REFERENCES products(id) ON DELETE RESTRICT,
  quantity     INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  -- The agreed price for all of it, in dirhams.
  price        INTEGER NOT NULL CHECK (price > 0),
  -- Entered by the owner at "purchased": in dirhams, and in US cents with the rate when in dollars.
  cost         INTEGER CHECK (cost >= 0),
  cost_usd     INTEGER,
  cost_rate    INTEGER,
  -- The expected arrival date "2026-12-01", typed by the owner.
  eta          TEXT,
  purchased_at TEXT,
  arrived_at   TEXT,
  delivered_at TEXT,
  sale_id      INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  cancelled_at TEXT,
  -- On cancelling: the deposit moved to her balance, refunded the way she paid, or kept by the
  -- shop (income); the amount it was, and the balance payment it became.
  cancel_how   TEXT CHECK (cancel_how IN ('balance', 'refund', 'keep')),
  settled      INTEGER NOT NULL DEFAULT 0 CHECK (settled >= 0),
  payment_id   INTEGER REFERENCES payments(id) ON DELETE SET NULL,
  -- 'owner' or 'approved' when the owner allowed a deposit under the minimum, or the cancel.
  approved_by  TEXT,
  cancel_approved_by TEXT,
  created_at   TEXT NOT NULL,
  month        TEXT NOT NULL,
  updated_at   TEXT,
  by           TEXT,
  by_name      TEXT,
  shift_id     INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
  uid          TEXT,
  device       TEXT
);
CREATE INDEX orders_customer ON orders(customer_id);
CREATE INDEX orders_status ON orders(status);
CREATE INDEX orders_product ON orders(product_id);
CREATE INDEX orders_sale ON orders(sale_id);
CREATE INDEX orders_cancelled ON orders(cancelled_at);
CREATE UNIQUE INDEX orders_uid ON orders(uid);
CREATE TRIGGER orders_new_uid AFTER INSERT ON orders WHEN NEW.uid IS NULL BEGIN
  UPDATE orders SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
-- Money paid towards an order (the deposit and later payments), or refunded on cancelling, by
-- the way it was paid. Each payment has its deposit receipt. Cash counts in the shift's drawer.
CREATE TABLE order_payments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('pay', 'refund')),
  amount      INTEGER NOT NULL CHECK (amount > 0),
  method      TEXT NOT NULL CHECK (method IN ('cash', 'card', 'transfer')),
  receipt_id  INTEGER REFERENCES receipts(id) ON DELETE SET NULL,
  note        TEXT,
  created_at  TEXT NOT NULL,
  month       TEXT NOT NULL,
  by          TEXT,
  by_name     TEXT,
  shift_id    INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
  uid         TEXT,
  device      TEXT
);
CREATE INDEX order_payments_order ON order_payments(order_id);
CREATE INDEX order_payments_shift ON order_payments(shift_id);
CREATE INDEX order_payments_created ON order_payments(created_at);
CREATE UNIQUE INDEX order_payments_uid ON order_payments(uid);
CREATE TRIGGER order_payments_new_uid AFTER INSERT ON order_payments WHEN NEW.uid IS NULL BEGIN
  UPDATE order_payments SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
-- The delivery sale: the deposit already paid (money taken before the sale, not in its drawer
-- money), and the bring-a-friend and we-miss-you discounts (I4), already in the pieces' prices
-- and kept apart like the birthday discount. The receipt keeps its own copies.
ALTER TABLE sales ADD COLUMN deposit_used INTEGER NOT NULL DEFAULT 0 CHECK (deposit_used >= 0);
ALTER TABLE sales ADD COLUMN friend_off INTEGER NOT NULL DEFAULT 0 CHECK (friend_off >= 0);
ALTER TABLE sales ADD COLUMN offer_off INTEGER NOT NULL DEFAULT 0 CHECK (offer_off >= 0);
CREATE INDEX sales_deposit ON sales(deposit_used) WHERE deposit_used > 0;
-- A deposit receipt ('deposit') belongs to its order; 'deposit' is what was paid towards it so
-- far (on a delivery receipt: the deposit used).
ALTER TABLE receipts ADD COLUMN kind TEXT NOT NULL DEFAULT 'sale' CHECK (kind IN ('sale', 'deposit'));
ALTER TABLE receipts ADD COLUMN order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL;
ALTER TABLE receipts ADD COLUMN deposit INTEGER NOT NULL DEFAULT 0 CHECK (deposit >= 0);
ALTER TABLE receipts ADD COLUMN friend_off INTEGER NOT NULL DEFAULT 0 CHECK (friend_off >= 0);
ALTER TABLE receipts ADD COLUMN offer_off INTEGER NOT NULL DEFAULT 0 CHECK (offer_off >= 0);
CREATE INDEX receipts_order ON receipts(order_id);
-- Who sent this customer (bring a friend, I4).
ALTER TABLE customers ADD COLUMN referred_by INTEGER REFERENCES customers(id) ON DELETE SET NULL;
-- Deposits kept by the shop on cancelled orders, in the quarter's closing.
ALTER TABLE closings ADD COLUMN other_income INTEGER NOT NULL DEFAULT 0;
-- A gift bought for someone (I4): for whom, the occasion and its day, to remind next year.
CREATE TABLE gifts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  sale_id     INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  for_whom    TEXT NOT NULL CHECK (length(trim(for_whom)) > 0),
  occasion    TEXT,
  occ_month   INTEGER NOT NULL CHECK (occ_month BETWEEN 1 AND 12),
  occ_day     INTEGER NOT NULL CHECK (occ_day BETWEEN 1 AND 31),
  -- The last year the reminder was handled.
  done_year   INTEGER,
  created_at  TEXT NOT NULL,
  month       TEXT NOT NULL,
  by          TEXT,
  by_name     TEXT,
  uid         TEXT,
  device      TEXT
);
CREATE INDEX gifts_customer ON gifts(customer_id);
CREATE INDEX gifts_date ON gifts(occ_month, occ_day);
CREATE UNIQUE INDEX gifts_uid ON gifts(uid);
CREATE TRIGGER gifts_new_uid AFTER INSERT ON gifts WHEN NEW.uid IS NULL BEGIN
  UPDATE gifts SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
-- Bring a friend (I4): the friend's first purchase, and the points it gave the one who sent her
-- (a loyalty 'adjust' move), taken back when that purchase is fully returned.
CREATE TABLE referrals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  friend_id   INTEGER NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
  referrer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  sale_id     INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  points      INTEGER NOT NULL DEFAULT 0,
  move_id     INTEGER REFERENCES loyalty_moves(id) ON DELETE SET NULL,
  reversed_at TEXT,
  created_at  TEXT NOT NULL,
  by          TEXT,
  by_name     TEXT,
  uid         TEXT,
  device      TEXT
);
CREATE INDEX referrals_referrer ON referrals(referrer_id);
CREATE INDEX referrals_sale ON referrals(sale_id);
CREATE UNIQUE INDEX referrals_uid ON referrals(uid);
CREATE TRIGGER referrals_new_uid AFTER INSERT ON referrals WHEN NEW.uid IS NULL BEGIN
  UPDATE referrals SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
-- A one-time discount the owner gives a customer who hasn't come back (we miss you, I4).
CREATE TABLE offers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  percent     INTEGER NOT NULL CHECK (percent BETWEEN 1 AND 100),
  cap         INTEGER NOT NULL DEFAULT 0 CHECK (cap >= 0),
  expires_at  TEXT NOT NULL,
  sale_id     INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  used_at     TEXT,
  created_at  TEXT NOT NULL,
  month       TEXT NOT NULL,
  by          TEXT,
  by_name     TEXT,
  uid         TEXT,
  device      TEXT
);
CREATE INDEX offers_customer ON offers(customer_id);
CREATE INDEX offers_sale ON offers(sale_id);
CREATE UNIQUE INDEX offers_uid ON offers(uid);
CREATE TRIGGER offers_new_uid AFTER INSERT ON offers WHEN NEW.uid IS NULL BEGIN
  UPDATE offers SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
-- Each WhatsApp message the app opened for a customer (the person sends it), so it is not
-- offered twice: its kind and what it was about.
CREATE TABLE message_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  ref         TEXT,
  created_at  TEXT NOT NULL,
  by          TEXT,
  by_name     TEXT,
  uid         TEXT,
  device      TEXT
);
CREATE INDEX message_log_customer ON message_log(customer_id, kind);
CREATE INDEX message_log_kind ON message_log(kind, ref);
CREATE UNIQUE INDEX message_log_uid ON message_log(uid);
CREATE TRIGGER message_log_new_uid AFTER INSERT ON message_log WHEN NEW.uid IS NULL BEGIN
  UPDATE message_log SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
`,
  },
  {
    version: 13,
    name: 'an index under every link',
    sql: `
-- Deleting a row makes SQLite look for the rows that point at it; without an index under the
-- link it reads the whole table each time (J1, from the full check: restoring a backup with
-- 10,000 customers took 10 s, each customer deleted reading every customer for referred_by).
-- Indexes only: no row changes.
CREATE INDEX customers_referred_by ON customers(referred_by);
CREATE INDEX set_items_product ON set_items(product_id);
CREATE INDEX staff_ledger_shift ON staff_ledger(shift_id);
CREATE INDEX stock_count_lines_product ON stock_count_lines(product_id);
CREATE INDEX returns_exchange_sale ON returns(exchange_sale_id);
CREATE INDEX orders_shift ON orders(shift_id);
CREATE INDEX orders_payment ON orders(payment_id);
CREATE INDEX order_payments_receipt ON order_payments(receipt_id);
CREATE INDEX gifts_sale ON gifts(sale_id);
CREATE INDEX referrals_move ON referrals(move_id);
`,
  },
  {
    version: 14,
    name: 'how a refund was paid back',
    sql: `
-- How the money of a return went back (J2): cash (out of the drawer), card, transfer, to her
-- balance (له رصيد), or off her debt (a sale on credit). Until now the app took every refund of
-- a credit sale off the debt and every other one out of the drawer: the upgrade says so, so no
-- past figure changes.
ALTER TABLE returns ADD COLUMN refund_method TEXT NOT NULL DEFAULT 'cash'
  CHECK (refund_method IN ('cash', 'card', 'transfer', 'balance', 'debt'));
UPDATE returns SET refund_method = 'debt'
 WHERE sale_line_id IN (SELECT l.id FROM sale_lines l JOIN sales s ON s.id = l.sale_id
                         WHERE s.payment_method = 'credit');
`,
  },
  {
    version: 15,
    name: 'repairs',
    sql: `
-- Repairs (J3, صيانة): a customer's piece taken in for work, its photos (a JSON list of file
-- names), the work, the agreed price (0: free), the date it will be ready, and its stages
-- استُلمت → في الورشة → جاهزة → سُلّمت, or ملغاة. The ticket number R-2026-0001 never repeats
-- (it is the record's number). The workshop's cost is the owner's. No stock moves.
CREATE TABLE repairs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_no    TEXT NOT NULL UNIQUE,
  status       TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'workshop', 'ready', 'delivered', 'cancelled')),
  customer_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  description  TEXT NOT NULL CHECK (length(trim(description)) > 0),
  work         TEXT NOT NULL
    CHECK (work IN ('resize', 'solder', 'polish', 'clasp', 'stone', 'other')),
  photos       TEXT NOT NULL DEFAULT '[]',
  note         TEXT,
  price        INTEGER NOT NULL CHECK (price >= 0),
  ready_by     TEXT NOT NULL,
  cost         INTEGER CHECK (cost >= 0),
  workshop_at  TEXT,
  ready_at     TEXT,
  delivered_at TEXT,
  cancelled_at TEXT,
  -- On cancelling: the deposit back the way she paid, or to her balance (a payment 'repair').
  cancel_how   TEXT CHECK (cancel_how IN ('balance', 'refund')),
  settled      INTEGER NOT NULL DEFAULT 0 CHECK (settled >= 0),
  payment_id   INTEGER REFERENCES payments(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL,
  month        TEXT NOT NULL,
  updated_at   TEXT,
  by           TEXT,
  by_name      TEXT,
  shift_id     INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
  uid          TEXT,
  device       TEXT
);
CREATE INDEX repairs_customer ON repairs(customer_id);
CREATE INDEX repairs_status ON repairs(status);
CREATE INDEX repairs_delivered ON repairs(delivered_at);
CREATE INDEX repairs_shift ON repairs(shift_id);
CREATE INDEX repairs_payment ON repairs(payment_id);
CREATE UNIQUE INDEX repairs_uid ON repairs(uid);
CREATE TRIGGER repairs_new_uid AFTER INSERT ON repairs WHEN NEW.uid IS NULL BEGIN
  UPDATE repairs SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
-- Money paid towards a repair (a deposit, the rest at delivery) or refunded on cancelling, by the
-- way it was paid; 'credit': the rest put on her account at delivery. Cash counts in the drawer.
CREATE TABLE repair_payments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  repair_id   INTEGER NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('pay', 'refund')),
  amount      INTEGER NOT NULL CHECK (amount > 0),
  method      TEXT NOT NULL CHECK (method IN ('cash', 'card', 'transfer', 'credit')),
  note        TEXT,
  created_at  TEXT NOT NULL,
  month       TEXT NOT NULL,
  by          TEXT,
  by_name     TEXT,
  shift_id    INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
  uid         TEXT,
  device      TEXT
);
CREATE INDEX repair_payments_repair ON repair_payments(repair_id);
CREATE INDEX repair_payments_shift ON repair_payments(shift_id);
CREATE INDEX repair_payments_created ON repair_payments(created_at);
CREATE UNIQUE INDEX repair_payments_uid ON repair_payments(uid);
CREATE TRIGGER repair_payments_new_uid AFTER INSERT ON repair_payments WHEN NEW.uid IS NULL BEGIN
  UPDATE repair_payments SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
-- The quarterly closing keeps the repairs' income and the workshop's cost apart from sales.
ALTER TABLE closings ADD COLUMN repair_income INTEGER NOT NULL DEFAULT 0;
ALTER TABLE closings ADD COLUMN repair_cost INTEGER NOT NULL DEFAULT 0;
`,
  },
  {
    version: 16,
    name: 'repair services and original invoices',
    sql: `
-- The owner's repair services (rule D): a name and a fixed price, or no price («السعر يحدده
-- المالك», set by the owner on each repair). Staff tick them; they do not type a price. A service
-- taken off the list is kept (active 0) for the repairs that used it.
CREATE TABLE repair_services (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL CHECK (length(trim(name)) > 0),
  price      INTEGER CHECK (price >= 0),
  active     INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT
);
CREATE UNIQUE INDEX repair_services_name ON repair_services(lower(trim(name))) WHERE active = 1;
-- The services ticked on a repair, with the name and price as they were then; price NULL: the
-- owner has not set it yet (the repair cannot be delivered until then).
CREATE TABLE repair_lines (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  repair_id  INTEGER NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
  service_id INTEGER REFERENCES repair_services(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  price      INTEGER CHECK (price >= 0),
  priced_at  TEXT,
  priced_by  TEXT
);
CREATE INDEX repair_lines_repair ON repair_lines(repair_id);
CREATE INDEX repair_lines_service ON repair_lines(service_id);
CREATE INDEX repair_lines_unpriced ON repair_lines(repair_id) WHERE price IS NULL;
-- The original invoices (jewelry): the gift receipt the owner adds (a photo or a PDF in the
-- private folder), linked to one or more products. Staff open it with the invoice code.
CREATE TABLE original_invoices (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  file       TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('image', 'pdf')),
  title      TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  by         TEXT,
  by_name    TEXT,
  uid        TEXT,
  device     TEXT
);
CREATE UNIQUE INDEX original_invoices_uid ON original_invoices(uid);
CREATE TRIGGER original_invoices_new_uid AFTER INSERT ON original_invoices WHEN NEW.uid IS NULL BEGIN
  UPDATE original_invoices SET uid = lower(hex(randomblob(16))),
    device = (SELECT value FROM settings WHERE key = 'device_id')
  WHERE rowid = NEW.rowid;
END;
CREATE TABLE original_invoice_products (
  invoice_id INTEGER NOT NULL REFERENCES original_invoices(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (invoice_id, product_id)
);
CREATE INDEX original_invoice_products_product ON original_invoice_products(product_id);
`,
  },
];

export const LATEST_VERSION = migrations[migrations.length - 1].version;
