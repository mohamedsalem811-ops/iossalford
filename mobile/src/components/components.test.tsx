import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { palettes, ThemeProvider, type SystemId } from '@/theme';

import { Button, ListGroup, ListRow, Logo, NumberField, Stat, SystemCard, Text } from '.';

jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));

async function wrap(node: ReactNode, system: SystemId = 'jewelry') {
  return await render(
    <ThemeProvider system={system} appearance="light">
      {node}
    </ThemeProvider>,
  );
}

describe('Text', () => {
  it('aligns to the start edge and uses the theme colour', async () => {
    await wrap(<Text tone="accent">مرحبا</Text>);
    const el = screen.getByText('مرحبا');
    expect(el).toHaveStyle({ textAlign: 'left', color: palettes.jewelry.light.accent });
  });

  it('follows the system palette', async () => {
    await wrap(<Text tone="accent">وشاح</Text>, 'scarves');
    expect(screen.getByText('وشاح')).toHaveStyle({ color: palettes.scarves.light.accent });
  });
});

describe('Button', () => {
  it('calls onPress', async () => {
    const onPress = jest.fn();
    await wrap(<Button title="بيع" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'بيع' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does nothing while disabled or loading', async () => {
    const onPress = jest.fn();
    await wrap(
      <>
        <Button title="حفظ" onPress={onPress} disabled />
        <Button title="إرسال" onPress={onPress} loading />
      </>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'حفظ' }));
    await fireEvent.press(screen.getByRole('button', { name: 'إرسال' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('NumberField', () => {
  it('turns Arabic digits into 0-9 as they are typed', async () => {
    const onChange = jest.fn();
    await wrap(<NumberField label="السعر" value="" onChangeText={onChange} />);
    await fireEvent.changeText(screen.getByLabelText('السعر'), '١٢٫٥');
    expect(onChange).toHaveBeenCalledWith('12.5');
  });

  it('keeps whole numbers for quantities', async () => {
    const onChange = jest.fn();
    await wrap(<NumberField label="الكمية" kind="integer" value="" onChangeText={onChange} />);
    await fireEvent.changeText(screen.getByLabelText('الكمية'), '3.5 قطع');
    expect(onChange).toHaveBeenCalledWith('35');
  });
});

describe('ListGroup and ListRow', () => {
  it('renders rows and handles presses', async () => {
    const onPress = jest.fn();
    await wrap(
      <ListGroup header="اليوم">
        <ListRow title="صافي الربح" value="1,120 د.ل" />
        <ListRow title="ديون العملاء" value="2,400 د.ل" onPress={onPress} />
      </ListGroup>,
    );
    expect(screen.getByText('اليوم')).toBeOnTheScreen();
    expect(screen.getByText('1,120 د.ل')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'ديون العملاء، 2,400 د.ل' }));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('Stat', () => {
  it('shows a value and its label', async () => {
    await wrap(<Stat value="6" label="فواتير" />);
    expect(screen.getByText('6')).toBeOnTheScreen();
    expect(screen.getByText('فواتير')).toBeOnTheScreen();
  });
});

describe('Logo', () => {
  it('draws the jewelry and scarves lettering with an accessible name', async () => {
    await wrap(<Logo system="jewelry" />);
    expect(screen.getByLabelText('SALFORD jewelry')).toBeOnTheScreen();
    expect(screen.getByText('jewelry')).toBeOnTheScreen();
    await screen.unmount();
    await wrap(<Logo system="scarves" />, 'scarves');
    expect(screen.getByLabelText('SALFORD scarfs')).toBeOnTheScreen();
    expect(screen.getByText('scarfs')).toBeOnTheScreen();
  });

  it('hides the wordmark in the mark-only version', async () => {
    await wrap(<Logo system="jewelry" markOnly />);
    expect(screen.queryByText('SALFORD')).toBeNull();
  });
});

describe('SystemCard', () => {
  it('is a button named after its system, drawn in its own colours', async () => {
    const onPress = jest.fn();
    await wrap(<SystemCard system="scarves" onPress={onPress} />);
    const card = screen.getByRole('button', { name: 'نظام الأوشحة' });
    expect(card).toHaveStyle({ borderColor: palettes.scarves.light.accent });
    await fireEvent.press(card);
    expect(onPress).toHaveBeenCalled();
  });

  it('marks the last used system as selected with a stronger edge', async () => {
    await wrap(<SystemCard system="jewelry" selected onPress={() => {}} />);
    const card = screen.getByRole('button', { name: 'نظام المجوهرات' });
    expect(card).toBeSelected();
    expect(card).toHaveStyle({ borderWidth: 2 });
  });
});

describe('Logo wordmark', () => {
  it('keeps SALFORD on one line', async () => {
    await wrap(<Logo system="jewelry" />);
    expect(screen.getByText('SALFORD').props.numberOfLines).toBe(1);
  });
});
