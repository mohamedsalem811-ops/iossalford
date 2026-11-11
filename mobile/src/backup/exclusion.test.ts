const mockExclude = jest.fn(() => 2);
let mockInstalled = true;

jest.mock('../../modules/backup-exclusion/src/BackupExclusionModule', () => ({
  __esModule: true,
  get default() {
    return mockInstalled ? { exclude: mockExclude, isExcluded: () => true } : null;
  },
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use imports
jest.mock('expo-file-system', () => require('@/testing/memory-fs').memoryFs());
jest.mock('expo', () => ({ isRunningInExpoGo: () => false }));

describe('excluding the data from the device iCloud backup', () => {
  beforeEach(() => {
    jest.resetModules();
    mockExclude.mockClear();
  });

  it('marks the private folder (databases, photos) and Documents (backups, receipts)', () => {
    mockInstalled = true;
    const m = jest.requireActual<typeof import('./exclusion')>('./exclusion');
    m.excludeAppDataFromBackup();
    expect(mockExclude).toHaveBeenCalledWith([
      'container/Library/Application Support/SALFORD',
      'container/Library/Application Support/SALFORD/SQLite',
      'container/Documents',
    ]);
    expect(m.canExcludeFromBackup()).toBe(true);
    expect(m.isAppDataExcluded()).toBe(true);
  });

  it('does nothing in Expo Go, where the module is absent', () => {
    mockInstalled = false;
    const m = jest.requireActual<typeof import('./exclusion')>('./exclusion');
    m.excludeAppDataFromBackup();
    expect(mockExclude).not.toHaveBeenCalled();
    expect(m.canExcludeFromBackup()).toBe(false);
    expect(m.isAppDataExcluded()).toBe(false);
  });
});
