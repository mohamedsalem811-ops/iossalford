/**
 * What the runtime version (fingerprint) of the installed app depends on: the native side only.
 * npm scripts and .gitignore don't change the .ipa, so editing them never needs a new build.
 */
const { SourceSkips } = require('expo/fingerprint');

/** @type {import('expo/fingerprint').Config} */
module.exports = {
  sourceSkips: SourceSkips.PackageJsonScriptsAll | SourceSkips.GitIgnore,
};
