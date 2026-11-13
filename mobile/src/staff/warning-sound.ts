/**
 * The auto-lock warning: a short rising chime unlike any iPhone sound, played even when the
 * device is on silent, with a vibration. If sound can't play (no audio, tests), the vibration and
 * the on-screen countdown still warn.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Vibration } from 'react-native';

import { haptic } from '@/lib/haptics';

let player: AudioPlayer | null = null;

export function playLockWarning() {
  Vibration.vibrate([0, 400, 150, 400]);
  haptic.error();
  try {
    if (!player) {
      setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(
        () => {},
      );
      player = createAudioPlayer(require('../../assets/sounds/lock-warning.wav'));
    }
    player.seekTo(0).catch(() => {});
    player.play();
  } catch {
    // The vibration and the banner still warn.
  }
}
