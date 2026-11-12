import { listPaneWidth } from './split-view';

describe('the list pane beside a detail (iPad)', () => {
  it('takes about a third of the window, between 300 and 400 pt', () => {
    // A narrow Split View or Stage Manager window: the detail keeps most of the room.
    expect(listPaneWidth(700)).toBe(300);
    expect(listPaneWidth(1000)).toBe(360);
    // iPad landscape and larger: never wider than 400.
    expect(listPaneWidth(1366)).toBe(400);
  });
});
