/* global jest */
// Native modules that have no JavaScript fallback in tests.
// Sound: silent in tests (the warning still shows and vibrates).
jest.mock('expo-audio', () => ({
  createAudioPlayer: () => ({ play: () => {}, seekTo: () => Promise.resolve() }),
  setAudioModeAsync: () => Promise.resolve(),
}));
// Animations: a plain view in tests (the animation library needs its native side).
jest.mock('@/components/appear', () => ({
  Appear: ({ children }) => children,
}));
jest.mock('react-native-keyboard-controller', () =>
  require('react-native-keyboard-controller/jest'),
);
// Random ids: Node's crypto stands in for the native one.
jest.mock('expo-crypto', () => {
  let actual = {};
  try {
    actual = jest.requireActual('expo-crypto');
  } catch {
    // A test that mocks expo itself: the random id is enough.
  }
  return { ...actual, randomUUID: () => require('node:crypto').randomUUID() };
});
