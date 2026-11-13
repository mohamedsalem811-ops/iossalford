/**
 * The owner's staff actions: each one checks first, then writes the PIN (Keychain) before the
 * list (staff.json), so a person is never listed without a PIN they were given. Messages are
 * Arabic and nothing changes when something is refused.
 */
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

import { haptic } from '@/lib/haptics';
import { pinVault } from '@/security/device';
import { EMPLOYEE_PIN_LENGTH, pinProblem } from '@/security/pin';
import {
  addEmployee,
  mergeTransfer,
  nameProblem,
  renameEmployee,
  setActive,
  setMustChangePin,
  transferText,
  type Employee,
  type LockSettings,
} from '@/staff/model';
import { logStaffChange } from '@/staff/guards';
import { getStaff, saveStaff } from '@/staff/store';

const refuse = (message: string) => {
  haptic.error();
  Alert.alert('لم يتم الحفظ', message, [{ text: 'حسناً' }]);
};

/** Asks for a temporary PIN for someone, then runs `save` with it (nothing if cancelled). */
function askTemporaryPin(name: string, save: (pin: string) => Promise<void>) {
  Alert.prompt(
    `رمز مؤقت لـ ${name}`,
    `${EMPLOYEE_PIN_LENGTH} أرقام. يُغيّره ${name} عند أول دخول.`,
    [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حفظ',
        onPress: (pin?: string) => {
          const problem = pinProblem(pin ?? '', EMPLOYEE_PIN_LENGTH);
          if (problem) return refuse(problem);
          save(pin!).catch(() => refuse('تعذّر حفظ الرمز، لم يتغير شيء'));
        },
      },
    ],
    'secure-text',
    '',
    'number-pad',
  );
}

export function addEmployeeFlow() {
  Alert.prompt('موظف جديد', 'اسم الموظف كما يظهر عند الدخول وفي المبيعات.', [
    { text: 'إلغاء', style: 'cancel' },
    {
      text: 'التالي',
      onPress: (name?: string) => {
        const problem = nameProblem(getStaff(), name ?? '');
        if (problem) return refuse(problem);
        const id = Crypto.randomUUID();
        askTemporaryPin(name!.trim(), async (pin) => {
          await pinVault.setPin(`user.${id}`, pin);
          saveStaff(addEmployee(getStaff(), name!, id, new Date()));
          logStaffChange(`موظف جديد: ${name!.trim()}`, { id });
          haptic.success();
        });
      },
    },
  ]);
}

export function resetPinFlow(e: Employee) {
  askTemporaryPin(e.name, async (pin) => {
    await pinVault.setPin(`user.${e.id}`, pin);
    saveStaff(setMustChangePin(getStaff(), e.id, true));
    logStaffChange(`رمز مؤقت جديد لـ ${e.name}`, { id: e.id });
    haptic.success();
  });
}

export function renameFlow(e: Employee) {
  Alert.prompt(
    'تغيير الاسم',
    'المبيعات السابقة تبقى بالاسم الذي سُجّلت به.',
    [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حفظ',
        onPress: (name?: string) => {
          try {
            saveStaff(renameEmployee(getStaff(), e.id, name ?? ''));
            logStaffChange(`تغيير اسم ${e.name} إلى ${(name ?? '').trim()}`, { id: e.id });
            haptic.success();
          } catch (error) {
            refuse(error instanceof Error ? error.message : 'تعذّر الحفظ');
          }
        },
      },
    ],
    'plain-text',
    e.name,
  );
}

export function toggleActiveFlow(e: Employee) {
  if (!e.active) {
    saveStaff(setActive(getStaff(), e.id, true));
    logStaffChange(`تفعيل ${e.name}`, { id: e.id });
    haptic.success();
    return;
  }
  Alert.alert(
    `إيقاف ${e.name}؟`,
    'لا يظهر عند الدخول ولا يستطيع فتح النظام. تبقى مبيعاته باسمه، ويمكن تفعيله لاحقاً.',
    [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'إيقاف',
        style: 'destructive',
        onPress: () => {
          saveStaff(setActive(getStaff(), e.id, false));
          logStaffChange(`إيقاف ${e.name}`, { id: e.id });
          haptic.success();
        },
      },
    ],
  );
}

export function saveLock(lock: LockSettings) {
  saveStaff({ ...getStaff(), lock });
  logStaffChange('تغيير إعدادات القفل التلقائي', lock as unknown as Record<string, unknown>);
  haptic.tap();
}

/** A new emergency code, shown once. */
export function emergencyCodeFlow(hasOne: boolean, onMade: () => void) {
  Alert.alert(
    hasOne ? 'رمز طوارئ جديد؟' : 'رمز الطوارئ',
    `${hasOne ? 'الرمز القديم يتوقف عن العمل. ' : ''}يظهر الرمز مرة واحدة فقط: اكتبه واحفظه خارج الجهاز (ورقة في مكان آمن). يفتح لك النظام إن نسيت رمزك.`,
    [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'إنشاء الرمز',
        onPress: async () => {
          try {
            const code = await pinVault.newEmergencyCode();
            logStaffChange('رمز طوارئ جديد');
            onMade();
            Alert.alert('رمز الطوارئ', `${code}\n\nاكتبه الآن، لن يظهر مرة أخرى.`, [
              { text: 'كتبته' },
            ]);
          } catch {
            refuse('تعذّر إنشاء الرمز');
          }
        },
      },
    ],
  );
}

/** Sends the list (names only, no PINs) through the share sheet: AirDrop to the other device. */
export async function sendStaffList() {
  const file = new File(Paths.cache, 'SALFORD-staff.json');
  if (file.exists) file.delete();
  file.writeSync(transferText(getStaff()));
  try {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'قائمة الموظفين',
    });
  } finally {
    if (file.exists) file.delete();
  }
}

/** Adds the people of a list received from the other device (each chooses a PIN here). */
export async function receiveStaffList() {
  const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (r.canceled || !r.assets[0]) return;
  try {
    const text = await new File(r.assets[0].uri).text();
    const { staff, added } = mergeTransfer(getStaff(), text, new Date());
    saveStaff(staff);
    if (added) logStaffChange(`استلام قائمة الموظفين: أُضيف ${added}`);
    haptic.success();
    Alert.alert(
      'تم استلام القائمة',
      added
        ? `أُضيف ${added} موظف. يدخل كل واحد أول مرة بموافقتك، ثم يختار رمزه.`
        : 'كل الموظفين في القائمة موجودون على هذا الجهاز.',
    );
  } catch (error) {
    refuse(error instanceof Error ? error.message : 'تعذّر قراءة الملف');
  }
}
