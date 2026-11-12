import { fireEvent, screen } from '@testing-library/react-native';
import { ActionSheetIOS } from 'react-native';

import { issueReceipt } from '@/domain/receipts';
import { makeCtx, type TestCtx } from '@/domain/testing/ctx';
import { renderScreen } from '@/testing/render';

import { ReceiptsList, type ReceiptActions } from './receipts-list';

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));

let ctx: TestCtx;
beforeEach(() => {
  ctx = makeCtx('jewelry', new Date(2026, 10, 9, 10));
});
afterEach(() => ctx.close());

const actions = (): ReceiptActions => ({
  onOpen: jest.fn(),
  onPrint: jest.fn(),
  onShare: jest.fn(),
  onDelete: jest.fn(),
});

describe('the receipts list', () => {
  it('opens a receipt on tap; a long press prints, shares or deletes it', async () => {
    const r = issueReceipt(ctx, {
      customer: 'ليلى',
      items: [{ name: 'خاتم', brand: null, code: 'R1', quantity: 1, price: 300_000 }],
    });
    const a = actions();
    await renderScreen(
      <ReceiptsList receipts={[r]} total={1} filtered={false} actions={a} onNew={jest.fn()} />,
    );
    await fireEvent.press(screen.getByTestId(`receipt-${r.receiptNo}`));
    expect(a.onOpen).toHaveBeenCalledWith(r);

    const sheet = jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation((options, pick) => pick((options.options as string[]).indexOf('طباعة')));
    await fireEvent(screen.getByTestId(`receipt-${r.receiptNo}`), 'longPress');
    expect(a.onPrint).toHaveBeenCalledWith(r);
    sheet.mockRestore();
  });

  it('says why it is empty: nothing yet (with a button), or nothing matching the search', async () => {
    const onNew = jest.fn();
    const first = await renderScreen(
      <ReceiptsList receipts={[]} filtered={false} actions={actions()} onNew={onNew} />,
    );
    expect(screen.getByText('لا توجد إيصالات بعد')).toBeOnTheScreen();
    await first.unmount();
    await renderScreen(<ReceiptsList receipts={[]} filtered actions={actions()} onNew={onNew} />);
    expect(screen.getByText('لا توجد نتائج')).toBeOnTheScreen();
  });
});
