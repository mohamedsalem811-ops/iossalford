import { fireEvent, screen } from '@testing-library/react-native';

import { renderScreen } from '@/testing/render';

import { SettingsScreen, type UpdateRows } from './settings';

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));

async function setup(updates: Partial<UpdateRows> = {}) {
  const rows: UpdateRows = {
    enabled: true,
    running: 'النسخة المثبّتة',
    pending: false,
    busy: false,
    onCheck: jest.fn(),
    onRestart: jest.fn(),
    ...updates,
  };
  await renderScreen(
    <SettingsScreen
      system="jewelry"
      rate="7.000"
      appearance="system"
      version="1.0.0 (1)"
      updates={rows}
      onEditRate={jest.fn()}
      onChangePin={jest.fn()}
      onAppearance={jest.fn()}
    />,
  );
  return rows;
}

describe('Settings: instant updates', () => {
  it('shows the running version and checks on request', async () => {
    const rows = await setup();
    expect(screen.getByText('النسخة المثبّتة')).toBeTruthy();
    expect(screen.queryByTestId('settings-update-restart')).toBeNull();
    fireEvent.press(screen.getByTestId('settings-update-check'));
    expect(rows.onCheck).toHaveBeenCalled();
  });

  it('offers a restart when an update is waiting', async () => {
    const rows = await setup({ pending: true });
    fireEvent.press(screen.getByTestId('settings-update-restart'));
    expect(rows.onRestart).toHaveBeenCalled();
  });

  it('does not check twice while a check is running', async () => {
    const rows = await setup({ busy: true });
    expect(screen.getByText('جارٍ التحقق…')).toBeTruthy();
    fireEvent.press(screen.getByTestId('settings-update-check'));
    expect(rows.onCheck).not.toHaveBeenCalled();
  });

  it('has no check button where updates do not work (Expo Go)', async () => {
    await setup({ enabled: false, running: 'التحديثات تعمل في التطبيق المثبّت فقط' });
    expect(screen.queryByTestId('settings-update-check')).toBeNull();
    expect(screen.getByText('التحديثات تعمل في التطبيق المثبّت فقط')).toBeTruthy();
  });
});
