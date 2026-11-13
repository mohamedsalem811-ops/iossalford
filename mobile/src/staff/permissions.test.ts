/**
 * The permission matrix (phase S2): every action that changes data, done by the owner, by an
 * employee and by nobody signed in. A refused action throws before writing anything, so the
 * whole database is compared before and after. A second test reads the source and fails when a
 * new action that changes data has no check, or is missing from this matrix.
 */
import { checkout } from '@/domain/checkout';
import { closeQuarter, deleteClosing } from '@/domain/closing';
import { PermissionError, type Ctx } from '@/domain/context';
import { saveCustomer } from '@/domain/customers';
import { deleteCustomer, deletePayment, recordPayment } from '@/domain/debts';
import { addExpense, deleteExpense } from '@/domain/expenses';
import { addBrand, deleteBrand, renameBrand, setBrandImage } from '@/domain/brands';
import { exportBackup, restoreBackup } from '@/domain/backup';
import {
  adjustStock,
  deleteProduct,
  getProduct,
  restoreProduct,
  saveProduct,
} from '@/domain/products';
import { deleteReceipt, issueReceipt, updateReceipt } from '@/domain/receipts';
import { exchange } from '@/domain/exchange';
import { setPolicies } from '@/domain/policies';
import { chargeReturn, recordRepayment, waiveCharge } from '@/domain/staff-ledger';
import { addReturn, addReturnWithoutSale, deleteReturn, deleteSale, getSale } from '@/domain/sales';
import { deleteScarfDesign, saveScarfDesign } from '@/domain/scarves';
import { deleteSet, saveSet } from '@/domain/sets';
import { setRate } from '@/domain/settings';
import { addToCart, type CartLine } from '@/domain/cart';
import { EMPLOYEE, makeCtx, passing, type TestCtx } from '@/domain/testing/ctx';
import { OWNER } from './model';
import { ALL_PERMISSIONS, can, EMPLOYEE_MAY, PERMISSIONS, type Permission } from './permissions';
import { scanActions } from './testing/scan-actions';
import { screenFilesCalling } from './testing/screen-calls';

/** What the owner made before each action: one of everything an action can work on. */
type Seed = {
  charged: number;
  ring: number;
  chain: number;
  customer: number;
  sale: number;
  saleLine: number;
  receipt: number;
  /** A receipt the employee issued (an employee edits only their own). */
  herReceipt: number;
  payment: number;
  ret: number;
  expense: number;
  closing: number;
  set: number;
  brand: number;
  archived: number;
};

function cartOf(ctx: Ctx, id: number, qty = 1): CartLine[] {
  const p = getProduct(ctx, id)!;
  const r = addToCart([], p, p.name, qty);
  if ('problem' in r) throw new Error('cart');
  return r.cart;
}

function seed(ctx: TestCtx): Seed {
  ctx.setActor(OWNER);
  const ring = saveProduct(ctx, {
    name: 'خاتم',
    brand: 'لازوردي',
    category: 'خواتم',
    price: 100_000,
    cost: 40_000,
    stock: 10,
  });
  const chain = saveProduct(ctx, { name: 'سلسلة', category: 'سلاسل', price: 50_000, stock: 5 });
  const archived = saveProduct(ctx, { name: 'قديم', category: 'خواتم', price: 1_000, stock: 1 });
  const customer = saveCustomer(ctx, { name: 'منى', phone: '0912345678' });
  const sold = checkout(ctx, {
    cart: cartOf(ctx, ring, 2),
    paymentMethod: 'credit',
    customer: { name: 'منى', phone: '0912345678' },
  });
  // A second sale, so one archived piece has a sale and is kept when deleted.
  checkout(ctx, { cart: cartOf(ctx, archived), paymentMethod: 'cash' });
  deleteProduct(ctx, archived);
  const saleLine = getSale(ctx, sold.saleId)!.lines[0].id;
  const ret = addReturn(ctx, { ...passing(ctx), saleLineId: saleLine, quantity: 1 });
  // A second return, already on an employee's account (for waiving).
  const other = checkout(ctx, { cart: cartOf(ctx, chain), paymentMethod: 'cash' });
  const charged = addReturn(ctx, {
    ...passing(ctx),
    saleLineId: getSale(ctx, other.saleId)!.lines[0].id,
    quantity: 1,
  });
  chargeReturn(ctx, charged, { key: 'emp-e1', name: 'سارة' });
  const payment = recordPayment(ctx, { customerId: customer, amount: 10_000, method: 'cash' });
  const expense = addExpense(ctx, { description: 'إيجار', amount: 5_000 });
  const closing = closeQuarter(ctx, { year: 2026, quarter: 3 }).id;
  const set = saveSet(ctx, {
    name: 'طقم',
    discount: 1_000,
    items: [
      { productId: ring, quantity: 1 },
      { productId: chain, quantity: 1 },
    ],
  });
  const brand = addBrand(ctx, 'تيفاني');
  ctx.setActor(EMPLOYEE);
  const herReceipt = issueReceipt(ctx, { items: [{ name: 'قطعة', quantity: 1, price: 5 }] }).id;
  ctx.setActor(OWNER);
  return {
    charged,
    herReceipt,
    ring,
    chain,
    customer,
    sale: sold.saleId,
    saleLine,
    receipt: sold.receipt.id,
    payment,
    ret,
    expense,
    closing,
    set,
    brand,
    archived,
  };
}

