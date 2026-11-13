/**
 * The staff list file (staff.json): written under a temporary name and renamed, and read back
 * from the temporary name if the app stopped between the two steps (audit F-9).
 */
import { addEmployee, EMPTY_STAFF } from './model';
import { read, saveStaff, getStaff } from './store';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use imports
jest.mock('expo-file-system', () => require('@/testing/memory-fs').memoryFs());
jest.mock('expo', () => ({ isRunningInExpoGo: () => false }));

const fs = jest.requireMock('expo-file-system');
const files: Map<string, string> = fs.__files;
const PRIVATE = 'container/Library/Application Support/SALFORD';

beforeEach(() => files.clear());

it('saves the list and reads it back', () => {
  saveStaff(addEmployee(EMPTY_STAFF, 'سارة', 'e1', new Date(2026, 10, 13)));
  expect(files.has(`${PRIVATE}/staff.json`)).toBe(true);
  expect(files.has(`${PRIVATE}/staff.json.part`)).toBe(false);
  expect(read().employees.map((e) => e.name)).toEqual(['سارة']);
  expect(getStaff().employees).toHaveLength(1);
});

it('uses the complete new file when the app stopped before renaming it', () => {
  saveStaff(addEmployee(EMPTY_STAFF, 'سارة', 'e1', new Date(2026, 10, 13)));
  // The old file removed, the new one not yet renamed.
  files.set(`${PRIVATE}/staff.json.part`, files.get(`${PRIVATE}/staff.json`)!);
  files.delete(`${PRIVATE}/staff.json`);
  expect(read().employees.map((e) => e.name)).toEqual(['سارة']);
  // Put back under its own name.
  expect(files.has(`${PRIVATE}/staff.json`)).toBe(true);
  expect(files.has(`${PRIVATE}/staff.json.part`)).toBe(false);
});

it('starts empty when there is no list at all', () => {
  expect(read()).toEqual(EMPTY_STAFF);
});
