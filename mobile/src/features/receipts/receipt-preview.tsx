import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

import { TEMPLATES } from '@/domain/receipts';
import { logoFontCss } from '@/receipts/fonts';
import { PAGE, receiptHtml, type ReceiptDoc } from '@/receipts/templates/html';
import { radius, useTheme } from '@/theme';

/** The receipt as it is shared: the first A4 page, filling the width; scroll for more. */
export function ReceiptPreview({ doc }: { doc: ReceiptDoc }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  // The logo fonts, embedded as in the PDF (read once; the preview shows a fallback until then).
  const system = TEMPLATES[doc.template].system;
  const [fontCss, setFontCss] = useState<{ system: string; css: string } | null>(null);
  useEffect(() => {
    let live = true;
    logoFontCss(system).then((css) => live && setFontCss({ system, css }));
    return () => {
      live = false;
    };
  }, [system]);
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
          source={{
            html: receiptHtml(doc, {
              previewWidth: width,
              fontCss: fontCss?.system === system ? fontCss.css : '',
            }),
          }}
          style={{ backgroundColor: '#fff' }}
          scrollEnabled
          bounces={false}
          showsVerticalScrollIndicator
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
        />
      ) : null}
    </View>
  );
}
