/* global beforeEach */
// The app shows its screens only to someone signed in, so screen tests start with the owner
// signed in. Tests of an employee, or of nobody signed in, set it themselves.
beforeEach(() => {
  require('@/state/session').setActor({ kind: 'owner' });
});
