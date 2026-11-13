/**
 * The owner's staff actions (audit F-13): each PIN goes to the Keychain before the person is
 * listed, a refused step changes nothing, and the list travels to the other device without PINs.
 */
import { Alert } from 'react-native';

import { getStaff, saveStaff } from '@/staff/store';
import { EMPTY_STAFF } from '@/staff/model';

import {
  addEmployeeFlow,
  emergencyCodeFlow,
  receiveStaffList,
  renameFlow,
  resetPinFlow,
  saveLock,
  sendStaffList,
  toggleActiveFlow,
} from './actions';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use imports
jest.mock('expo-file-system', () => require('@/testing/memory-fs').memoryFs());
jest.mock('expo', () => ({ ...jest.requireActual('expo'), isRunningInExpoGo: () => false }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'id-1' }));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(async () => {}) }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('@/security/device', () => ({
  pinVault: {
    setPin: jest.fn(async () => {}),
    newEmergencyCode: jest.fn(async () => '1234-5678'),
  },
}));
jest.mock('@/staff/guards', () => ({ logStaffChange: jest.fn() }));

const fs = jest.requireMock('expo-file-system');
const { pinVault } = jest.requireMock('@/security/device');
const { logStaffChange } = jest.requireMock('@/staff/guards');
const sharing = jest.requireMock('expo-sharing');
const picker = jest.requireMock('expo-document-picker');

type Button = { text?: string; onPress?: (value?: string) => unknown };
let prompt: jest.SpyInstance;
let alert: jest.SpyInstance;
/** Presses a button of the last prompt (or alert), typing `value`. */
const answer = async (spy: jest.SpyInstance, text: string, value?: string) => {
  const buttons = spy.mock.lastCall![2] as Button[];
  await buttons.find((b) => b.text === text)!.onPress!(value);
  await new Promise<void>((r) => setImmediate(r));
};

beforeEach(() => {
  fs.__files.clear();
  saveStaff(EMPTY_STAFF);
  jest.clearAllMocks();
  prompt = jest.spyOn(Alert, 'prompt').mockImplementation(() => {});
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

const names = () => getStaff().employees.map((e) => e.name);

async function addSara() {
  addEmployeeFlow();
  await answer(prompt, 'التالي', ' سارة ');
  await answer(prompt, 'حفظ', '963258');
}

it('adds an employee with a temporary PIN, saved in the Keychain first', async () => {
  await addSara();
  expect(pinVault.setPin).toHaveBeenCalledWith('user.id-1', '963258');
  expect(names()).toEqual(['سارة']);
  expect(getStaff().employees[0]).toMatchObject({ id: 'id-1', active: true, mustChangePin: true });
  expect(logStaffChange).toHaveBeenCalledWith('موظف جديد: سارة', { id: 'id-1' });
});

it('refuses a short PIN or a name already used, and adds no one', async () => {
  addEmployeeFlow();
  await answer(prompt, 'التالي', 'سارة');
  await answer(prompt, 'حفظ', '12');
  expect(alert.mock.lastCall![0]).toBe('لم يتم الحفظ');
  expect(names()).toEqual([]);
  expect(pinVault.setPin).not.toHaveBeenCalled();
  await addSara();
  addEmployeeFlow();
  await answer(prompt, 'التالي', 'سارة');
  expect(alert.mock.lastCall![0]).toBe('لم يتم الحفظ');
  expect(names()).toEqual(['سارة']);
});

it('lists no one when the PIN could not be saved', async () => {
  pinVault.setPin.mockRejectedValueOnce(new Error('keychain'));
  await addSara();
  expect(names()).toEqual([]);
  expect(alert.mock.lastCall![1]).toBe('تعذّر حفظ الرمز، لم يتغير شيء');
});

it('gives a new temporary PIN, renames, suspends and reactivates', async () => {
  await addSara();
  saveStaff({
    ...getStaff(),
    employees: getStaff().employees.map((e) => ({ ...e, mustChangePin: false })),
  });
  const sara = () => getStaff().employees[0];
  resetPinFlow(sara());
  await answer(prompt, 'حفظ', '741852');
  expect(pinVault.setPin).toHaveBeenLastCalledWith('user.id-1', '741852');
  expect(sara().mustChangePin).toBe(true);

  renameFlow(sara());
  await answer(prompt, 'حفظ', 'سارة علي');
  expect(names()).toEqual(['سارة علي']);

  toggleActiveFlow(sara());
  expect(sara().active).toBe(true); // asks first
  await answer(alert, 'إيقاف');
  expect(sara().active).toBe(false);
  toggleActiveFlow(sara());
  expect(sara().active).toBe(true);
  expect(logStaffChange).toHaveBeenCalledWith('إيقاف سارة علي', { id: 'id-1' });
});

it('saves the auto-lock settings', () => {
  saveLock({ ...getStaff().lock, lockMinutes: 5 });
  expect(getStaff().lock.lockMinutes).toBe(5);
  expect(logStaffChange).toHaveBeenCalledWith('تغيير إعدادات القفل التلقائي', expect.anything());
});

it('shows a new emergency code once', async () => {
  const onMade = jest.fn();
  emergencyCodeFlow(false, onMade);
  await answer(alert, 'إنشاء الرمز');
  expect(onMade).toHaveBeenCalled();
  expect(alert.mock.lastCall![1]).toContain('1234-5678');
});

it('sends the list without PINs and adds the people of a received list', async () => {
  await addSara();
  let sent = '';
  sharing.shareAsync.mockImplementationOnce(async (uri: string) => {
    sent = fs.__files.get(uri);
  });
  await sendStaffList();
  expect(JSON.parse(sent)).toEqual({
    kind: 'salford-staff',
    employees: [{ id: 'id-1', name: 'سارة', active: true }],
  });
  expect(sent).not.toContain('963258');
  // The temporary file is gone after sharing.
  expect([...fs.__files.keys()].some((k: string) => k.includes('SALFORD-staff'))).toBe(false);

  // On the other device: the list arrives.
  saveStaff(EMPTY_STAFF);
  new fs.File('container/Library/Caches/in.json').writeSync(sent);
  picker.getDocumentAsync.mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: 'container/Library/Caches/in.json' }],
  });
  await receiveStaffList();
  expect(names()).toEqual(['سارة']);
  expect(alert.mock.lastCall![0]).toBe('تم استلام القائمة');

  // A file that is not a staff list changes nothing.
  new fs.File('container/Library/Caches/bad.json').writeSync('{}');
  picker.getDocumentAsync.mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: 'container/Library/Caches/bad.json' }],
  });
  await receiveStaffList();
  expect(alert.mock.lastCall![1]).toBe('هذا الملف ليس قائمة موظفين من SALFORD POS');
  expect(names()).toEqual(['سارة']);
});
