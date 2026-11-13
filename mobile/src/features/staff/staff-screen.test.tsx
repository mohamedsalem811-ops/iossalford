import { fireEvent, screen } from '@testing-library/react-native';
import { ActionSheetIOS } from 'react-native';

import { addEmployee, EMPTY_STAFF, setActive } from '@/staff/model';
import { renderScreen } from '@/testing/render';

import { StaffScreen, type StaffActions } from './staff-screen';

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));

const actions = (): StaffActions => ({
  onAdd: jest.fn(),
  onResetPin: jest.fn(),
  onRename: jest.fn(),
  onToggleActive: jest.fn(),
  onLock: jest.fn(),
  onEmergencyCode: jest.fn(),
  onSendList: jest.fn(),
  onReceiveList: jest.fn(),
});
const now = new Date(2026, 10, 13);

describe('the staff screen', () => {
  it('starts empty with a button to add the first employee, and asks for the emergency code', async () => {
    const a = actions();
    await renderScreen(<StaffScreen staff={EMPTY_STAFF} hasEmergencyCode={false} actions={a} />);
    expect(screen.getByText('لا يوجد موظفون بعد')).toBeOnTheScreen();
    expect(screen.getByText(/أنشئ رمز الطوارئ/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('إضافة موظف'));
    expect(a.onAdd).toHaveBeenCalled();
  });

  it('lists people with their state; a tap offers a new PIN, rename or suspend', async () => {
    let staff = addEmployee(EMPTY_STAFF, 'سارة', 'a', now);
    staff = setActive(addEmployee(staff, 'علي', 'b', now), 'b', false);
    const a = actions();
    await renderScreen(<StaffScreen staff={staff} hasEmergencyCode actions={a} />);
    expect(screen.getByTestId('staff-سارة')).toHaveTextContent(/نشط • لم يختر رمزه بعد/);
    expect(screen.getByTestId('staff-علي')).toHaveTextContent(/موقوف/);
    const sheet = jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation((o, pick) => pick((o.options as string[]).indexOf('إيقاف الموظف')));
    await fireEvent.press(screen.getByTestId('staff-سارة'));
    expect(a.onToggleActive).toHaveBeenCalledWith(expect.objectContaining({ name: 'سارة' }));
    sheet.mockRestore();
  });

  it('changes the lock time and sets the owner lock', async () => {
    const a = actions();
    await renderScreen(<StaffScreen staff={EMPTY_STAFF} hasEmergencyCode actions={a} />);
    expect(screen.getByTestId('staff-lock-minutes')).toHaveTextContent(/7 دقائق/);
    expect(screen.getByTestId('staff-warn-minutes')).toHaveTextContent(/دقيقتان/);
    const sheet = jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation((o, pick) => pick((o.options as string[]).indexOf('10 دقائق')));
    await fireEvent.press(screen.getByTestId('staff-lock-minutes'));
    expect(a.onLock).toHaveBeenCalledWith({ lockMinutes: 10, warnMinutes: 2, ownerToo: false });
    sheet.mockRestore();
    await fireEvent.press(screen.getByTestId('staff-owner-too'));
    expect(a.onLock).toHaveBeenLastCalledWith({ lockMinutes: 7, warnMinutes: 2, ownerToo: true });
  });
});
