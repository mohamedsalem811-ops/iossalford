import { Redirect } from 'expo-router';

import { Gallery } from '@/screens/gallery';

/**
 * The design gallery, in test builds only (1.9): the simulator build sets
 * EXPO_PUBLIC_TEST_SCREENS=1 (read when the app is built). In the owner's app its link opens the
 * start screen.
 */
export default function GalleryRoute() {
  if (process.env.EXPO_PUBLIC_TEST_SCREENS !== '1') return <Redirect href="/" />;
  return <Gallery />;
}
