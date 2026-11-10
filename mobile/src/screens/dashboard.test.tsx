import { fireEvent, screen } from '@testing-library/react-native';

import { renderScreen } from '@/testing/render';

import { DashboardScreen } from './dashboard';

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));

const today = {
  total: 4_350_000,
  profit: 1_120_500,
  sales: 6,
  pieces: 11,
  byMethod: { cash: 4_350_000, card: 0, transfer: 0, credit: 0 },
};

describe('DashboardScreen', () => {
  it("shows today's figures, the rate, and switches system", async () => {
    const onSwitch = jest.fn();
    await renderScreen(
      <DashboardScreen
        system="scarves"
        date={new Date(2026, 10, 9)}
        today={today}
        rate={7_125}
        onSwitch={onSwitch}
      />,
      'scarves',
    );
    expect(screen.getByLabelText('SALFORD scarfs')).toBeOnTheScreen();
    expect(screen.getByText('الإثنين 9 نوفمبر 2026')).toBeOnTheScreen();
    expect(screen.getByTestId('today-total')).toHaveTextContent('4,350 د.ل');
    expect(screen.getByText('1,120.5')).toBeOnTheScreen();
    expect(screen.getByText('وشاح')).toBeOnTheScreen();
    expect(screen.getByText('7.125')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'تبديل النظام' }));
    expect(onSwitch).toHaveBeenCalled();
  });

  it('opens the rate editor from the rate row', async () => {
    const onEditRate = jest.fn();
    await renderScreen(
      <DashboardScreen
        system="jewelry"
        date={new Date(2026, 10, 9)}
        today={today}
        rate={7_000}
        onSwitch={() => {}}
        onEditRate={onEditRate}
      />,
    );
    await fireEvent.press(screen.getByTestId('rate-row'));
    expect(onEditRate).toHaveBeenCalled();
  });
});
