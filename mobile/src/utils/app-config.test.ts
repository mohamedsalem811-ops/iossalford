/**
 * Guards the settings the owner's devices and the side-by-side install depend on.
 * If one of these changes by accident, the build could stop installing or replace the old app.
 */
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

  it('never applies previews to the installed app', () => {
    expect(expo.updates.enabled).toBe(false);
  });

  it('keeps previews compatible with Expo Go', () => {
    expect(expo.ios.runtimeVersion).toEqual({ policy: 'sdkVersion' });
  });
});
