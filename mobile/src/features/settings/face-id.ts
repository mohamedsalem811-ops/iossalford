/**
 * The owner's Face ID switch in Settings (audit 1): off until switched on. Switching it on asks
 * for Face ID once, so it is the owner's face that works; every change is logged.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import type { Ctx } from '@/domain/context';
import { recordFaceIdChoice } from '@/domain/settings';
import { faceIdNote, type FaceIdStatus } from '@/security/face-id';
import { askFaceId, deviceFaceId, faceIdSwitchedOn, setFaceIdSwitchedOn } from '@/security/device';

export function useFaceIdSetting(ctx: Ctx) {
  const [on, setOn] = useState(false);
  const [device, setDevice] = useState<FaceIdStatus>('none');
  useEffect(() => {
    let cancelled = false;
    Promise.all([faceIdSwitchedOn(), deviceFaceId()]).then(([o, d]) => {
      if (cancelled) return;
      setOn(o);
      setDevice(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(
    async (next: boolean) => {
      try {
        recordFaceIdChoice(ctx, next);
        await setFaceIdSwitchedOn(next);
        setOn(next);
      } catch (error) {
        Alert.alert('لم يتغير شيء', error instanceof Error ? error.message : 'تعذّر الحفظ');
      }
    },
    [ctx],
  );

  const toggle = useCallback(() => {
    if (on) {
      Alert.alert('إيقاف Face ID؟', 'يُفتح نظام المجوهرات وموافقات المالك برمز المالك فقط.', [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'إيقاف', style: 'destructive', onPress: () => void save(false) },
      ]);
      return;
    }
    if (device !== 'ready') {
      Alert.alert('Face ID', faceIdNote(device) ?? 'هذا الجهاز لا يدعم Face ID.');
      return;
    }
    Alert.alert(
      'تشغيل Face ID؟',
      'كل وجه محفوظ في Face ID على هذا الجهاز يفتح نظام المجوهرات كمالك ويوافق على الخصومات والمرتجعات. شغّله فقط إذا كان وجهك وحده محفوظاً على هذا الجهاز.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تشغيل',
          onPress: async () => {
            const r = await askFaceId();
            if (r.ok) await save(true);
          },
        },
      ],
    );
  }, [on, device, save]);

  return { on, toggle };
}
