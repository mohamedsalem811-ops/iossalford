import SwiftUI
import UniformTypeIdentifiers

struct SettingsAndBackupView: View {
    @EnvironmentObject var store: POSDataStore
    @State private var currentPin: String = ""
    @State private var newPin: String = ""
    @State private var confirmPin: String = ""
    @State private var pinStatusMsg: String = ""
    @State private var pinStatusIsError: Bool = false
    @State private var showFileImporter: Bool = false
    @State private var statusMsg: String = ""
    @State private var backupURL: URL? = nil

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 10) {
                    ExchangeRateEditor()

                    Divider()

                    VStack(alignment: .leading, spacing: 8) {
                        Text("تغيير رمز الدخول")
                            .font(.system(.footnote, weight: .bold))
                            .foregroundColor(SalfordTheme.silverLight)

                        if store.isUsingDefaultPin {
                            Label("أنت تستخدم الرمز الافتراضي — غيّره الآن لحماية بيانات المحل", systemImage: "exclamationmark.triangle.fill")
                                .font(.system(.footnote, weight: .bold))
                                .foregroundColor(SalfordTheme.warningAmber)
                        }

                        pinField("الرمز الحالي", text: $currentPin)
                        pinField("الرمز الجديد (8 أرقام)", text: $newPin)
                        pinField("تأكيد الرمز الجديد", text: $confirmPin)

                        Button("تحديث الرمز") {
                            updatePin()
                        }
                        .buttonStyle(.salfordPrimary)

                        if !pinStatusMsg.isEmpty {
                            Text(pinStatusMsg)
                                .font(.system(.footnote, weight: .bold))
                                .foregroundColor(pinStatusIsError ? SalfordTheme.dangerRed : SalfordTheme.emeraldSuccess)
                        }
                    }
                }
                .salfordCard()

                VStack(alignment: .leading, spacing: 10) {
                    Text("النسخ الاحتياطي واستعادة قاعدة البيانات")
                        .font(.system(.subheadline, weight: .bold))
                        .foregroundColor(SalfordTheme.silverLight)

                    if let backupURL {
                        ShareLink(item: backupURL, preview: SharePreview(backupURL.lastPathComponent)) {
                            Label("تصدير نسخة احتياطية كاملة إلى الملفات", systemImage: "externaldrive.fill.badge.checkmark")
                        }
                        .buttonStyle(.salfordSecondary)
                    } else {
                        Text("تعذر تجهيز ملف النسخة الاحتياطية — تحقق من مساحة التخزين")
                            .font(.system(.footnote, weight: .bold))
                            .foregroundColor(SalfordTheme.dangerRed)
                    }

                    Button {
                        showFileImporter = true
                    } label: {
                        Label("استيراد نسخة احتياطية محفوظة", systemImage: "square.and.arrow.down.fill")
                    }
                    .buttonStyle(.salfordSecondary)

                    if !statusMsg.isEmpty {
                        Text(statusMsg)
                            .font(.system(.footnote, weight: .bold))
                            .foregroundColor(SalfordTheme.emeraldSuccess)
                    }
                }
                .salfordCard()
            }
            .padding(14)
        }
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("الإعدادات والنسخ الاحتياطي")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            backupURL = store.exportBackupJSON()
        }
        .fileImporter(isPresented: $showFileImporter, allowedContentTypes: [.json]) { result in
            if case .success(let url) = result {
                if store.importBackupJSON(from: url) {
                    statusMsg = "تمت استعادة النسخة الاحتياطية بنجاح"
                    backupURL = store.exportBackupJSON()
                } else {
                    statusMsg = "تعذر قراءة ملف النسخة الاحتياطية"
                }
            }
        }
    }

    private func pinField(_ title: String, text: Binding<String>) -> some View {
        SecureField(title, text: text)
            .keyboardType(.numberPad)
            .salfordField()
            .onChange(of: text.wrappedValue) { newVal in
                let cleaned = String(PinVault.normalize(newVal).prefix(PinVault.pinLength))
                if cleaned != newVal { text.wrappedValue = cleaned }
            }
    }

    private func updatePin() {
        defer {
            currentPin = ""
            newPin = ""
            confirmPin = ""
        }
        guard newPin == confirmPin else {
            pinStatusIsError = true
            pinStatusMsg = "الرمز الجديد وتأكيده غير متطابقين"
            return
        }
        switch store.changePin(current: currentPin, new: newPin) {
        case .success:
            pinStatusIsError = false
            pinStatusMsg = "✅ تم تحديث رمز الدخول بنجاح"
        case .wrongCurrentPin:
            pinStatusIsError = true
            pinStatusMsg = "الرمز الحالي غير صحيح"
        case .invalidNewPin:
            pinStatusIsError = true
            pinStatusMsg = "يرجى إدخال 8 أرقام للرمز الجديد"
        case .sameAsDefault:
            pinStatusIsError = true
            pinStatusMsg = "لا يمكن استخدام الرمز الافتراضي — اختر رمزاً آخر"
        case .keychainError:
            pinStatusIsError = true
            pinStatusMsg = "تعذر حفظ الرمز في سلسلة المفاتيح الآمنة — حاول مرة أخرى"
        }
    }
}


/// Edit the dollar exchange rate: "1 $ = [7.00] د.ل", save, and a confirmation right below.
/// Used in Settings and as a quick sheet from the dashboard.
struct ExchangeRateEditor: View {
    @EnvironmentObject var store: POSDataStore
    var onSaved: (() -> Void)? = nil

    @State private var rateText: String = ""
    @State private var message: String = ""
    @State private var isError: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: SalfordSpacing.s) {
            SalfordSectionTitle(title: "سعر صرف الدولار", icon: "dollarsign.circle.fill")
            HStack(spacing: SalfordSpacing.s) {
                Text("1 $ =")
                    .font(.system(.body, weight: .semibold))
                    .foregroundColor(SalfordTheme.textPrimary)
                TextField("7.00", text: $rateText)
                    .numericInput($rateText, .decimal)
                    .multilineTextAlignment(.center)
                    .salfordField()
                    .frame(maxWidth: 140)
                    .accessibilityLabel("سعر الدولار بالدينار")
                Text("د.ل")
                    .font(.system(.body, weight: .semibold))
                    .foregroundColor(SalfordTheme.textMuted)
                Spacer(minLength: 0)
            }
            // Digits and the "1 $ =" line read left-to-right, like the number itself.
            .environment(\.layoutDirection, .leftToRight)

            Button {
                save()
            } label: {
                Label("حفظ السعر", systemImage: "checkmark.circle.fill")
            }
            .buttonStyle(.salfordSuccess)

            if !message.isEmpty {
                Label(message, systemImage: isError ? "exclamationmark.circle.fill" : "checkmark.circle.fill")
                    .font(.system(.footnote, weight: .bold))
                    .foregroundColor(isError ? SalfordTheme.dangerRed : SalfordTheme.emeraldSuccess)
            }
        }
        .onAppear {
            rateText = String(format: "%.2f", store.exchangeRate)
        }
    }

    private func save() {
        guard let r = NumberInput.decimal(rateText), r > 0, r < 1000 else {
            isError = true
            message = "أدخل سعراً صحيحاً، مثال: 7.25"
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            return
        }
        let rate = (r * 10_000).rounded() / 10_000
        store.exchangeRate = rate
        store.saveToDisk()
        rateText = String(format: "%.2f", rate)
        isError = false
        message = "تم الحفظ: 1 $ = \(NumberInput.editable(rate)) د.ل"
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        onSaved?()
    }
}
