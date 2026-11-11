import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ArabicButton } from './keyboard-bar';

describe('KeyboardBar', () => {
  it('names its button "تم" for VoiceOver and the tap-through tests, not the English "Done"', async () => {
    const onPress = jest.fn();
    await render(
      <ArabicButton
        onPress={onPress}
        testID="keyboard.toolbar.done"
        accessibilityLabel="Done"
        accessibilityHint="Closes the keyboard"
        theme={{} as never}>
        <Text>تم</Text>
      </ArabicButton>,
    );
    const button = screen.getByTestId('keyboard.toolbar.done');
    expect(button).toHaveProp('accessibilityLabel', 'تم');
    expect(button).toHaveProp('accessibilityHint', 'يغلق لوحة المفاتيح');
  });
});
