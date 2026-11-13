import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { Icon, Text } from '@/components';
import { countdown } from '@/screens/login';
import { radius, spacing, useTheme } from '@/theme';

import { idlePhase, type LockSettings } from './model';
import { playLockWarning } from './warning-sound';

/**
 * Locks after `lockMinutes` without a touch. `warnMinutes` before, a distinctive sound, a
 * vibration and a countdown banner (and the sound again with one minute left); one touch anywhere
 * resets it. Off for the owner unless chosen. Leaving the app still locks at once (state/lock).
 */
export function IdleLock({
  enabled,
  lock,
  onLock,
  now = Date.now,
  children,
}: {
  enabled: boolean;
  lock: Pick<LockSettings, 'lockMinutes' | 'warnMinutes'>;
  onLock: () => void;
  now?: () => number;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const last = useRef(now());
  const warned = useRef<'none' | 'first' | 'minute'>('none');
  const [left, setLeft] = useState<number | null>(null);

  const touched = useCallback(() => {
    last.current = now();
    warned.current = 'none';
    setLeft(null);
  }, [now]);

  useEffect(() => {
    if (!enabled) return;
    // A fresh count each time the lock is switched on (a new sign-in).
    last.current = now();
    warned.current = 'none';
    const id = setInterval(() => {
      const p = idlePhase(now() - last.current, lock);
      if (p.phase === 'lock') {
        clearInterval(id);
        onLock();
        return;
      }
      if (p.phase === 'warn') {
        if (warned.current === 'none') {
          warned.current = 'first';
          playLockWarning();
        } else if (warned.current === 'first' && p.leftMs <= 60_000) {
          warned.current = 'minute';
          playLockWarning();
        }
        setLeft(p.leftMs);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [enabled, lock, onLock, now, touched]);

  return (
    <View style={{ flex: 1 }} onTouchStart={enabled ? touched : undefined}>
      {children}
      {enabled && left !== null ? (
        <View
          accessibilityLiveRegion="assertive"
          accessibilityLabel={`سيُقفل الحساب بعد ${countdown(left)}، المس الشاشة للمتابعة`}
          testID="idle-warning"
          style={{
            position: 'absolute',
            top: 56,
            left: spacing.md,
            right: spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: radius.lg,
            backgroundColor: colors.negative,
            boxShadow: colors.floatingShadow,
          }}>
          <Icon name="lock.badge.clock" size={26} color="#FFFFFF" />
          <View style={{ flex: 1 }}>
            <Text variant="headline" style={{ color: '#FFFFFF' }}>
              {`سيُقفل الحساب بعد ${countdown(left)}`}
            </Text>
            <Text variant="subhead" style={{ color: '#FFFFFF' }}>
              المس الشاشة للمتابعة
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
