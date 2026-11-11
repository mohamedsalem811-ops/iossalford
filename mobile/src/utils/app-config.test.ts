/**
 * Guards the settings the owner's devices and the side-by-side install depend on.
 * If one of these changes by accident, the build could stop installing or replace the old app.
 */
import appConfig from '../../app.config';
import appJson from '../../app.json';

const expo = appJson.expo;
const buildProperties = expo.plugins.find(
  (p): p is [string, { ios: { deploymentTarget: string } }] =>
    Array.isArray(p) && p[0] === 'expo-build-properties',
);

describe('app config', () => {
  it('uses the new bundle id so it installs next to the current app', () => {
    expect(expo.ios.bundleIdentifier).toBe('com.salford.pos');
  });

  it('is iOS only and supports iPad', () => {
    expect(expo.platforms).toEqual(['ios']);
    expect(expo.ios.supportsTablet).toBe(true);
  });

  it('targets iOS 26.0', () => {
    expect(buildProperties?.[1].ios.deploymentTarget).toBe('26.0');
  });

  it('turns on instant updates for the installed app, on the production channel, never waiting', () => {
    expect(expo.updates.enabled).toBe(true);
    expect(expo.updates.checkAutomatically).toBe('ON_LOAD');
    // 0: the app opens at once with the version it has, online or not.
    expect(expo.updates.fallbackToCacheTimeout).toBe(0);
    expect(expo.updates.requestHeaders['expo-channel-name']).toBe('production');
  });

  it('ties builds to their native side, and Expo Go previews to the SDK', () => {
    const config = (env?: string) => {
      const saved = process.env.SALFORD_UPDATE_TARGET;
      if (env) process.env.SALFORD_UPDATE_TARGET = env;
      else delete process.env.SALFORD_UPDATE_TARGET;
      try {
        return appConfig({ config: expo } as never).runtimeVersion;
      } finally {
        if (saved === undefined) delete process.env.SALFORD_UPDATE_TARGET;
        else process.env.SALFORD_UPDATE_TARGET = saved;
      }
    };
    expect(config()).toEqual({ policy: 'fingerprint' });
    expect(config('expo-go')).toEqual({ policy: 'sdkVersion' });
  });
});
