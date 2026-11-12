/**
 * The staff list and lock settings of this device, in "staff.json" in the app's private folder
 * (never in the Files app). Written under a temporary name and renamed, so a half-written file
 * can't exist. PINs are never here: each one is in the Keychain (security/pin.ts).
 */
import { File } from 'expo-file-system';
import { create } from 'zustand';

import { privateRoot } from '@/lib/storage';

import { EMPTY_STAFF, parseStaff, type Staff } from './model';

const NAME = 'staff.json';
const PART = 'staff.json.part';

function read(): Staff {
  try {
    const f = new File(privateRoot(), NAME);
    return f.exists ? parseStaff(f.textSync()) : EMPTY_STAFF;
  } catch {
    return EMPTY_STAFF;
  }
}

function write(staff: Staff) {
  const part = new File(privateRoot(), PART);
  if (part.exists) part.delete();
  part.writeSync(JSON.stringify(staff));
  const final = new File(privateRoot(), NAME);
  if (final.exists) final.delete();
  part.rename(NAME);
}

type StaffStore = { staff: Staff; save: (next: Staff) => void };

export const useStaffStore = create<StaffStore>()((set) => ({
  staff: read(),
  save: (next) => {
    // Written first: if the file can't be written, the change does not happen (an error shows).
    write(next);
    set({ staff: next });
  },
}));

export const getStaff = () => useStaffStore.getState().staff;
export const saveStaff = (next: Staff) => useStaffStore.getState().save(next);
export const useStaff = () => useStaffStore((s) => s.staff);