/** Every action that changes data, by its function name, with the permission it needs. */
const MATRIX: Record<string, { permission: Permission; run: (ctx: TestCtx, s: Seed) => unknown }> =
  {
    checkout: {
      permission: 'sales.create',
      run: (ctx, s) => checkout(ctx, { cart: cartOf(ctx, s.chain), paymentMethod: 'cash' }),
    },
    deleteSale: { permission: 'sales.delete', run: (ctx, s) => deleteSale(ctx, s.sale) },
    addReturn: {
      permission: 'returns.create',
      run: (ctx, s) => addReturn(ctx, { ...passing(ctx), saleLineId: s.saleLine, quantity: 1 }),
    },
    addReturnWithoutSale: {
      permission: 'returns.noSale',
      run: (ctx, s) =>
        addReturnWithoutSale(ctx, { ...passing(ctx), productId: s.chain, quantity: 1, refund: 0 }),
    },
    deleteReturn: { permission: 'returns.delete', run: (ctx, s) => deleteReturn(ctx, s.ret) },
    issueReceipt: {
      permission: 'receipts.create',
      run: (ctx) => issueReceipt(ctx, { items: [{ name: 'قطعة', quantity: 1, price: 10 }] }),
    },
    updateReceipt: {
      permission: 'receipts.edit',
      run: (ctx, s) =>
        updateReceipt(ctx, s.herReceipt, {
          items: [{ name: 'قطعة', quantity: 1, price: 10 }],
          showPrices: false,
        }),
    },
    deleteReceipt: {
      permission: 'receipts.delete',
      run: (ctx, s) => deleteReceipt(ctx, s.receipt),
    },
    saveCustomer: {
      permission: 'customers.edit',
      run: (ctx) => saveCustomer(ctx, { name: 'هدى', phone: '0921111111' }),
    },
    deleteCustomer: {
      permission: 'customers.delete',
      // A customer with no sales and no payments can be deleted.
      run: (ctx) => {
        ctx.setActor(OWNER);
        const id = saveCustomer(ctx, { name: 'بلا مشتريات' });
        return id;
      },
    },
    recordPayment: {
      permission: 'payments.create',
      run: (ctx, s) =>
        recordPayment(ctx, { customerId: s.customer, amount: 1_000, method: 'cash' }),
    },
    deletePayment: {
      permission: 'payments.delete',
      run: (ctx, s) => deletePayment(ctx, s.payment),
    },
    saveProduct: {
      permission: 'products.edit',
      run: (ctx) => saveProduct(ctx, { name: 'جديد', category: 'خواتم', price: 1, stock: 1 }),
    },
    adjustStock: {
      permission: 'stock.adjust',
      run: (ctx, s) => adjustStock(ctx, s.chain, 2, 'وصول'),
    },
    deleteProduct: { permission: 'products.edit', run: (ctx, s) => deleteProduct(ctx, s.chain) },
    restoreProduct: {
      permission: 'products.edit',
      run: (ctx, s) => restoreProduct(ctx, s.archived),
    },
    addBrand: { permission: 'products.edit', run: (ctx) => addBrand(ctx, 'كارتييه') },
    renameBrand: {
      permission: 'products.edit',
      run: (ctx, s) => renameBrand(ctx, s.brand, 'تيفاني آند كو'),
    },
    deleteBrand: { permission: 'products.edit', run: (ctx, s) => deleteBrand(ctx, s.brand) },
    setBrandImage: {
      permission: 'products.edit',
      run: (ctx, s) => setBrandImage(ctx, s.brand, 'brand.jpg'),
    },
    saveScarfDesign: {
      permission: 'products.edit',
      run: (ctx) =>
        saveScarfDesign(ctx, {
          name: 'وردة',
          category: 'شيفون',
          sizes: [{ size: 'S', price: 1_000, cost: 0, stock: 1 }],
        }),
    },
    deleteScarfDesign: {
      permission: 'products.edit',
      run: (ctx) => deleteScarfDesign(ctx, 'none'),
    },
    saveSet: {
      permission: 'sets.edit',
      run: (ctx, s) =>
        saveSet(ctx, { name: 'طقم 2', discount: 0, items: [{ productId: s.chain, quantity: 1 }] }),
    },
    deleteSet: { permission: 'sets.edit', run: (ctx, s) => deleteSet(ctx, s.set) },
    addExpense: {
      permission: 'expenses.edit',
      run: (ctx) => addExpense(ctx, { description: 'كهرباء', amount: 1_000 }),
    },
    deleteExpense: { permission: 'expenses.edit', run: (ctx, s) => deleteExpense(ctx, s.expense) },
    closeQuarter: {
      permission: 'closing.edit',
      run: (ctx) => closeQuarter(ctx, { year: 2026, quarter: 4 }),
    },
    deleteClosing: { permission: 'closing.edit', run: (ctx, s) => deleteClosing(ctx, s.closing) },
    setRate: { permission: 'settings.edit', run: (ctx) => setRate(ctx, 7_000) },
    setPolicies: {
      permission: 'settings.edit',
      run: (ctx) => setPolicies(ctx, { returnHours: 48 }),
    },
    exchange: {
      permission: 'sales.create',
      run: (ctx, s) =>
        exchange(ctx, {
          ret: { ...passing(ctx), saleLineId: s.saleLine, quantity: 1 },
          sale: { cart: cartOf(ctx, s.chain), paymentMethod: 'cash' },
        }),
    },
    chargeReturn: {
      permission: 'returns.charge',
      run: (ctx, s) => chargeReturn(ctx, s.ret, { key: 'emp-e1', name: 'سارة' }),
    },
    waiveCharge: {
      permission: 'returns.charge',
      run: (ctx, s) => waiveCharge(ctx, s.charged),
    },
    recordRepayment: {
      permission: 'staff.ledger',
      run: (ctx) => recordRepayment(ctx, { key: 'emp-e1', name: 'سارة' }, 5_000),
    },
    restoreBackup: {
      permission: 'backup.restore',
      run: (ctx) => {
        const actor = ctx.actor;
        ctx.setActor(OWNER);
        const copy = exportBackup(ctx);
        ctx.setActor(actor);
        return restoreBackup(ctx, copy);
      },
    },
  };

