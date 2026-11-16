import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, EmptyState, Page, Text, TextField } from '@/components';
import { errorBoundary } from '@/components/error-screen';
import { waLink } from '@/domain/customer-care';
import { lastMessage, recordMessage } from '@/domain/messages';
import { clearQueue, getQueue } from '@/features/marketing/send-queue';
import { showError } from '@/features/products/actions';
import { haptic } from '@/lib/haptics';
import { notifyDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { openOutside } from '@/state/lock';
import { Allowed } from '@/staff/allowed';
import { spacing } from '@/theme';

/**
 * The step-by-step sender (I4): one customer at a time, "n من N", the message ready to change,
 * «فتح واتساب» (remembered, then WhatsApp opens, then the next one) or «تخطي». SALFORD never
 * sends anything itself; WhatsApp does, one message at a time.
 */
function SendScreen() {
  const ctx = useCtx();
  const [{ messages, title }] = useState(getQueue);
  const [at, setAt] = useState(0);
  const [sent, setSent] = useState(0);
  const [text, setText] = useState(messages[0]?.text ?? '');
  const current = messages[at];

  const next = () => {
    const n = at + 1;
    setAt(n);
    setText(messages[n]?.text ?? '');
  };
  const open = () => {
    if (!current) return;
    const link = waLink(current.phone, text);
    if (!link) return next();
    try {
      recordMessage(ctx, { customerId: current.customerId, kind: current.kind, ref: current.ref });
    } catch (error) {
      showError(error);
      return;
    }
    haptic.tap();
    notifyDataChanged();
    setSent((s) => s + 1);
    openOutside(link);
    next();
  };
  const close = () => {
    clearQueue();
    router.back();
  };

  return (
    <>
      <Stack.Title>{title || 'إرسال الرسائل'}</Stack.Title>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button onPress={close}>إغلاق</Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Page keyboard>
        {!messages.length ? (
          <EmptyState icon="message" title="لا رسائل للإرسال" />
        ) : current ? (
          <Card testID="send-card">
            <Text variant="subhead" tone="secondary" testID="send-count">
              {`${at + 1} من ${messages.length}`}
            </Text>
            <Text variant="title" testID="send-name">
              {current.name}
            </Text>
            {lastMessage(ctx, current.customerId, current.kind, current.ref) ? (
              <Text variant="caption" tone="warning" testID="send-before">
                أُرسلت هذه الرسالة لهذا الزبون من قبل
              </Text>
            ) : null}
            <TextField
              label="الرسالة"
              value={text}
              onChangeText={setText}
              multiline
              maxLength={1000}
              testID="send-text"
            />
            <View style={{ gap: spacing.sm }}>
              <Button
                title="فتح واتساب"
                icon="paperplane.fill"
                size="lg"
                fullWidth
                onPress={open}
                testID="send-open"
              />
              <Button
                title="تخطي"
                variant="secondary"
                fullWidth
                onPress={next}
                testID="send-skip"
              />
            </View>
          </Card>
        ) : (
          <Card testID="send-done">
            <Text variant="headline">{`انتهت القائمة: فُتحت ${sent} من ${messages.length} رسالة`}</Text>
            <Text variant="caption" tone="secondary">
              تأكد من الضغط على «إرسال» في واتساب لكل رسالة.
            </Text>
            <Button title="إغلاق" fullWidth onPress={close} testID="send-close" />
          </Card>
        )}
      </Page>
    </>
  );
}

/** Whoever sees the customers' numbers (`customers.phones`). */
export default function SendRoute() {
  return (
    <Allowed permission="customers.phones" title="إرسال الرسائل">
      <SendScreen />
    </Allowed>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('send');
