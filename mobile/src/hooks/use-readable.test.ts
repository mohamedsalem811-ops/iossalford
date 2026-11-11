import { readableSide } from './use-readable';

describe('readableSide', () => {
  it('centres the content on a wide iPad and keeps the 16 pt edge on iPhone', () => {
    expect(readableSide(1366, 760)).toBe(303);
    expect(readableSide(1024, 760)).toBe(132);
    expect(readableSide(390, 760)).toBe(16);
    expect(readableSide(0, 760)).toBe(16);
  });
});
