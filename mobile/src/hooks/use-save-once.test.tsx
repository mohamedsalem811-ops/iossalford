import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { useSaveOnce } from './use-save-once';

function Form({ save, again = false }: { save: () => boolean | void; again?: boolean }) {
  const once = useSaveOnce(again);
  return (
    <Pressable accessibilityRole="button" onPress={() => once(save)}>
      <Text>حفظ</Text>
    </Pressable>
  );
}

describe('saving once', () => {
  it('ignores a quick second tap after a save that worked', async () => {
    const save = jest.fn(() => true);
    await render(<Form save={save} />);
    await fireEvent.press(screen.getByText('حفظ'));
    await fireEvent.press(screen.getByText('حفظ'));
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('lets the owner try again after a refusal (a missing field, a rule)', async () => {
    const save = jest.fn<boolean | void, []>().mockReturnValueOnce(undefined).mockReturnValue(true);
    await render(<Form save={save} />);
    await fireEvent.press(screen.getByText('حفظ'));
    await fireEvent.press(screen.getByText('حفظ'));
    await fireEvent.press(screen.getByText('حفظ'));
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('a form that stays open (expenses) saves again after a short pause', async () => {
    jest.useFakeTimers();
    const save = jest.fn(() => true);
    await render(<Form save={save} again />);
    await fireEvent.press(screen.getByText('حفظ'));
    await fireEvent.press(screen.getByText('حفظ'));
    expect(save).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(900);
    await fireEvent.press(screen.getByText('حفظ'));
    expect(save).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('a save that throws can be tried again', async () => {
    const save = jest
      .fn<boolean, []>()
      .mockImplementationOnce(() => {
        throw new Error('x');
      })
      .mockReturnValue(true);
    await render(<Form save={save} />);
    await expect(fireEvent.press(screen.getByText('حفظ'))).rejects.toThrow('x');
    await fireEvent.press(screen.getByText('حفظ'));
    expect(save).toHaveBeenCalledTimes(2);
  });
});
