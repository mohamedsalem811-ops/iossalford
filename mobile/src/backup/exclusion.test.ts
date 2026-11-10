const mockExclude = jest.fn(() => 2);
let mockInstalled = true;

jest.mock('../../modules/backup-exclusion/src/BackupExclusionModule', () => ({
  __esModule: true,
  get default() {
    return mockInstalled ? { exclude: mockExclude, isExcluded: () => true } : null;
  },
}));
jest.mock('expo-file-system', () => ({
  Paths: { document: { uri: 'file:///app/Documents/' } },
  Directory: class {
    uri: string;
    constructor(parent: { uri: string }, name: string) {
      this.uri = `${parent.uri}${name}`;
    }
  },
}));

describe('excluding the data from the device iCloud backup', () => {
  beforeEach(() => {
    jest.resetModules();
    mockExclude.mockClear();
  });

  it('marks the documents and database folders in the installed app', () => {
    mockInstalled = true;
    const m = jest.requireActual<typeof import('./exclusion')>('./exclusion');
    m.excludeAppDataFromBackup();
    expect(mockExclude).toHaveBeenCalledWith([
      'file:///app/Documents/',
      'file:///app/Documents/SQLite',
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
