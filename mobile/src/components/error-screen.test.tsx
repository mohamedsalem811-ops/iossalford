import { fireEvent, screen } from '@testing-library/react-native';

import { renderScreen } from '@/testing/render';

import { ErrorScreen } from './error-screen';

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
const mockLog = jest.fn();
jest.mock('@/lib/error-log', () => ({ logError: (...a: unknown[]) => mockLog(...a) }));

it('shows a retry screen instead of closing the app, and logs the error once', async () => {
  const retry = jest.fn(() => Promise.resolve());
  const error = new Error('boom');
  await renderScreen(<ErrorScreen error={error} retry={retry} where="more/sales" />);
  expect(screen.getByText('حدث خطأ في هذه الشاشة')).toBeTruthy();
  expect(mockLog).toHaveBeenCalledTimes(1);
  expect(mockLog).toHaveBeenCalledWith('more/sales', error);
  fireEvent.press(screen.getByTestId('error-retry'));
  expect(retry).toHaveBeenCalled();
});
