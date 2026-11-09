import { gridColumns, layoutClass } from './use-layout';

describe('layout', () => {
  it('classifies iPhone, iPad portrait and iPad landscape widths', () => {
    expect(layoutClass(390)).toBe('compact'); // iPhone
    expect(layoutClass(507)).toBe('compact'); // iPad half split view
    expect(layoutClass(820)).toBe('regular'); // iPad portrait
    expect(layoutClass(1180)).toBe('wide'); // iPad landscape
  });

  it('fits more product columns on wider screens', () => {
    expect(gridColumns(390)).toBe(2);
    expect(gridColumns(820)).toBe(4);
    expect(gridColumns(1180)).toBe(6);
    expect(gridColumns(200)).toBe(2); // never fewer than 2
  });
});
