import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { listActivity } from '@/domain/activity';
import { addOriginalInvoice } from '@/domain/original-invoices';
import { saveProduct } from '@/domain/products';
import { EMPLOYEE, makeCtx, type TestCtx } from '@/domain/testing/ctx';
import * as device from '@/security/device';
import { OWNER } from '@/staff/model';
import { setActor } from '@/state/session';
import { renderScreen } from '@/testing/render';

import { PieceInvoices } from './piece-invoices';

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('react-native-webview', () => ({ WebView: () => null }));
jest.mock('expo-print', () => ({ printAsync: jest.fn() }));
jest.mock('@/lib/storage', () => ({
  photoFile: (_s: string, name: string) => ({ exists: true, uri: `file:///private/${name}` }),
  photoFolder: () => ({}),
}));

let ctx: TestCtx;
let ring: number;
let invoice: number;
beforeEach(() => {
  ctx = makeCtx('jewelry');
  ctx.setActor(OWNER);
  ring = saveProduct(ctx, { name: 'خاتم سواروفسكي', category: 'خواتم', price: 300_000, stock: 1 });
  invoice = addOriginalInvoice(ctx, {
    file: 'invoice-abc123def456.jpg',
    kind: 'image',
    title: 'سواروفسكي نيويورك',
    productIds: [ring],
  });
});
afterEach(() => {
  ctx.close();
  jest.restoreAllMocks();
});

it('opens for an employee with the invoice code, shows it to print, and logs the opening', async () => {
  ctx.setActor(EMPLOYEE);
  setActor(EMPLOYEE);
  // The code checks in the real approvals: the vault says the code is set and right.
  jest.spyOn(device.pinVault, 'hasPin').mockResolvedValue(true);
  const verify = jest.spyOn(device.pinVault, 'verify').mockResolvedValue({ ok: true });
  jest.spyOn(Alert, 'prompt').mockImplementation((_t, _m, buttons) => {
    if (Array.isArray(buttons)) buttons.find((b) => b.text === 'موافقة')?.onPress?.('7302');
  });
  const { takeApproval } = jest.requireActual('@/staff/approvals');
  ctx.approvals = { take: takeApproval };
  await renderScreen(<PieceInvoices ctx={ctx} productId={ring} />);
  expect(screen.queryByTestId('invoice-add')).toBeNull();
  await fireEvent.press(screen.getByTestId(`invoice-${invoice}`));
  await waitFor(() => expect(verify).toHaveBeenCalledWith('code.invoice', '7302'));
  expect(await screen.findByTestId('invoice-image')).toBeOnTheScreen();
  expect(screen.getByTestId('invoice-print')).toBeOnTheScreen();
  // Show and print only: nothing on the screen shares or saves it.
  expect(screen.queryByText(/مشاركة|حفظ/)).toBeNull();
  ctx.setActor(OWNER);
  expect(listActivity(ctx, {}).map((a) => a.action)).toEqual(
    expect.arrayContaining(['invoice.open', 'code.invoice']),
  );
});

it('shows the owner how to add or link an invoice', async () => {
  setActor(OWNER);
  await renderScreen(<PieceInvoices ctx={ctx} productId={ring} />);
  expect(screen.getByTestId('invoice-add')).toBeOnTheScreen();
  expect(screen.getByTestId('invoice-link')).toBeOnTheScreen();
});
