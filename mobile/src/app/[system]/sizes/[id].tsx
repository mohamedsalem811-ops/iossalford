import { router, useLocalSearchParams } from 'expo-router';

import { SizePicker } from '@/features/sale/size-picker';
import { useCtx } from '@/state/system-db';

/** /scarves/sizes/<design>: choose the size of a scarf to add to the cart. */
export default function SizesRoute() {
  const ctx = useCtx();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <SizePicker
      key={id}
      ctx={ctx}
      designId={id}
      onDone={() => router.back()}
      onChoose={(p) =>
        router.replace({
          pathname: '/[system]/add/[id]',
          params: { system: ctx.system, id: String(p.id) },
        })
      }
    />
  );
}
