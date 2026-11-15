/**
 * The app is built with the React Compiler (app.json: experiments.reactCompiler). Metro asks
 * babel-preset-expo for it; Jest does not, so the tests ran code the compiler had not touched and
 * could not see what it changes. Run 65 on the simulator: a customer's wanted piece was saved but
 * the list kept showing (0), because the compiler kept a read made while drawing. Under Jest the
 * same compiler now runs on the app's own code, with the options of a release build (as in
 * babel-preset-expo's configs/expo.js), so the tests run what the phone runs.
 */
const compiler = require.resolve('babel-plugin-react-compiler', {
  paths: [require.resolve('babel-preset-expo')],
});

module.exports = function config(api) {
  // jest-expo calls Babel as { name: 'metro', bundler: 'jest' } (see `npx jest --showConfig`).
  const jest = api.caller((caller) => caller?.bundler === 'jest');
  return {
    presets: ['babel-preset-expo'],
    overrides: jest
      ? [
          {
            // The app's code only: not packages, and not the tests (their jest.mock factories
            // may not refer to the compiler's helpers).
            test: (file) =>
              !!file &&
              !file.includes('node_modules') &&
              file.includes('/src/') &&
              !/\.test\.[jt]sx?$/.test(file),
            plugins: [
              [
                compiler,
                {
                  target: '19',
                  panicThreshold: 'NONE',
                  environment: { enableResetCacheOnSourceFileChanges: false },
                },
              ],
            ],
          },
        ]
      : [],
  };
};
