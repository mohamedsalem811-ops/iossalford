/**
 * Database schema, one file per system (jewelry.db, scarves.db), changed only by adding a new
 * migration at the end of the list. Never edit a migration that has shipped.
 *
 * Money: LYD in whole dirhams (1 LYD = 1000), USD in cents, exchange rates in thousandths of a
 * dinar per dollar. Ids use AUTOINCREMENT, so SQLite never reuses an id after a delete (old
 * sales, returns and payments can never point at a new record). Dates are ISO 8601 text in local
 * time; `month` columns are "YYYY-MM" keys.
 */

export type Migration = { version: number; name: string; sql: string };

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
];

export const LATEST_VERSION = migrations[migrations.length - 1].version;
