import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Gallery } from './gallery';

jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('@/components/sheet', () => ({ Sheet: () => null }));
// The native segmented control is replaced by plain buttons so the test can switch segments.
jest.mock('@expo/ui/community/segmented-control', () => ({
  __esModule: true,
  default: ({
    values,
    onChange,
  }: {
    values: string[];
    onChange: (e: { nativeEvent: { selectedSegmentIndex: number; value: string } }) => void;
  }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use imports
    const { Pressable, Text: RNText, View } = require('react-native');
    return (
      <View>
        {values.map((v, i) => (
          <Pressable
            key={v}
            accessibilityRole="button"
            onPress={() => onChange({ nativeEvent: { selectedSegmentIndex: i, value: v } })}>
            <RNText>{v}</RNText>
          </Pressable>
        ))}
      </View>
    );
  },
}));

describe('Gallery', () => {
  it('shows the jewelry design first and switches to scarves', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <Gallery />
      </SafeAreaProvider>,
    );
    expect(screen.getByLabelText('SALFORD jewelry')).toBeOnTheScreen();
    expect(screen.getByText('4,350 د.ل')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'الأوشحة' }));
    expect(screen.getByLabelText('SALFORD scarfs')).toBeOnTheScreen();
    expect(screen.getByText('1,980 د.ل')).toBeOnTheScreen();
    expect(screen.getByText('140×140')).toBeOnTheScreen();
  });
});
