# 💎 SALFORD Jewelry POS — 100% Native iOS (Swift & SwiftUI)

مشروع تطبيق iOS أصلي بالكامل (**100% Native Swift 5.9+ & SwiftUI**) لمنظومة **SALFORD Jewelry POS** بدون أي متصفح داخلي (`WKWebView`) أو كود ويب.

---

## ✨ المزايا الهندسية في النسخة الأصلية (100% Native SwiftUI)

1. **ملء الشاشة بالكامل (Edge-to-Edge Safe Area) بدون أي فراغ أسود أعلى أو أسفل الشاشة**:
   - يعتمد التطبيق على `UINavigationBarAppearance` باللون الكحلي الملكي (`#122452`) في الأعلى و`UITabBarAppearance` باللون الكحلي الداكن (`#0B1530`) في الأسفل.
   - يقوم نظام iOS تلقائياً بمد لون الشريط العلوي خلف الساعة والواي فاي والبطارية (Dynamic Island / Notch)، ويمد الشريط السفلي خلف خط الـ Home Indicator، ويقص المحتوى عند التمرير بدقة بينهما.
2. **شاشة دخول أصلية تدعم لوحة مفاتيح الآيفون الرقمية + Face ID**:
   - تعمل بـ `.keyboardType(.numberPad)` مع `LocalAuthentication` للبصمة أو الوجه (Face ID).
   - يُحفظ رمز الدخول في سلسلة المفاتيح الآمنة (Keychain) كبصمة مشفّرة فقط، ولا يُكتب في قاعدة البيانات أو النسخ الاحتياطية.
   - يتوقف الدخول مؤقتاً بعد 5 محاولات خاطئة (30 ثانية ثم تتضاعف المدة)، ويُقفل التطبيق تلقائياً عند الخروج منه.
   - عند أول تشغيل يُطلب منك تغيير الرمز الافتراضي من **الإدارة ← الإعدادات**.
3. **رسوم بيانية أصلية من شركة أبل (`Swift Charts`)**:
   - لوحة التحكم ومقارنة الأشهر تعمل بإطار `import Charts` الأصلي في iOS 16+.
4. **محرك PDF وطباعة AirPrint أصلي (`UIGraphicsPDFRenderer` + `UIPrintInteractionController`)**:
   - يولد ملفات PDF متجهية بمقاس A4 (تنتقل تلقائياً لصفحة جديدة في الفواتير الطويلة) فورية للقوالب الثلاثة (`✨ SALFORD الملكي`، `🤍 SALFORD الرسمي`، و`🦢 Swarovski London Covent Garden`) مع خيار إخفاء السعر (`Price: XXX`) أو إظهار السعر الفعلي، ومشاركتها أو طباعتها لاسلكياً عبر `AirPrint`.

---

## 🚀 طريقة التشغيل والتثبيت على الآيفون

### الطريقة الأولى: عبر جهاز Mac برنامج Xcode (مباشر)
1. حمّل المشروع من GitHub (`Code ← Download ZIP` أو `git clone`).
2. افتح الملف **`SalfordJewelryPOS.xcodeproj`** في أحدث إصدار من برنامج **Xcode**.
3. من قائمة **Signing & Capabilities** اختر حساب Apple ID الخاص بك (Personal Team).
4. وصّل الآيفون واضغط **Run (`⌘R`)** ليتم تثبيت التطبيق الأصلي مباشرة على جهازك.

### الطريقة الثانية: بدون جهاز Mac (عبر GitHub Actions أو Codemagic مجاناً)
- يحتوي المشروع على ملف جاهز `.github/workflows/ios-build.yml` وملف `codemagic.yaml`.
- يعمل البناء تلقائياً عند كل دفع إلى `main` وعند كل طلب دمج (Pull Request)، ويمكن تشغيله يدوياً من تبويب **Actions ← Run workflow**.
- يستخدم الخادم أحدث إصدار مستقر من Xcode، ثم يرفع ملف **`SalfordJewelryPOS-Native-iOS.ipa`** (غير موقّع) لتثبيته على الآيفون عبر AltStore أو Sideloadly.
- للنشر على App Store أو TestFlight يجب توقيع التطبيق بحساب Apple Developer مدفوع.

### رقم الإصدار
- يُعدّل رقم الإصدار ورقم البناء من إعدادات المشروع فقط (`MARKETING_VERSION` و`CURRENT_PROJECT_VERSION`)، وملف `Info.plist` يقرأهما تلقائياً.
