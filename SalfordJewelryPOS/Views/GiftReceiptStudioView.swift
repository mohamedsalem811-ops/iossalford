import SwiftUI

struct GiftReceiptStudioView: View {
    @EnvironmentObject var store: POSDataStore
    var isModalSheet: Bool = false
    @Environment(\.dismiss) private var dismiss
    @State private var shareURL: URL? = nil
    @State private var errorMessage: String? = nil
    @State private var savedMessage: String = ""

    private var itemsTotal: Double {
        store.activeReceiptItems.reduce(0) { $0 + $1.price * Double($1.qty) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SalfordSpacing.l) {
                receiptHeader
                templateSection
                priceModeSection
                customerSection
                itemsSection
                actionsSection

                SalfordSectionTitle(title: "معاينة الفاتورة", icon: "eye")

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
                    } else if store.activeReceiptTemplate == .scarvesLibya {
                        VStack(spacing: 4) {
                            Text("SALFORD")
                                .font(.system(size: 26, weight: .bold))
                                .foregroundColor(.black)
                            Text("L  I  B  Y  A")
                                .font(.system(size: 10.5, weight: .semibold))
                                .foregroundColor(.gray)
                            Text("SCARVES & ACCESSORIES • TRIPOLI, LIBYA")
                                .font(.system(size: 8.5, weight: .medium))
                                .foregroundColor(.gray)
                        }
                        .padding(.top, 20)
                    } else if store.activeReceiptTemplate == .scarvesSalford {
                        VStack(spacing: 4) {
                            Text("SALFORD")
                                .font(.system(size: 26, weight: .bold))
                                .foregroundColor(.white)
                            Text("scarves")
                                .font(.system(size: 11))
                                .kerning(3)
                                .foregroundColor(Color(red: 240/255, green: 190/255, blue: 208/255))
                            Text("✦ SILK & CASHMERE SCARVES • TRIPOLI, LIBYA ✦")
                                .font(.system(size: 8.5, weight: .semibold))
                                .foregroundColor(Color(red: 240/255, green: 190/255, blue: 208/255))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 18)
                        .background(
                            LinearGradient(
                                colors: [Color(red: 110/255, green: 30/255, blue: 62/255), Color(red: 42/255, green: 12/255, blue: 26/255)],
                                startPoint: .topTrailing,
                                endPoint: .bottomLeading
                            )
                        )
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
                            Text("Receipt No: \(store.activeReceiptNo.isEmpty ? "— (assigned on save)" : store.activeReceiptNo)")
                            Text("Store: \(store.activeReceiptTemplate.storeName)")
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
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .shadow(color: .black.opacity(0.25), radius: 10, x: 0, y: 4)
                .accessibilityLabel("معاينة الفاتورة كما ستُطبع")
            }
            .padding(SalfordSpacing.l)
        }
        .background(SalfordTheme.bgPrimary)
        .navigationTitle(store.activeReceiptId == nil ? "فاتورة جديدة" : "الفاتورة")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if isModalSheet {
                ToolbarItem(placement: .cancellationAction) {
                    Button("إغلاق") { dismiss() }
                }
            }
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button {
                        store.openNewDraftReceipt(items: [], present: isModalSheet)
                        savedMessage = ""
                    } label: {
                        Label("فاتورة جديدة فارغة", systemImage: "doc.badge.plus")
                    }
                } label: {
                    Label("المزيد", systemImage: "ellipsis.circle")
                }
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

    // MARK: Sections

    /// Number, date/time and save status at a glance.
    private var receiptHeader: some View {
        HStack(alignment: .center, spacing: SalfordSpacing.m) {
            Image(systemName: "doc.text.fill")
                .font(.system(.title2))
                .foregroundColor(SalfordTheme.gold)
                .frame(width: 44, height: 44)
                .background(SalfordTheme.royalNavyMid)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                if store.activeReceiptNo.isEmpty {
                    Text("فاتورة جديدة")
                        .font(.system(.headline, weight: .bold))
                        .foregroundColor(SalfordTheme.textPrimary)
                    Text("يُعطى الرقم تلقائياً عند الحفظ أو الطباعة")
                        .font(.system(.caption))
                        .foregroundColor(SalfordTheme.textMuted)
                } else {
                    Text(store.activeReceiptNo)
                        .font(.system(.headline, design: .monospaced, weight: .bold))
                        .foregroundColor(SalfordTheme.textPrimary)
                    Text("\(store.activeReceiptDate) • \(store.activeReceiptTime)")
                        .font(.system(.caption))
                        .foregroundColor(SalfordTheme.textMuted)
                }
            }
            Spacer()
            if !savedMessage.isEmpty {
                Label("محفوظة", systemImage: "checkmark.circle.fill")
                    .font(.system(.caption, weight: .bold))
                    .foregroundColor(SalfordTheme.emeraldSuccess)
            }
        }
        .padding(SalfordSpacing.l)
        .salfordCard()
    }

    /// Template cards with full names (no truncation) and a small colour preview.
    private var templateSection: some View {
        VStack(alignment: .leading, spacing: SalfordSpacing.s) {
            SalfordSectionTitle(title: "القالب", icon: "paintpalette.fill")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: SalfordSpacing.m) {
                    ForEach(ReceiptTemplate.available(for: store.line)) { tpl in
                        let selected = store.activeReceiptTemplate == tpl
                        Button {
                            store.activeReceiptTemplate = tpl
                        } label: {
                            VStack(alignment: .leading, spacing: SalfordSpacing.s) {
                                templateSwatch(tpl)
                                Text(tpl.shortName)
                                    .font(.system(.subheadline, weight: .bold))
                                    .foregroundColor(SalfordTheme.textPrimary)
                                    .lineLimit(1)
                                Text(tpl.subtitle)
                                    .font(.system(.caption))
                                    .foregroundColor(SalfordTheme.textMuted)
                                    .lineLimit(1)
                            }
                            .padding(SalfordSpacing.m)
                            .frame(width: 165, alignment: .leading)
                            .background(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .fill(SalfordTheme.bgCard)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .stroke(selected ? SalfordTheme.gold : SalfordTheme.borderSubtle, lineWidth: selected ? 2 : 1)
                            )
                            .overlay(alignment: .topLeading) {
                                if selected {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundColor(SalfordTheme.gold)
                                        .padding(8)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(tpl.shortName)
                        .accessibilityAddTraits(selected ? .isSelected : [])
                    }
                }
                .padding(.vertical, 2)
            }
        }
    }

    /// Mini picture of the template's header so the choice is visual.
    private func templateSwatch(_ tpl: ReceiptTemplate) -> some View {
        ZStack {
            switch tpl {
            case .salfordRoyal:
                LinearGradient(colors: [Color(red: 0.17, green: 0.10, blue: 0.33), Color(red: 0.04, green: 0.04, blue: 0.09)],
                               startPoint: .topTrailing, endPoint: .bottomLeading)
                Text("SJ").font(.system(.headline, design: .serif, weight: .black)).foregroundColor(.white)
            case .salfordWhite:
                Color.white
                Text("SJ").font(.system(.headline, design: .serif, weight: .black)).foregroundColor(.black)
            case .swarovskiLondon:
                Color.white
                Text("SWAROVSKI").font(.system(.caption2, weight: .bold)).foregroundColor(.black)
            case .scarvesLibya:
                Color.white
                Text("SALFORD Libya").font(.system(.caption, weight: .bold)).foregroundColor(.black)
            case .scarvesSalford:
                LinearGradient(colors: [Color(red: 110/255, green: 30/255, blue: 62/255), Color(red: 42/255, green: 12/255, blue: 26/255)],
                               startPoint: .topTrailing, endPoint: .bottomLeading)
                Text("SALFORD").font(.system(.caption, weight: .bold)).foregroundColor(.white)
            }
        }
        .frame(height: 54)
        .frame(maxWidth: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(Color.black.opacity(0.08), lineWidth: 1))
    }

    /// Two clearly named choices instead of a switch whose label flips meaning.
    private var priceModeSection: some View {
        VStack(alignment: .leading, spacing: SalfordSpacing.s) {
            SalfordSectionTitle(title: "نوع الفاتورة", icon: "tag.fill")
            Picker("نوع الفاتورة", selection: $store.showRealPricesInReceipt) {
                Text("رسمية بالأسعار").tag(true)
                Text("هدية بدون أسعار").tag(false)
            }
            .pickerStyle(.segmented)
            Text(store.showRealPricesInReceipt
                 ? "تظهر أسعار القطع والمجموع في الفاتورة."
                 : "تُخفى الأسعار وتظهر XXX مكانها — مناسبة لتقديم الهدية.")
                .font(.system(.caption))
                .foregroundColor(SalfordTheme.textMuted)
        }
    }

    private var customerSection: some View {
        VStack(alignment: .leading, spacing: SalfordSpacing.s) {
            SalfordSectionTitle(title: "الزبون", icon: "person.fill")
            TextField("اسم الزبون كما يظهر في الفاتورة", text: $store.activeReceiptCustomer)
                .salfordField()
        }
    }

    private var itemsSection: some View {
        VStack(alignment: .leading, spacing: SalfordSpacing.m) {
            HStack {
                SalfordSectionTitle(title: "القطع (\(store.activeReceiptItems.count))", icon: "sparkles")
                if store.showRealPricesInReceipt && !store.activeReceiptItems.isEmpty {
                    Text(Money.lyd(itemsTotal))
                        .font(.system(.subheadline, weight: .heavy))
                        .foregroundColor(SalfordTheme.goldLight)
                }
            }

            if store.activeReceiptItems.isEmpty {
                SalfordEmptyState(icon: "tray", title: "لا توجد قطع في الفاتورة", message: "أضف قطعة بالزر أدناه.")
            }

            ForEach($store.activeReceiptItems) { $item in
                ReceiptLineEditorRow(item: $item) {
                    store.activeReceiptItems.removeAll { $0.id == item.id }
                }
            }

            Button {
                store.activeReceiptItems.append(
                    ReceiptLineItem(name: "", color: "", code: "", qty: 1, price: 0)
                )
            } label: {
                Label("إضافة قطعة للفاتورة", systemImage: "plus.circle.fill")
            }
            .buttonStyle(.salfordSecondary)
        }
    }

    private var actionsSection: some View {
        VStack(spacing: SalfordSpacing.m) {
            HStack(spacing: SalfordSpacing.m) {
                Button {
                    if let url = saveAndBuildPDF() {
                        if !NativePDFGenerator.printPDF(url: url, jobName: "SALFORD Receipt \(store.activeReceiptNo)") {
                            errorMessage = "تعذرت طباعة الملف — جرّب «مشاركة PDF» ثم اطبع من تطبيق الملفات"
                        }
                    }
                } label: {
                    Label("طباعة", systemImage: "printer.fill")
                }
                .buttonStyle(.salfordPrimary)

                Button {
                    shareURL = saveAndBuildPDF()
                } label: {
                    Label("مشاركة PDF", systemImage: "square.and.arrow.up")
                }
                .buttonStyle(.salfordSecondary)
            }

            Button {
                if let no = store.commitActiveReceipt() {
                    savedMessage = "✅ تم حفظ الفاتورة \(no)"
                    UINotificationFeedbackGenerator().notificationOccurred(.success)
                } else {
                    errorMessage = "أضف قطعة واحدة على الأقل باسم واضح قبل الحفظ"
                }
            } label: {
                Label("حفظ الفاتورة فقط", systemImage: "tray.and.arrow.down")
                    .font(.system(.subheadline, weight: .semibold))
            }
            .frame(maxWidth: .infinity, minHeight: SalfordSpacing.touch)

            if !savedMessage.isEmpty {
                Text(savedMessage)
                    .font(.system(.footnote, weight: .bold))
                    .foregroundColor(SalfordTheme.emeraldSuccess)
                    .frame(maxWidth: .infinity)
            }
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
        VStack(alignment: .leading, spacing: SalfordSpacing.s) {
            HStack(spacing: SalfordSpacing.s) {
                TextField("اسم القطعة", text: $item.name)
                    .salfordField()
                Button(role: .destructive) {
                    onDelete()
                } label: {
                    Image(systemName: "trash")
                        .frame(width: SalfordSpacing.touch, height: SalfordSpacing.touch)
                        .background(SalfordTheme.dangerRed.opacity(0.12))
                        .foregroundColor(SalfordTheme.dangerRed)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .accessibilityLabel("حذف القطعة من الفاتورة")
            }
            TextField("الماركة (اختياري)", text: Binding(
                get: { item.brand ?? "" },
                set: { item.brand = $0.trimmingCharacters(in: .whitespaces).isEmpty ? nil : $0 }
            ))
            .autocorrectionDisabled()
            .salfordField()
            HStack(spacing: SalfordSpacing.s) {
                TextField("اللون", text: $item.color)
                    .salfordField()
                TextField("الكود", text: $item.code)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .salfordField()
            }
            HStack(spacing: SalfordSpacing.m) {
                Stepper(value: $item.qty, in: 1...99) {
                    Text("الكمية: \(item.qty)")
                        .font(.system(.subheadline, weight: .semibold))
                        .foregroundColor(SalfordTheme.textPrimary)
                }
                HStack(spacing: 4) {
                    TextField("السعر", text: $priceText)
                        .numericInput($priceText, .decimal)
                        .multilineTextAlignment(.center)
                        .salfordField()
                        .frame(width: 100)
                        .onChange(of: priceText) { newValue in
                            item.price = NumberInput.decimal(newValue) ?? 0
                        }
                    Text("د.ل")
                        .font(.system(.footnote))
                        .foregroundColor(SalfordTheme.textMuted)
                }
            }
        }
        .padding(SalfordSpacing.m)
        .salfordCard()
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
