import { ActionSheetIOS } from 'react-native';

import { formatLyd } from '@/lib/money';

import { Card, EmptyState, ListGroup, ListRow, Page, Text } from '@/components';
import {
  LOCK_CHOICES,
  sortedStaff,
  WARN_CHOICES,
  type Employee,
  type LockSettings,
  type Staff,
} from '@/staff/model';

export type StaffActions = {
  onAdd: () => void;
  onResetPin: (e: Employee) => void;
  onRename: (e: Employee) => void;
  onToggleActive: (e: Employee) => void;
  onLock: (lock: LockSettings) => void;
  onEmergencyCode: () => void;
  onSendList: () => void;
  onReceiveList: () => void;
  /** The employee's account: charges for returns and repayments (phase S4). */
  onAccount?: (e: Employee) => void;
};

const minutes = (n: number) => (n === 1 ? 'دقيقة' : n === 2 ? 'دقيقتان' : `${n} دقائق`);

function pick<T>(title: string, items: { label: string; value: T }[], onPick: (v: T) => void) {
  ActionSheetIOS.showActionSheetWithOptions(
    { title, options: [...items.map((i) => i.label), 'إلغاء'], cancelButtonIndex: items.length },
    (i) => items[i] && onPick(items[i].value),
  );
}

/**
 * Management → الموظفون (the owner only): the people who sign in with their own PIN, the
 * automatic lock, the emergency code, and the list for the other device.
 */
export function StaffScreen({
  staff,
  hasEmergencyCode,
  actions,
  balances,
}: {
  staff: Staff;
  hasEmergencyCode: boolean;
  actions: StaffActions;
  /** What each employee owes ("emp-<id>" → dirhams). */
  balances?: Map<string, number>;
}) {
  const people = sortedStaff(staff);
  const lock = staff.lock;
  const menu = (e: Employee) =>
    pick(
      e.name,
      [
        ...(actions.onAccount
          ? [{ label: 'حساب الموظف', value: () => actions.onAccount!(e) }]
          : []),
        { label: 'رمز مؤقت جديد', value: () => actions.onResetPin(e) },
        { label: 'تغيير الاسم', value: () => actions.onRename(e) },
        {
          label: e.active ? 'إيقاف الموظف' : 'تفعيل الموظف',
          value: () => actions.onToggleActive(e),
        },
      ],
      (run) => run(),
    );

  return (
    <Page>
      {people.length === 0 ? (
        <EmptyState
          icon="person.2"
          title="لا يوجد موظفون بعد"
          message="أضف كل موظف باسمه ورمز مؤقت، فيدخل باسمه ويختار رمزه بنفسه."
          action="إضافة موظف"
          onAction={actions.onAdd}
        />
      ) : (
        <ListGroup header="الموظفون">
          {people.map((e) => (
            <ListRow
              key={e.id}
              icon={e.active ? 'person.fill' : 'person.slash'}
              title={e.name}
              subtitle={[e.active ? 'نشط' : 'موقوف', e.mustChangePin ? 'لم يختر رمزه بعد' : null]
                .filter(Boolean)
                .join(' • ')}
              value={
                (balances?.get(`emp-${e.id}`) ?? 0) > 0
                  ? `عليه ${formatLyd(balances!.get(`emp-${e.id}`)!)}`
                  : undefined
              }
              onPress={() => menu(e)}
              testID={`staff-${e.name}`}
            />
          ))}
          <ListRow icon="plus" title="إضافة موظف" onPress={actions.onAdd} testID="staff-add" />
        </ListGroup>
      )}

      <ListGroup
        header="القفل التلقائي للموظف"
        footer="لمسة واحدة في أي مكان تعيد العدّ. الخروج من التطبيق يقفل دائماً.">
        <ListRow
          icon="lock"
          title="يُقفل بعد عدم الاستخدام"
          value={minutes(lock.lockMinutes)}
          onPress={() =>
            pick(
              'يُقفل بعد',
              LOCK_CHOICES.map((m) => ({ label: minutes(m), value: m })),
              (m) => actions.onLock({ ...lock, lockMinutes: m }),
            )
          }
          testID="staff-lock-minutes"
        />
        <ListRow
          icon="bell"
          title="تنبيه صوتي قبل القفل"
          value={minutes(lock.warnMinutes)}
          onPress={() =>
            pick(
              'التنبيه قبل القفل',
              WARN_CHOICES.map((m) => ({ label: minutes(m), value: m })),
              (m) => actions.onLock({ ...lock, warnMinutes: m }),
            )
          }
          testID="staff-warn-minutes"
        />
        <ListRow
          icon="crown"
          title="المالك أيضاً"
          value={lock.ownerToo ? 'نعم' : 'عند الخروج فقط'}
          onPress={() => actions.onLock({ ...lock, ownerToo: !lock.ownerToo })}
          testID="staff-owner-too"
        />
      </ListGroup>

      <ListGroup
        header="رمز الطوارئ للمالك"
        footer="يفتح لك النظام ويختار رمزاً جديداً إن نسيت رمزك. يظهر مرة واحدة: احفظه خارج الجهاز.">
        <ListRow
          icon="key"
          title={hasEmergencyCode ? 'إنشاء رمز طوارئ جديد' : 'إنشاء رمز الطوارئ'}
          value={hasEmergencyCode ? 'محفوظ' : 'غير موجود'}
          onPress={actions.onEmergencyCode}
          testID="staff-emergency"
        />
      </ListGroup>

      <ListGroup
        header="الجهاز الآخر"
        footer="الأسماء فقط، بدون الرموز: يدخل كل موظف أول مرة على الجهاز الآخر بموافقتك ثم يختار رمزه.">
        <ListRow
          icon="square.and.arrow.up"
          title="إرسال القائمة (AirDrop)"
          onPress={actions.onSendList}
          testID="staff-send"
        />
        <ListRow
          icon="square.and.arrow.down"
          title="استلام قائمة"
          onPress={actions.onReceiveList}
          testID="staff-receive"
        />
      </ListGroup>
      {!hasEmergencyCode ? (
        <Card>
          <Text variant="subhead" tone="warning">
            أنشئ رمز الطوارئ واحفظه، حتى لا تُقفل خارج النظام إن نسيت رمزك.
          </Text>
        </Card>
      ) : null}
    </Page>
  );
}
