import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * app.json holds the app's settings; this only picks the runtime version.
 *
 * - Builds and instant updates for the installed app use the "fingerprint" policy: a hash of the
 *   native side, so an update only ever reaches an .ipa that can run it.
 * - Previews for Expo Go are published with SALFORD_UPDATE_TARGET=expo-go, which uses the SDK
 *   version, because Expo Go only loads updates made for its SDK.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  runtimeVersion:
    process.env.SALFORD_UPDATE_TARGET === 'expo-go'
      ? { policy: 'sdkVersion' }
      : { policy: 'fingerprint' },
});
