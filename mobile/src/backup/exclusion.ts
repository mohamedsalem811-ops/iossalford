/**
 * Keeps the shop's data out of the device's own iCloud backup (the owner's choice: backups stay
 * on the device until iCloud is added later). Marks the app's documents folder (databases, photos,
 * receipts, backups) and its SQLite folder as excluded. Installed app only: in Expo Go the native
 * module is absent and this does nothing.
 */
import { Directory, Paths } from 'expo-file-system';

import BackupExclusion from '../../modules/backup-exclusion/src/BackupExclusionModule';

/** True when the installed app can exclude its data (false in Expo Go). */
export const canExcludeFromBackup = () => BackupExclusion !== null;

/** Marks the app's folders; safe to call at every start (iOS keeps the mark). */
export function excludeAppDataFromBackup(): void {
  if (!BackupExclusion) return;
  try {
    // Excluding a folder excludes everything in it; the databases are in Documents/SQLite.
    BackupExclusion.exclude([Paths.document.uri, new Directory(Paths.document, 'SQLite').uri]);
  } catch {
    // Never stop the app over this; the next start tries again.
  }
}

/** Whether the documents folder is marked (the backup screen says so). */
export function isAppDataExcluded(): boolean {
  if (!BackupExclusion) return false;
  try {
    return BackupExclusion.isExcluded(Paths.document.uri);
  } catch {
    return false;
  }
}
