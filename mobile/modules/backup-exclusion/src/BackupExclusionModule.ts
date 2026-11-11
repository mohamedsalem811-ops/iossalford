import { NativeModule, requireOptionalNativeModule } from 'expo';

declare class BackupExclusionModule extends NativeModule {
  exclude(paths: string[]): number;
  isExcluded(path: string): boolean;
}

/**
 * The app's own native module, in the installed app only. Expo Go does not have it (null), and
 * there nothing needs excluding: Expo Go's data is for testing.
 */
export default requireOptionalNativeModule<BackupExclusionModule>('BackupExclusion');
