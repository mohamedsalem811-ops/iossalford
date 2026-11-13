/* eslint-disable @typescript-eslint/no-require-imports -- fresh copies of the module for each "run" */
import type { CartLine } from '@/domain/cart';

// One disk for every "run" of the app (each run loads the module afresh).
const mockFs = require('@/testing/memory-fs').memoryFs();
jest.mock('expo-file-system', () => mockFs);
jest.mock('expo', () => ({ isRunningInExpoGo: () => false }));

type CartModule = typeof import('./cart') & { setActor: typeof import('./session').setActor };
const freshRun = (): CartModule => {
  let m!: CartModule;
  jest.isolateModules(() => {
    m = { ...require('./cart'), setActor: require('./session').setActor };
  });
  return m;
};

const line: CartLine = { key: 'a', productId: 7, name: 'خاتم', quantity: 2, unitPrice: 350_000 };

describe('the open cart', () => {
  it('survives the app being closed by iOS, per system, until it is emptied', () => {
    const first = freshRun();
    first.putCart('jewelry', [line]);
    expect(first.getCart('scarves')).toEqual([]);

    // iOS closed the app in the background; it opens again.
    const second = freshRun();
    expect(second.getCart('jewelry')).toEqual([line]);
    expect(second.getCart('scarves')).toEqual([]);

    // After the sale the cart is emptied, and stays empty next time.
    second.putCart('jewelry', []);
    expect(freshRun().getCart('jewelry')).toEqual([]);
  });

  it('starts empty when the saved cart is unreadable', () => {
    const { File, Directory, Paths } = mockFs;
    const root = new Directory(
      Paths.document.parentDirectory,
      'Library',
      'Application Support',
      'SALFORD',
    );
    new File(root, 'cart-scarves.json').writeSync('not json');
    expect(freshRun().getCart('scarves')).toEqual([]);
  });

  it("keeps a cart per person: an employee never sees the owner's, and gets theirs back", () => {
    const run = freshRun();
    run.putCart('jewelry', [line]);
    run.setActor({ kind: 'employee', id: 'a', name: 'سارة' });
    expect(run.getCart('jewelry')).toEqual([]);
    const hers = { ...line, key: 'b', quantity: 1 };
    run.putCart('jewelry', [hers]);
    run.setActor({ kind: 'owner' });
    expect(run.getCart('jewelry')).toEqual([line]);
    const next = freshRun();
    next.setActor({ kind: 'employee', id: 'a', name: 'سارة' });
    expect(next.getCart('jewelry')).toEqual([hers]);
    next.putCart('jewelry', []);
    next.setActor({ kind: 'owner' });
    next.putCart('jewelry', []);
  });
});
