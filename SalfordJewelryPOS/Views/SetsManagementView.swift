import SwiftUI

struct SetsManagementView: View {
    @EnvironmentObject var store: POSDataStore
    @State private var setToDelete: JewelrySet? = nil
    @State private var editingSetId: Int? = nil
    @State private var setName: String = ""
    @State private var setDesc: String = ""
    @State private var setDiscount: String = "100"
    /// productId -> quantity chosen for the bundle
    @State private var pieceQuantities: [Int: Int] = [:]
    @State private var pieceSearch: String = ""
    @State private var formMessage: String = ""

    private var draftItems: [SetItem] {
        pieceQuantities.filter { $0.value > 0 }.sorted { $0.key < $1.key }.enumerated().map { i, kv in
            SetItem(id: i + 1, productId: kv.key, quantity: kv.value)
        }
    }

    private var draftSet: JewelrySet {
        JewelrySet(id: editingSetId ?? 0, name: setName, description: nil,
                   discount: NumberInput.decimal(setDiscount) ?? 0, items: draftItems, createdAt: "")
    }

    private var pickerProducts: [Product] {
        let chosen = store.products.filter { (pieceQuantities[$0.id] ?? 0) > 0 }
        let others = store.products.filter { (pieceQuantities[$0.id] ?? 0) == 0 }
            .filter { pieceSearch.isEmpty || store.displayName(for: $0).localizedCaseInsensitiveContains(pieceSearch) || $0.sku.localizedCaseInsensitiveContains(pieceSearch) }
        return chosen + others.prefix(12)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 10) {
                    Text(editingSetId == nil ? (store.line == .scarves ? "إنشاء طقم أوشحة جديد" : "إنشاء طقم مجوهرات جديد") : "تعديل الطقم")
                        .font(.system(.subheadline, weight: .bold))
                        .foregroundColor(SalfordTheme.silverLight)

                    TextField("اسم الطقم الملكي", text: $setName)
                        .salfordField()

                    TextField("وصف ومكونات الطقم", text: $setDesc)
                        .salfordField()

                    Text("قطع الطقم")
                        .font(.system(.footnote, weight: .bold))
                        .foregroundColor(SalfordTheme.goldLight)

                    TextField("ابحث عن قطعة لإضافتها", text: $pieceSearch)
                        .salfordField()

                    ForEach(pickerProducts) { prod in
                        let qty = pieceQuantities[prod.id] ?? 0
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(store.displayName(for: prod))
                                    .font(.system(.footnote, weight: qty > 0 ? .bold : .regular))
                                    .foregroundColor(qty > 0 ? .white : SalfordTheme.silverLight)
                                Text(String(format: "%@ • %@ د.ل • المتوفر %d", prod.sku, Money.plain(prod.sellPrice), prod.stock))
                                    .font(.system(.caption))
                                    .foregroundColor(SalfordTheme.textMuted)
                            }
                            Spacer()
                            Stepper(qty == 0 ? "—" : "×\(qty)", value: Binding(
                                get: { pieceQuantities[prod.id] ?? 0 },
                                set: { pieceQuantities[prod.id] = $0 }
                            ), in: 0...20)
                            .font(.system(.footnote, weight: .bold))
                            .foregroundColor(SalfordTheme.textPrimary)
                            .fixedSize()
                        }
                        .padding(.vertical, 2)
                    }

                    TextField("قيمة الخصم الخاص للطقم بالدينار", text: $setDiscount)
                        .numericInput($setDiscount, .decimal)
                        .salfordField()

                    let list = store.listPrice(of: draftSet)
                    if list > 0 {
                        Text(String(format: "مجموع الأسعار %@ د.ل − الخصم %@ = سعر الطقم %@ د.ل", Money.plain(list), Money.plain(draftSet.discount), Money.plain(store.bundlePrice(of: draftSet))))
                            .font(.system(.footnote, weight: .bold))
                            .foregroundColor(SalfordTheme.emeraldSuccess)
                    }

                    HStack(spacing: 10) {
                        Button {
                            if let error = store.saveSet(id: editingSetId, name: setName, description: setDesc,
                                                         discount: NumberInput.decimal(setDiscount) ?? 0, items: draftItems) {
                                formMessage = error
                            } else {
                                resetForm()
                                UINotificationFeedbackGenerator().notificationOccurred(.success)
                            }
                        } label: {
                            Label(editingSetId == nil ? "إضافة الطقم للقائمة" : "حفظ التعديلات", systemImage: "checkmark.circle.fill")
                        }
                        .buttonStyle(.salfordPrimary)
                        if editingSetId != nil {
                            Button("إلغاء") { resetForm() }
                                .font(.system(.subheadline, weight: .bold))
                                .foregroundColor(SalfordTheme.silverLight)
                        }
                    }

                    if !formMessage.isEmpty {
                        Text(formMessage)
                            .font(.system(.footnote, weight: .bold))
                            .foregroundColor(SalfordTheme.dangerRed)
                    }
                }
                .salfordCard()

                ForEach(store.sets) { jset in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Image(systemName: "sparkles")
                                .foregroundColor(SalfordTheme.goldLight)
                            Text(jset.name)
                                .font(.system(.subheadline, weight: .bold))
                                .foregroundColor(SalfordTheme.textPrimary)
                            Spacer()
                            Text(Money.lyd(store.bundlePrice(of: jset)))
                                .font(.system(.subheadline, weight: .heavy))
                                .foregroundColor(SalfordTheme.silverLight)
                            Button {
                                edit(jset)
                            } label: {
                                Image(systemName: "pencil")
                                    .font(.system(.footnote))
                                    .foregroundColor(SalfordTheme.silverAccent)
                            }
                            Button(role: .destructive) {
                                setToDelete = jset
                            } label: {
                                Image(systemName: "trash")
                                    .font(.system(.footnote))
                                    .foregroundColor(SalfordTheme.dangerRed)
                            }
                        }
                        Text(jset.items.map { item -> String in
                            let name = store.products.first { $0.id == item.productId }.map { store.displayName(for: $0) } ?? "قطعة محذوفة"
                            return item.quantity > 1 ? "\(name) ×\(item.quantity)" : name
                        }.joined(separator: " + "))
                            .font(.system(.footnote))
                            .foregroundColor(SalfordTheme.silverAccent)
                        Text(String(format: "بدلاً من %@ د.ل • خصم %@ د.ل • متاح للبيع: %d طقم", Money.plain(store.listPrice(of: jset)), Money.plain(jset.discount), store.availableBundles(jset)))
                            .font(.system(.caption))
                            .foregroundColor(SalfordTheme.textMuted)
                        if jset.items.isEmpty {
                            Label("هذا الطقم بلا قطع (أُنشئ بنسخة سابقة) — اضغط تعديل لإضافة القطع", systemImage: "exclamationmark.triangle.fill")
                                .font(.system(.caption, weight: .bold))
                                .foregroundColor(SalfordTheme.warningAmber)
                        }
                        if let desc = jset.description, !desc.isEmpty {
                            Text(desc)
                                .font(.system(.footnote))
                                .foregroundColor(SalfordTheme.textMuted)
                        }
                    }
                    .salfordCard()
                }
            }
            .padding(14)
        }
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("الأطقم الملكية")
        .confirmDelete(
            $setToDelete,
            title: { "حذف طقم «\($0.name)»؟" },
            message: { _ in "يُحذف تعريف الطقم فقط؛ القطع تبقى في المخزون." },
            perform: { store.deleteSet(id: $0.id) }
        )
        .navigationBarTitleDisplayMode(.inline)
    }

    private func edit(_ jset: JewelrySet) {
        editingSetId = jset.id
        setName = jset.name
        setDesc = jset.description ?? ""
        setDiscount = NumberInput.editable(jset.discount)
        pieceQuantities = Dictionary(jset.items.map { ($0.productId, $0.quantity) }, uniquingKeysWith: +)
        formMessage = ""
    }

    private func resetForm() {
        editingSetId = nil
        setName = ""
        setDesc = ""
        setDiscount = "100"
        pieceQuantities = [:]
        pieceSearch = ""
        formMessage = ""
    }
}
