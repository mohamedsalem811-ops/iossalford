import { NativeModule, requireOptionalNativeModule } from 'expo';

export type KeyCommand = { id: string; input: string; title: string };

declare class KeyCommandsModule extends NativeModule<{
  onKeyCommand: (event: { id: string }) => void;
}> {
  setCommands(commands: KeyCommand[]): void;
}

/** The app's own native module, in the installed app only (Expo Go: null, no shortcuts). */
export default requireOptionalNativeModule<KeyCommandsModule>('KeyCommands');
