/**
 * The design gallery is for test builds only (1.9, confirmed again for 10.1): the simulator build
 * sets EXPO_PUBLIC_TEST_SCREENS=1; the owner's app opens the start screen instead.
 */
import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import GalleryRoute from '@/app/gallery';

jest.mock('@/screens/gallery', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use imports
  Gallery: () => require('react').createElement(require('react-native').Text, null, 'المعرض'),
}));

const routes = { index: () => <Text>البداية</Text>, gallery: GalleryRoute };
const before = process.env.EXPO_PUBLIC_TEST_SCREENS;
afterEach(() => {
  if (before === undefined) delete process.env.EXPO_PUBLIC_TEST_SCREENS;
  else process.env.EXPO_PUBLIC_TEST_SCREENS = before;
});

it('opens the start screen instead in the owner’s app', async () => {
  delete process.env.EXPO_PUBLIC_TEST_SCREENS;
  await renderRouter(routes, { initialUrl: '/gallery' });
  expect(await screen.findByText('البداية')).toBeOnTheScreen();
  expect(screen.queryByText('المعرض')).toBeNull();
});

it('shows the gallery in a test build', async () => {
  process.env.EXPO_PUBLIC_TEST_SCREENS = '1';
  await renderRouter(routes, { initialUrl: '/gallery' });
  expect(await screen.findByText('المعرض')).toBeOnTheScreen();
});
