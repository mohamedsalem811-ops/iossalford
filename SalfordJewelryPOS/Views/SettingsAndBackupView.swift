import SwiftUI
import UniformTypeIdentifiers

struct SettingsAndBackupView: View {
    @EnvironmentObject var store: POSDataStore
    @State private var rateText: String = ""
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
                    Text("سعر صرف الدولار ورمز الدخول")
                        .font(.system(.subheadline, weight: .bold))
                        .foregroundColor(SalfordTheme.silverLight)

                    HStack {
                        TextField("سعر الصرف بالدينار", text: $rateText)
                            .numericInput($rateText, .decimal)
                            .padding(10)
                            .background(SalfordTheme.bgElevated)
                            .foregroundColor(SalfordTheme.textPrimary)
                            .cornerRadius(10)
                        Button("حفظ السعر") {
                            if let r = NumberInput.decimal(rateText), r > 0 {
                                store.exchangeRate = r
                                store.saveToDisk()
                                statusMsg = "تم تحديث سعر الصرف بنجاح"
                            }
                        }
                        .font(.system(.footnote, weight: .bold))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(SalfordTheme.emeraldSuccess)
                        .foregroundColor(SalfordTheme.onColored)
                        .cornerRadius(10)
                    }

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
                        .font(.system(.footnote, weight: .bold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(SalfordTheme.silverGradient)
                        .foregroundColor(SalfordTheme.onPrimary)
                        .cornerRadius(10)

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
                                .font(.system(.subheadline, weight: .bold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(SalfordTheme.royalNavyMid)
                                .foregroundColor(SalfordTheme.textPrimary)
                                .cornerRadius(11)
                        }
                    } else {
                        Text("تعذر تجهيز ملف النسخة الاحتياطية — تحقق من مساحة التخزين")
                            .font(.system(.footnote, weight: .bold))
                            .foregroundColor(SalfordTheme.dangerRed)
                    }

                    Button {
                        showFileImporter = true
                    } label: {
                        Label("استيراد نسخة احتياطية محفوظة", systemImage: "square.and.arrow.down.fill")
                            .font(.system(.subheadline, weight: .bold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(SalfordTheme.bgElevated)
                            .foregroundColor(SalfordTheme.silverLight)
                            .cornerRadius(11)
                    }

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
            rateText = NumberInput.editable(store.exchangeRate)
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
            .padding(10)
            .background(SalfordTheme.bgElevated)
            .foregroundColor(SalfordTheme.textPrimary)
            .cornerRadius(10)
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
