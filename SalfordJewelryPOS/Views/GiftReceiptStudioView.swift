import SwiftUI

struct GiftReceiptStudioView: View {
    @EnvironmentObject var store: POSDataStore
    var isModalSheet: Bool = false
    @Environment(\.dismiss) private var dismiss
    @State private var shareURL: URL? = nil
    @State private var errorMessage: String? = nil
    @State private var savedMessage: String = ""

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                // Template & Price Mode Controls
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Image(systemName: "wand.and.stars")
                            .foregroundColor(SalfordTheme.silverAccent)
                        Text("تخصيص قالب الفاتورة والأسعار")
                            .font(.system(.subheadline, weight: .bold))
                            .foregroundColor(SalfordTheme.silverLight)
                        Spacer()
                    }

                    Picker("قالب الفاتورة", selection: $store.activeReceiptTemplate) {
                        ForEach(ReceiptTemplate.allCases) { tpl in
                            Text(tpl.title).tag(tpl)
                        }
                    }
                    .pickerStyle(.segmented)

                    Toggle(isOn: $store.showRealPricesInReceipt) {
                        Text(store.showRealPricesInReceipt ? "إظهار الأسعار الفعلية (فاتورة رسمية)" : "إخفاء الأسعار (Price: XXX — فاتورة هدية)")
                            .font(.system(.footnote, weight: .bold))
                            .foregroundColor(SalfordTheme.silverLight)
                    }
                    .tint(SalfordTheme.emeraldSuccess)

                    HStack(spacing: 10) {
                        // The number is assigned by the app and can't be typed, so it is always unique.
                        HStack(spacing: 6) {
                            Image(systemName: "number")
                                .foregroundColor(SalfordTheme.silverAccent)
                            Text(store.activeReceiptNo.isEmpty ? "رقم جديد عند الحفظ" : store.activeReceiptNo)
                                .font(.system(.footnote, design: .monospaced, weight: .bold))
                                .foregroundColor(store.activeReceiptNo.isEmpty ? SalfordTheme.textMuted : SalfordTheme.textPrimary)
                        }
                        .padding(9)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(SalfordTheme.bgElevated)
                        .cornerRadius(9)

                        TextField("اسم الزبون", text: $store.activeReceiptCustomer)
                            .salfordField()
                    }

                    if store.activeReceiptItems.isEmpty {
                        Text("لا توجد قطع في الفاتورة — أضف سطراً أدناه")
                            .font(.system(.footnote))
                            .foregroundColor(SalfordTheme.textMuted)
                    }

                    // Line Items Editor
                    ForEach($store.activeReceiptItems) { $item in
                        ReceiptLineEditorRow(item: $item) {
                            store.activeReceiptItems.removeAll { $0.id == item.id }
                        }
                    }

                    HStack {
                        Button {
                            store.activeReceiptItems.append(
                                ReceiptLineItem(name: "", color: "", code: "", qty: 1, price: 0)
                            )
                        } label: {
                            Label("إضافة سطر منتج للفاتورة", systemImage: "plus.circle")
                                .font(.system(.footnote, weight: .bold))
                                .foregroundColor(SalfordTheme.silverAccent)
                        }
                        Spacer()
                        Button {
                            if let no = store.commitActiveReceipt() {
                                savedMessage = "✅ تم حفظ الفاتورة \(no)"
                                UINotificationFeedbackGenerator().notificationOccurred(.success)
                            } else {
                                errorMessage = "أضف قطعة واحدة على الأقل باسم واضح قبل الحفظ"
                            }
                        } label: {
                            Label("حفظ الفاتورة", systemImage: "tray.and.arrow.down.fill")
                                .font(.system(.footnote, weight: .bold))
                                .foregroundColor(SalfordTheme.emeraldSuccess)
                        }
                    }

                    if !savedMessage.isEmpty {
                        Text(savedMessage)
                            .font(.system(.footnote, weight: .bold))
                            .foregroundColor(SalfordTheme.emeraldSuccess)
                    }
                }
                .salfordCard()

                // Action Buttons: Native PDF Export, Share & AirPrint.
                // The receipt is saved (and numbered) before any PDF leaves the app.
                HStack(spacing: 10) {
                    Button {
                        if let url = saveAndBuildPDF() {
                            if !NativePDFGenerator.printPDF(url: url, jobName: "SALFORD Receipt \(store.activeReceiptNo)") {
                                errorMessage = "تعذرت طباعة الملف — جرّب «تصدير ومشاركة PDF» ثم اطبع من تطبيق الملفات"
                            }
                        }
                    } label: {
                        Label("طباعة AirPrint", systemImage: "printer.fill")
                    }
                    .buttonStyle(.salfordSecondary)

                    Button {
                        shareURL = saveAndBuildPDF()
                    } label: {
                        Label("تصدير ومشاركة PDF", systemImage: "square.and.arrow.up.fill")
                    }
                    .buttonStyle(.salfordPrimary)
                }

                // Live Interactive Paper Preview matching Invoice swarovski.pdf & SALFORD Royal
                VStack(spacing: 0) {
                    if store.activeReceiptTemplate == .salfordRoyal {
                        VStack(spacing: 4) {
                            Text("SJ")
                                .font(.system(size: 34, weight: .black, design: .serif))
                                .foregroundColor(.white)
                            Text("SALFORD")
                                .font(.system(size: 16, weight: .bold, design: .serif))
                                .kerning(5)
                                .foregroundColor(.white)
                            Text("jewelry")
                                .font(.system(size: 9, weight: .medium))
                                .kerning(4)
                                .foregroundColor(Color(red: 200/255, green: 216/255, blue: 240/255))
                            Text("✦ FINE JEWELRY & LUXURY CREATIONS • TRIPOLI, LIBYA ✦")
                                .font(.system(size: 8.5, weight: .semibold))
                                .foregroundColor(Color(red: 200/255, green: 216/255, blue: 240/255))
                                .padding(.top, 2)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 18)
                        .background(
                            LinearGradient(
                                colors: [Color(red: 0.17, green: 0.10, blue: 0.33), Color(red: 0.04, green: 0.04, blue: 0.09)],
                                startPoint: .topTrailing,
                                endPoint: .bottomLeading
                            )
                        )
                    } else if store.activeReceiptTemplate == .salfordWhite {
                        VStack(spacing: 3) {
                            Text("SJ")
                                .font(.system(size: 32, weight: .black, design: .serif))
                                .foregroundColor(.black)
                            Text("SALFORD JEWELRY — LIBYA")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(.black)
                        }
                        .padding(.top, 20)
                    } else {
                        VStack(spacing: 2) {
                            Text("SWAROVSKI")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(.black)
                            Text("London – Covent Garden")
                                .font(.system(size: 10.5))
                                .foregroundColor(.black)
                            Text("20–21 James Street, Covent Garden")
                                .font(.system(size: 10.5))
                                .foregroundColor(.black)
                            Text("London, WC2E 8NS")
                                .font(.system(size: 10.5))
                                .foregroundColor(.black)
                            Text("Tel: +44 20 7946 0000")
                                .font(.system(size: 10.5))
                                .foregroundColor(.black)
                        }
                        .padding(.top, 20)
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        Text(store.showRealPricesInReceipt ? "OFFICIAL INVOICE / RECEIPT" : "GIFT RECEIPT")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.black)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.vertical, 6)

                        VStack(alignment: .leading, spacing: 4) {
                            Text("Date: \(store.activeReceiptDate)")
                            Text("Time: \(store.activeReceiptTime)")
                            Text("Receipt No: \(store.activeReceiptNo)")
                            Text("Store: \(store.activeReceiptTemplate == .swarovskiLondon ? "Swarovski London" : "SALFORD Jewelry — Libya")")
                        }
                        .font(.system(size: 11))
                        .foregroundColor(.black)

                        Divider().background(Color.black)

                        ForEach(store.activeReceiptItems) { item in
                            VStack(alignment: .leading, spacing: 3) {
                                HStack {
                                    Text(item.fullTitle)
                                        .font(.system(size: 11, weight: .bold))
                                        .foregroundColor(.black)
                                    Spacer()
                                    Text("Qty: \(item.qty)")
                                        .font(.system(size: 11))
                                        .foregroundColor(.black)
                                    Text(store.showRealPricesInReceipt ? String(format: "%@ LYD", Money.plain(item.price * Double(item.qty))) : "XXX")
                                        .font(.system(size: 11, weight: .bold))
                                        .foregroundColor(.black)
                                        .frame(width: 65, alignment: .trailing)
                                }
                                Text("Item Code: \(item.code)")
                                    .font(.system(size: 10))
                                    .foregroundColor(.gray)
                            }
                            .padding(.vertical, 4)
                            Divider()
                        }

                        HStack {
                            Text("Total")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.black)
                            Spacer()
                            let grandTotal = store.activeReceiptItems.reduce(0.0) { $0 + ($1.price * Double($1.qty)) }
                            Text(store.showRealPricesInReceipt ? String(format: "%@ LYD", Money.plain(grandTotal)) : "XXX")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.black)
                        }
                        .padding(.vertical, 4)

                        Text("Customer: \(store.activeReceiptCustomer)")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(.black)
                            .padding(.top, 4)

                        Text("This is a gift receipt. Original receipt is required for returns or exchanges.\nReturns are subject to store policy.")
                            .font(.system(size: 9.5))
                            .foregroundColor(.gray)
                            .padding(.top, 4)
                    }
                    .padding(20)
                    .environment(\.layoutDirection, .leftToRight)
                }
                .background(Color.white)
                .cornerRadius(14)
                .shadow(color: .black.opacity(0.4), radius: 10, x: 0, y: 4)
            }
            .padding(14)
        }
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("استوديو الفاتورة الملكية")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if isModalSheet {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("إغلاق") {
                        dismiss()
                    }
                    .foregroundColor(SalfordTheme.silverLight)
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    store.openNewDraftReceipt(items: [], present: isModalSheet)
                    savedMessage = ""
                } label: {
                    Label("فاتورة جديدة", systemImage: "doc.badge.plus")
                }
                .foregroundColor(SalfordTheme.silverLight)
            }
        }
        .onAppear {
            // Nothing loaded yet (first visit to the tab): start an empty draft — never fake items.
            if store.activeReceiptDate.isEmpty {
                store.openNewDraftReceipt(items: [], present: false)
            }
        }
        .sheet(isPresented: Binding(get: { shareURL != nil }, set: { if !$0 { shareURL = nil } })) {
            if let url = shareURL {
                ActivityShareSheet(items: [url])
            }
        }
        .alert("تنبيه", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("حسناً", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    /// Saves the receipt first (a draft gets its number now), then renders the PDF.
    private func saveAndBuildPDF() -> URL? {
        guard store.commitActiveReceipt() != nil else {
            errorMessage = "أضف قطعة واحدة على الأقل باسم واضح قبل الطباعة أو المشاركة"
            return nil
        }
        savedMessage = "✅ تم حفظ الفاتورة \(store.activeReceiptNo)"
        guard let url = NativePDFGenerator.generateGiftReceiptPDF(
            template: store.activeReceiptTemplate,
            showRealPrices: store.showRealPricesInReceipt,
            receiptNo: store.activeReceiptNo,
            dateStr: store.activeReceiptDate,
            timeStr: store.activeReceiptTime,
            customer: store.activeReceiptCustomer,
            items: store.activeReceiptItems
        ) else {
            errorMessage = "تعذر إنشاء ملف PDF — تأكد من توفر مساحة على الجهاز"
            return nil
        }
        return url
    }
}

/// Edits one receipt line: name, colour, code, quantity and price.
struct ReceiptLineEditorRow: View {
    @Binding var item: ReceiptLineItem
    var onDelete: () -> Void
    @State private var priceText: String = ""

    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                TextField("اسم القطعة", text: $item.name)
                    .font(.system(.footnote))
                    .salfordField()

                TextField("اللون", text: $item.color)
                    .font(.system(.footnote))
                    .frame(width: 85)
                    .salfordField()

                TextField("الكود", text: $item.code)
                    .font(.system(.footnote))
                    .frame(width: 90)
                    .salfordField()
            }
            HStack(spacing: 8) {
                Stepper("الكمية: \(item.qty)", value: $item.qty, in: 1...99)
                    .font(.system(.footnote, weight: .bold))
                    .foregroundColor(SalfordTheme.textPrimary)

                TextField("السعر", text: $priceText)
                    .numericInput($priceText, .decimal)
                    .font(.system(.footnote))
                    .frame(width: 90)
                    .salfordField()
                    .onChange(of: priceText) { newValue in
                        item.price = NumberInput.decimal(newValue) ?? 0
                    }

                Button(role: .destructive) {
                    onDelete()
                } label: {
                    Image(systemName: "trash.fill")
                        .font(.system(.footnote))
                        .padding(7)
                        .background(SalfordTheme.dangerRed.opacity(0.18))
                        .foregroundColor(SalfordTheme.dangerRed)
                        .cornerRadius(8)
                }
            }
        }
        .padding(8)
        .background(SalfordTheme.bgPrimary.opacity(0.4))
        .cornerRadius(10)
        .onAppear {
            priceText = item.price > 0 ? NumberInput.editable(item.price) : ""
        }
    }
}

/// System share sheet (Files, WhatsApp, Mail…) for a file that is created on demand.
struct ActivityShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
