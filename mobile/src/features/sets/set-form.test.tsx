import { fireEvent, screen } from '@testing-library/react-native';

import { saveProduct } from '@/domain/products';
import { listSets } from '@/domain/sets';
import { makeCtx, type TestCtx } from '@/domain/testing/ctx';
import { renderScreen } from '@/testing/render';

import { SetFormView } from './set-form';

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('expo-image', () => ({ Image: () => null }));
// The native header: its title and buttons drawn as plain text and buttons.
jest.mock('expo-router', () => {
  /* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories cannot use imports */
  const { Pressable, Text, View } = require('react-native');
  const Toolbar = ({ children }: { children: unknown }) => <View>{children as never}</View>;
  Toolbar.Button = function ToolbarButton({
    children,
    onPress,
  }: {
    children: string;
    onPress: () => void;
  }) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress}>
        <Text>{children}</Text>
      </Pressable>
    );
  };
  /* eslint-enable @typescript-eslint/no-require-imports */
  return {
    Stack: { Title: ({ children }: { children: string }) => <Text>{children}</Text>, Toolbar },
  };
});

let ctx: TestCtx;
beforeEach(() => {
  ctx = makeCtx('jewelry', new Date(2026, 10, 9, 10));
  saveProduct(ctx, { name: 'خاتم', category: 'خواتم', price: 300_000, cost: 100_000, stock: 3 });
  saveProduct(ctx, { name: 'قلادة', category: 'قلادات', price: 500_000, cost: 200_000, stock: 2 });
});
afterEach(() => ctx.close());

describe('the set form', () => {
  it('builds a set from the stock with a discount, shows its price and saves it once', async () => {
    const onDone = jest.fn();
    await renderScreen(<SetFormView ctx={ctx} onDone={onDone} />);
    await fireEvent.changeText(screen.getByTestId('set-name'), 'طقم العروس');
    await fireEvent.press(screen.getByTestId('set-pick-خاتم'));
    await fireEvent.press(screen.getByTestId('set-pick-قلادة'));
    await fireEvent.changeText(screen.getByTestId('set-discount'), '100');
    // 300 + 500 − 100: the preview follows the pieces and the discount.
    expect(screen.getByTestId('set-price')).toHaveTextContent(/700/);

    const save = screen.getByRole('button', { name: 'حفظ' });
    await fireEvent.press(save);
    await fireEvent.press(save);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(listSets(ctx)).toHaveLength(1);
    expect(listSets(ctx)[0].name).toBe('طقم العروس');
  });

  it('refuses a set without a name, and saves nothing', async () => {
    const onDone = jest.fn();
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {}); // eslint-disable-line @typescript-eslint/no-require-imports
    await renderScreen(<SetFormView ctx={ctx} onDone={onDone} />);
    await fireEvent.press(screen.getByTestId('set-pick-خاتم'));
    await fireEvent.press(screen.getByRole('button', { name: 'حفظ' }));
    expect(onDone).not.toHaveBeenCalled();
    expect(listSets(ctx)).toHaveLength(0);
  });
});
