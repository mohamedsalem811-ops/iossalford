/* global jest */
// Native modules that have no JavaScript fallback in tests.
// Animations: a plain view in tests (the animation library needs its native side).
jest.mock('@/components/appear', () => ({
  Appear: ({ children }) => children,
}));
jest.mock('react-native-keyboard-controller', () =>
  require('react-native-keyboard-controller/jest'),
);
