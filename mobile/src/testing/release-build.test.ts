/**
 * 10.1, the release build: version 1.0.0 with a new build number (the .ipa installed before was
 * build 2), and the .ipa built without the test-only screens (the component gallery shows only when
 * a build sets EXPO_PUBLIC_TEST_SCREENS, which only the simulator build does).
 */
/* eslint-disable @typescript-eslint/no-require-imports -- Node's own modules, as in flow-parts.test.ts */
const { readFileSync } = require('node:fs') as {
  readFileSync: (p: string, enc: 'utf8') => string;
};
/* eslint-enable @typescript-eslint/no-require-imports */

const app = JSON.parse(readFileSync('app.json', 'utf8')) as {
  expo: { version: string; ios: { buildNumber: string } };
};

it('is version 1.0.0, build 3', () => {
  expect(app.expo.version).toBe('1.0.0');
  expect(app.expo.ios.buildNumber).toBe('3');
});

it('builds the .ipa without the test-only screens', () => {
  expect(readFileSync('../.github/workflows/mobile-ipa.yml', 'utf8')).not.toContain(
    'EXPO_PUBLIC_TEST_SCREENS',
  );
});