/** Actions outside the business rules (files on the device), checked in backup/store.test.ts. */
const FILE_ACTIONS = ['restore', 'shareCopy', 'deleteBackup'];

/** Every row of every table: what a refused action must leave exactly as it was. */
function dump(ctx: Ctx): string {
  const tables = ctx.db
    .all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .map((t) => t.name);
  return JSON.stringify(tables.map((t) => [t, ctx.db.all(`SELECT * FROM "${t}" ORDER BY rowid`)]));
}

describe('the role table', () => {
  it('gives the owner everything, an employee only what the table says, and nobody nothing', () => {
    for (const p of ALL_PERMISSIONS) {
      expect(can(OWNER, p)).toBe(true);
      expect(can(EMPLOYEE, p)).toBe(EMPLOYEE_MAY[p]);
      expect(can(null, p)).toBe(false);
    }
    // An unknown permission (a typo that slipped past TypeScript) is refused for everyone.
    expect(can(OWNER, 'sales.anything' as Permission)).toBe(false);
  });

  it('keeps cost, profit, reports and other people’s sales from employees', () => {
    for (const p of ['costs.view', 'reports.view', 'sales.viewAll', 'staff.manage'] as const)
      expect(EMPLOYEE_MAY[p]).toBe(false);
    // Separation of duties: the person who sells can't change stock or delete a sale.
    expect(EMPLOYEE_MAY['stock.adjust']).toBe(false);
    expect(EMPLOYEE_MAY['sales.delete']).toBe(false);
  });
});

