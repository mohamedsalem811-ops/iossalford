import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';

import { EmptyState } from '@/components';

import type { Permission } from './permissions';
import { useCan } from './use-can';

/**
 * Guards a whole screen: someone without the permission sees "للمالك فقط" instead, even when the
 * screen is opened from a link or a keyboard shortcut. The screen's content is never rendered,
 * so none of its data is read.
 */
export function Allowed({
  permission,
  title,
  children,
}: {
  permission: Permission;
  /** The screen's title, kept in the header when it is refused. */
  title?: string;
  children: ReactNode;
}) {
  if (!useCan(permission))
    return (
      <View testID="owner-only">
        {title ? <Stack.Title>{title}</Stack.Title> : null}
        <EmptyState icon="lock" title="للمالك فقط" message="هذه الشاشة يفتحها المالك وحده." />
      </View>
    );
  return <>{children}</>;
}
