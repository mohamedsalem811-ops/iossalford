import { fireEvent, screen } from '@testing-library/react-native';

import { renderScreen } from '@/testing/render';

import { SetupScreen } from './setup';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));

async function enter(pin: string) {
  for (const d of pin) await fireEvent.press(screen.getByTestId(`pin-key-${d}`));
}

describe('SetupScreen', () => {
  it('creates the jewelry PIN, then the scarves PIN, each entered twice', async () => {
    const savePin = jest.fn(async () => {});
    const onDone = jest.fn();
    await renderScreen(<SetupScreen savePin={savePin} onDone={onDone} />, null);

    expect(screen.getByText('الخطوة 1 من 2')).toBeOnTheScreen();
    expect(screen.getByText('أنشئ رمز نظام المجوهرات')).toBeOnTheScreen();
    await enter('19283746');
    expect(screen.getByText('أكّد الرمز')).toBeOnTheScreen();
    await enter('19283746');
    expect(savePin).toHaveBeenCalledWith('jewelry', '19283746');

    expect(screen.getByText('الخطوة 2 من 2')).toBeOnTheScreen();
    expect(screen.getByText('أنشئ رمز نظام الأوشحة')).toBeOnTheScreen();
    await enter('56473829');
    await enter('56473829');
    expect(savePin).toHaveBeenLastCalledWith('scarves', '56473829');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('starts the PIN again when the two entries differ', async () => {
    const savePin = jest.fn(async () => {});
    await renderScreen(<SetupScreen savePin={savePin} onDone={() => {}} />, null);
    await enter('19283746');
    await enter('19283745');
    expect(savePin).not.toHaveBeenCalled();
    expect(screen.getByText('الرمزان غير متطابقين، أدخل الرمز من جديد')).toBeOnTheScreen();
    expect(screen.getByText('أنشئ رمز نظام المجوهرات')).toBeOnTheScreen();
  });

  it('refuses an easy PIN', async () => {
    const savePin = jest.fn(async () => {});
    await renderScreen(<SetupScreen savePin={savePin} onDone={() => {}} />, null);
    await enter('12345678');
    expect(screen.getByText('رمز سهل التخمين: لا تستخدم أرقاماً متتالية')).toBeOnTheScreen();
    await enter('44444444');
    expect(screen.getByText('رمز سهل التخمين: لا تكرر الرقم نفسه')).toBeOnTheScreen();
    expect(screen.queryByText('أكّد الرمز')).toBeNull();
  });

  it('asks only for the systems that have no PIN yet', async () => {
    const savePin = jest.fn(async () => {});
    const onDone = jest.fn();
    await renderScreen(
      <SetupScreen systems={['scarves']} savePin={savePin} onDone={onDone} />,
      null,
    );
    expect(screen.getByText('الخطوة 1 من 1')).toBeOnTheScreen();
    expect(screen.getByText('أنشئ رمز نظام الأوشحة')).toBeOnTheScreen();
    await enter('56473829');
    await enter('56473829');
    expect(savePin).toHaveBeenCalledTimes(1);
    expect(savePin).toHaveBeenCalledWith('scarves', '56473829');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('shows the error and starts over when saving fails', async () => {
    const savePin = jest.fn(async () => {
      throw new Error('تعذر الحفظ في سلسلة المفاتيح');
    });
    const onDone = jest.fn();
    await renderScreen(<SetupScreen savePin={savePin} onDone={onDone} />, null);
    await enter('19283746');
    await enter('19283746');
    expect(screen.getByText('تعذر الحفظ في سلسلة المفاتيح')).toBeOnTheScreen();
    expect(screen.getByText('أنشئ رمز نظام المجوهرات')).toBeOnTheScreen();
    expect(onDone).not.toHaveBeenCalled();
  });
});
