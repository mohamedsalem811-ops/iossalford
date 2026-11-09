/* global jest */
// Native modules that have no JavaScript fallback in tests.
jest.mock('react-native-keyboard-controller', () =>
  require('react-native-keyboard-controller/jest'),
);
