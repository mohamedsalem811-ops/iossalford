import { fireEvent, screen } from '@testing-library/react-native';

import { renderScreen } from '@/testing/render';

import { ChooserScreen } from './chooser';

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));

describe('ChooserScreen', () => {
  it('opens the chosen system and highlights the one used last', async () => {
    const onChoose = jest.fn();
    await renderScreen(<ChooserScreen last="scarves" version="1.0.0" onChoose={onChoose} />, null);
    expect(screen.getByTestId('system-scarves')).toBeSelected();
    expect(screen.getByTestId('system-jewelry')).not.toBeSelected();
    expect(screen.getByText('الإصدار 1.0.0')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'نظام المجوهرات' }));
    expect(onChoose).toHaveBeenCalledWith('jewelry');
    await fireEvent.press(screen.getByRole('button', { name: 'نظام الأوشحة' }));
    expect(onChoose).toHaveBeenLastCalledWith('scarves');
  });
});
