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
];

export const LATEST_VERSION = migrations[migrations.length - 1].version;
