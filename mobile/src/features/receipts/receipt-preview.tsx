import { useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

import { PAGE, receiptHtml, type ReceiptDoc } from '@/receipts/templates/html';
import { radius, useTheme } from '@/theme';

/** The receipt as it will print: the first A4 page, scaled to the width; scroll for more. */
export function ReceiptPreview({ doc }: { doc: ReceiptDoc }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityLabel="معاينة الإيصال كما سيُطبع"
      style={{
        height: width ? (width * PAGE.height) / PAGE.width : 400,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.separator,
        backgroundColor: '#fff',
      }}>
      {width ? (
        <WebView
          testID="receipt-preview"
          originWhitelist={['*']}
          source={{ html: receiptHtml(doc) }}
          style={{ backgroundColor: '#fff' }}
          scrollEnabled
          bounces={false}
          showsVerticalScrollIndicator
          // The page is 595 points wide; the viewport scales it to fit.
          automaticallyAdjustContentInsets={false}
        />
      ) : null}
    </View>
  );
}