describe.each(Object.entries(MATRIX))('%s', (name, { permission, run }) => {
  let ctx: TestCtx;
  let s: Seed;
  beforeEach(() => {
    ctx = makeCtx('jewelry');
    s = seed(ctx);
  });
  afterEach(() => ctx.close());

  const attempt = (who: 'owner' | 'employee' | 'nobody') => {
    if (name === 'deleteCustomer') {
      const id = run(ctx, s) as number;
      ctx.setActor(who === 'owner' ? OWNER : who === 'employee' ? EMPLOYEE : null);
      return () => deleteCustomer(ctx, id);
    }
    ctx.setActor(who === 'owner' ? OWNER : who === 'employee' ? EMPLOYEE : null);
    return () => run(ctx, s);
  };

  it(`the owner may (${permission})`, () => {
    expect(attempt('owner')).not.toThrow();
  });

  it(`an employee ${EMPLOYEE_MAY[permission] ? 'may' : 'is refused, and nothing is written'}`, () => {
    const act = attempt('employee');
    if (EMPLOYEE_MAY[permission]) {
      expect(act).not.toThrow();
    } else {
      const before = dump(ctx);
      expect(act).toThrow(PermissionError);
      expect(act).toThrow(`${PERMISSIONS[permission]}: للمالك فقط.`);
      expect(dump(ctx)).toBe(before);
    }
  });

  it('nobody signed in is refused, and nothing is written', () => {
    const act = attempt('nobody');
    const before = dump(ctx);
    expect(act).toThrow(PermissionError);
    expect(dump(ctx)).toBe(before);
  });
});

/** Log events that name their person, called from the sign-in and alert screens. */
const EVENTS = [
  'recordSignIn',
  'recordWrongPin',
  'recordEmergency',
  'recordStaff',
  'recordClockBack',
  'recordClockAccepted',
  'recordLogBroken',
];

describe('every action has a check', () => {
  const scanned = scanActions();
  /**
   * Steps that write without a check of their own. Each is called only from inside an action
   * that has one (checkout, returns, restore…), never from a screen: see the import test below.
   */
  const INTERNAL_STEPS = [
    'moveStock',
    'ensureCustomer',
    'ensureBrand',
    'takeReceiptNo',
    'setSetting',
    'keepUsedNumbers',
    // Files and the copy made for a backup, called by the checked backup actions and the
    // automatic backup (which runs whoever is signed in).
    'copyDatabase',
    'labelSnapshot',
    'writeSnapshot',
    'addPhotos',
    'restoreSnapshot',
    'saveBackup',
    'saveUpgradeCopy',
    // The log itself: called inside every checked action (see below), or for events that name
    // their person (a sign-in, a wrong PIN) from the sign-in screens.
    'logAs',
    'logAction',
    ...EVENTS,
  ];

  it('writes a log line in every checked action', () => {
    const silent = scanned
      .filter((f) => f.exported && f.allowed && !f.calls.has('logAction'))
      .map((f) => `${f.file}: ${f.name}`);
    expect(silent).toEqual([]);
  });

  it('refuses an exported action that changes data without a permission check', () => {
    const missing = scanned
      .filter((f) => f.exported && f.uncheckedWriter && !INTERNAL_STEPS.includes(f.name))
      .map((f) => `${f.file}: ${f.name}`);
    expect(missing).toEqual([]);
  });

  it('has every checked action in the matrix, with the same permission', () => {
    const checked = scanned.filter((f) => f.exported && f.allowed);
    const fromSource = Object.fromEntries(checked.map((f) => [f.name, f.allowed]));
    const fromMatrix = Object.fromEntries(
      Object.entries(MATRIX).map(([n, m]) => [n, m.permission as string]),
    );
    for (const n of FILE_ACTIONS) delete fromSource[n];
    expect(fromSource).toEqual(fromMatrix);
    expect(checked.map((f) => f.name)).toEqual(expect.arrayContaining(FILE_ACTIONS));
  });

  it('uses only permissions that exist', () => {
    for (const f of scanned.filter((x) => x.allowed))
      expect(ALL_PERMISSIONS).toContain(f.allowed as Permission);
  });

  it('never calls an unchecked step from a screen', () => {
    const bad = screenFilesCalling(
      INTERNAL_STEPS.filter((n) => !['saveBackup', 'saveUpgradeCopy', ...EVENTS].includes(n)),
    );
    expect(bad).toEqual([]);
  });
});
