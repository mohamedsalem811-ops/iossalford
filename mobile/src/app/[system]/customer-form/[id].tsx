import { router, useLocalSearchParams } from 'expo-router';

import { CustomerFormView } from '@/features/customers/customer-form';
import { useCtx } from '@/state/system-db';

/** /jewelry/customer-form/new adds a customer; /jewelry/customer-form/4 edits customer 4. */
export default function CustomerFormRoute() {
  const ctx = useCtx();
  const { id } = useLocalSearchParams<{ id: string }>();
  const customerId = id === 'new' ? undefined : Number(id);
  return (
    <CustomerFormView
      key={id}
      ctx={ctx}
      customerId={Number.isInteger(customerId) ? customerId : undefined}
      onDone={() => router.back()}
    />
  );
}
