/**
 * The owner's staff actions (audit F-13): each PIN goes to the Keychain before the person is
 * listed, a refused step changes nothing, and the list travels to the other device without PINs.
 */
import { Alert } from 'react-native';

import { getStaff, saveStaff } from '@/staff/store';
import { EMPTY_STAFF, worksIn } from '@/staff/model';

import {
  addEmployeeFlow,
  emergencyPasswordFlow,
  receiveStaffList,
  renameFlow,
  resetPinFlow,
  saveLock,
  sendStaffList,
  toggleActiveFlow,
  toggleSystemFlow,
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
    setEmergencyPassword: jest.fn(async () => {}),
  },
}));
jest.mock('@/staff/guards', () => ({ logStaffChange: jest.fn() }));
jest.mock('@/staff/approvals', () => ({
  askOwner: jest.fn(async () => 'token'),
  takeApproval: jest.fn(() => true),
}));
jest.mock('@/backup/password', () => ({ setRecoveryPassword: jest.fn(async () => {}) }));
jest.mock('@/backup/store', () => ({ sealBackups: jest.fn(async () => {}) }));

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

it('ticks and unticks a system for an employee, logged, keeping one (rule A)', async () => {
  await addSara();
  const sara = () => getStaff().employees[0];
  toggleSystemFlow(sara(), 'jewelry');
  expect(worksIn(sara(), 'jewelry')).toBe(false);
  expect(logStaffChange).toHaveBeenLastCalledWith('سارة لا يعمل في نظام المجوهرات', {
    id: sara().id,
    system: 'jewelry',
    on: false,
  });
  toggleSystemFlow(sara(), 'scarves');
  expect(alert.mock.lastCall![0]).toBe('لم يتم الحفظ');
  expect(worksIn(sara(), 'scarves')).toBe(true);
  toggleSystemFlow(sara(), 'jewelry');
  expect(worksIn(sara(), 'jewelry')).toBe(true);
});

it('saves the auto-lock settings', () => {
  saveLock({ ...getStaff().lock, lockMinutes: 5 });
  expect(getStaff().lock.lockMinutes).toBe(5);
  expect(logStaffChange).toHaveBeenCalledWith('تغيير إعدادات القفل التلقائي', expect.anything());
});

it('sets the emergency password the owner chooses, typed twice, after the owner’s PIN (K10)', async () => {
  const { askOwner } = jest.requireMock('@/staff/approvals');
  const { setRecoveryPassword } = jest.requireMock('@/backup/password');
  const { sealBackups } = jest.requireMock('@/backup/store');
  const onMade = jest.fn();
  const flush = () => new Promise<void>((r) => setImmediate(r));
  let run = emergencyPasswordFlow('jewelry', false, onMade);
  await flush();
  expect(askOwner).toHaveBeenCalledWith('jewelry', 'emergency', expect.any(String));
  // Too easy: refused before anything is saved.
  await answer(prompt, 'التالي', 'abc123');
  expect(alert.mock.lastCall![1]).toContain('10');
  await run;
  expect(pinVault.setEmergencyPassword).not.toHaveBeenCalled();

  run = emergencyPasswordFlow('jewelry', false, onMade);
  await flush();
  await answer(prompt, 'التالي', 'Mona2026Salem');
  await answer(prompt, 'حفظ', 'Mona2026Salen');
  await run;
  expect(alert.mock.lastCall![1]).toContain('غير متطابقتين');
  expect(pinVault.setEmergencyPassword).not.toHaveBeenCalled();

  run = emergencyPasswordFlow('jewelry', true, onMade);
  await flush();
  await answer(prompt, 'التالي', 'Mona2026Salem');
  await answer(prompt, 'حفظ', 'mona2026salem');
  await run;
  expect(pinVault.setEmergencyPassword).toHaveBeenCalledWith('Mona2026Salem');
  expect(setRecoveryPassword).toHaveBeenCalledWith('Mona2026Salem');
  expect(sealBackups).toHaveBeenCalledWith('jewelry');
  expect(sealBackups).toHaveBeenCalledWith('scarves');
  expect(logStaffChange).toHaveBeenCalledWith('تغيير كلمة سر الطوارئ');
  expect(onMade).toHaveBeenCalled();
  // The password itself is never logged or shown.
  expect(JSON.stringify(logStaffChange.mock.calls)).not.toMatch(/mona/i);
});

it('says the password was saved when only the backups’ second lock failed (K review)', async () => {
  const { setRecoveryPassword } = jest.requireMock('@/backup/password');
  setRecoveryPassword.mockRejectedValueOnce(new Error('keychain'));
  const onMade = jest.fn();
  const flush = () => new Promise<void>((r) => setImmediate(r));
  const run = emergencyPasswordFlow('jewelry', false, onMade);
  await flush();
  await answer(prompt, 'التالي', 'Mona2026Salem');
  await answer(prompt, 'حفظ', 'Mona2026Salem');
  await run;
  expect(pinVault.setEmergencyPassword).toHaveBeenCalled();
  expect(onMade).toHaveBeenCalled();
  expect(logStaffChange).toHaveBeenCalledWith('وضع كلمة سر الطوارئ');
  expect(alert.mock.lastCall![0]).toBe('حُفظت كلمة سر الطوارئ');
  expect(alert.mock.lastCall![1]).toContain('النسخ الاحتياطية');
});

it('does nothing when the owner does not confirm with their PIN', async () => {
  const { askOwner } = jest.requireMock('@/staff/approvals');
  askOwner.mockResolvedValueOnce(null);
  await emergencyPasswordFlow('jewelry', false, jest.fn());
  expect(prompt).not.toHaveBeenCalled();
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
    employees: [{ id: 'id-1', name: 'سارة', active: true, systems: ['jewelry', 'scarves'] }],
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
