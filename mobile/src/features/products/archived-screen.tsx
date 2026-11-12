import { Alert } from 'react-native';

import { EmptyState, ListGroup, ListRow, Page, Text } from '@/components';
import type { Ctx } from '@/domain/context';
import { displayName, restoreProduct, type Product } from '@/domain/products';
import { haptic } from '@/lib/haptics';
import { formatLyd } from '@/lib/money';
import { notifyDataChanged } from '@/state/data-events';

import { productDetails } from './model';

/**
 * Pieces deleted after they were sold: kept, out of every list, so their sales, receipts and
 * reports stay right. One can be brought back (with the stock it had), for example a piece that
 * came back in.
 */
export function ArchivedScreen({ ctx, products }: { ctx: Ctx; products: Product[] }) {
  const bringBack = (p: Product) =>
    Alert.alert(`إعادة «${displayName(ctx, p)}»؟`, 'تعود القطعة إلى المنتجات وشاشة البيع.', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'إعادة',
        onPress: () => {
          restoreProduct(ctx, p.id);
          haptic.success();
          notifyDataChanged();
        },
      },
    ]);

  if (products.length === 0)
    return (
      <EmptyState
        icon="archivebox"
        title="لا توجد قطع مؤرشفة"
        message="القطعة التي بيعت ثم حُذفت تُحفظ هنا، لتبقى مبيعاتها وإيصالاتها كما هي."
      />
    );
  return (
    <Page>
      <Text variant="subhead" tone="secondary">
        اضغط على قطعة لإعادتها إلى المنتجات.
      </Text>
      <ListGroup>
        {products.map((p) => (
          <ListRow
            key={p.id}
            icon="arrow.uturn.backward"
            title={displayName(ctx, p)}
            subtitle={productDetails(p)}
            value={formatLyd(p.price)}
            onPress={() => bringBack(p)}
            testID={`archived-${p.sku}`}
          />
        ))}
      </ListGroup>
    </Page>
  );
}
