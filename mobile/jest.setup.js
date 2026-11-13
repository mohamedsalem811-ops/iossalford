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
