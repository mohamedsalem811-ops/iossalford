/**
 * Keeps the shop's data out of the device's own iCloud backup (the owner's choice: backups stay
 * on the device until iCloud is added later). Marks the app's private folder (databases, photos)
 * and its documents folder (backups, receipts) as excluded. Installed app only: in Expo Go the native
 * module is absent and this does nothing.
 */
import { Paths } from 'expo-file-system';

import { databaseFolder, privateRoot } from '@/lib/storage';

import BackupExclusion from '../../modules/backup-exclusion/src/BackupExclusionModule';

/** True when the installed app can exclude its data (false in Expo Go). */
export const canExcludeFromBackup = () => BackupExclusion !== null;

/** Marks the app's folders; safe to call at every start (iOS keeps the mark). */
export function excludeAppDataFromBackup(): void {
  if (!BackupExclusion) return;
  try {
    // Excluding a folder excludes everything in it.
    BackupExclusion.exclude([privateRoot().uri, databaseFolder().uri, Paths.document.uri]);
  } catch {
    // Never stop the app over this; the next start tries again.
  }
}

/** Whether the app's folders are marked (the backup screen says so). */
export function isAppDataExcluded(): boolean {
  if (!BackupExclusion) return false;
  try {
    return (
      BackupExclusion.isExcluded(privateRoot().uri) &&
      BackupExclusion.isExcluded(Paths.document.uri)
    );
  } catch {
    return false;
  }
}
