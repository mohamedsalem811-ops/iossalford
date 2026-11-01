import SwiftUI

/// Small brand label shown on product cards and rows.
struct BrandTag: View {
    let name: String

    var body: some View {
        Text(name)
            .font(.system(.caption2, weight: .bold))
            .lineLimit(1)
            .padding(.horizontal, 7)
            .padding(.vertical, 2)
            .background(SalfordTheme.gold.opacity(0.15))
            .foregroundColor(SalfordTheme.goldLight)
            .clipShape(Capsule())
    }
}

/// Filter buttons: الكل • each brand • بدون ماركة.
struct BrandChips: View {
    let brands: [String]
    @Binding var selected: String

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: SalfordSpacing.s) {
                ForEach(["الكل"] + brands + [POSDataStore.noBrandLabel], id: \.self) { b in
                    let isSelected = selected == b
                    Button {
                        selected = b
                    } label: {
                        HStack(spacing: 4) {
                            if b != "الكل" && b != POSDataStore.noBrandLabel {
                                Image(systemName: "seal.fill").font(.system(.caption2))
                            }
                            Text(b)
                        }
                        .font(.system(.subheadline, weight: .semibold))
                        .padding(.horizontal, SalfordSpacing.m)
                        .frame(minHeight: 34)
                        .background(isSelected ? SalfordTheme.gold : SalfordTheme.bgCard)
                        .foregroundColor(isSelected ? .white : SalfordTheme.textPrimary)
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(SalfordTheme.gold.opacity(isSelected ? 0 : 0.35), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(b == "الكل" ? "كل الماركات" : b)
                    .accessibilityAddTraits(isSelected ? .isSelected : [])
                }
            }
        }
        .textCase(nil)
    }
}

/// Type any brand; existing brands are suggested while typing (tap to use the same spelling).
struct BrandField: View {
    @EnvironmentObject var store: POSDataStore
    @Binding var brand: String
    @FocusState private var focused: Bool

    private var suggestions: [String] {
        let q = brand.trimmingCharacters(in: .whitespaces)
        let list = q.isEmpty ? store.brands : store.brands.filter { $0.localizedCaseInsensitiveContains(q) }
        return Array(list.filter { $0.caseInsensitiveCompare(q) != .orderedSame }.prefix(10))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: SalfordSpacing.s) {
            HStack {
                Image(systemName: "seal.fill")
                    .foregroundColor(SalfordTheme.gold)
                TextField("الماركة — اكتب أي ماركة (اختياري)", text: $brand)
                    .autocorrectionDisabled()
                    .focused($focused)
                if !brand.isEmpty {
                    Button {
                        brand = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(SalfordTheme.textMuted)
                    }
                    .buttonStyle(.borderless)
                    .accessibilityLabel("بدون ماركة")
                }
            }
            if focused || brand.isEmpty, !suggestions.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: SalfordSpacing.s) {
                        ForEach(suggestions, id: \.self) { s in
                            Button {
                                brand = s
                                focused = false
                            } label: {
                                Text(s)
                                    .font(.system(.footnote, weight: .semibold))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(SalfordTheme.royalNavyMid)
                                    .foregroundColor(SalfordTheme.textPrimary)
                                    .clipShape(Capsule())
                            }
                            .buttonStyle(.borderless)
                        }
                    }
                }
            }
            if let canonical = store.canonicalBrand(brand), !store.brands.contains(canonical) {
                Text("ماركة جديدة — ستُضاف للقائمة عند الحفظ")
                    .font(.system(.caption2))
                    .foregroundColor(SalfordTheme.textMuted)
            }
        }
    }
}

/// Management → Brands: the shop's own list. Add, rename (updates every piece) and delete.
struct BrandsManagementView: View {
    @EnvironmentObject var store: POSDataStore
    @State private var newBrand: String = ""
    @State private var renaming: String? = nil
    @State private var renameText: String = ""
    @State private var brandToDelete: String? = nil
    @State private var message: String? = nil

    var body: some View {
        List {
            Section {
                HStack {
                    TextField("اسم ماركة جديدة", text: $newBrand)
                        .autocorrectionDisabled()
                        .onSubmit(add)
                    Button("إضافة", action: add)
                        .font(.system(.body, weight: .bold))
                        .disabled(newBrand.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            } footer: {
                Text("يمكنك أيضاً كتابة أي ماركة مباشرة عند إضافة قطعة، وستُضاف هنا تلقائياً.")
            }
            .listRowBackground(SalfordTheme.bgCard)

            Section("الماركات (\(store.brands.count))") {
                if store.brands.isEmpty {
                    SalfordEmptyState(icon: "seal", title: "لا توجد ماركات بعد")
                }
                ForEach(store.brands, id: \.self) { b in
                    HStack {
                        Image(systemName: "seal.fill")
                            .foregroundColor(SalfordTheme.gold)
                        Text(b)
                            .font(.system(.body, weight: .semibold))
                            .foregroundColor(SalfordTheme.textPrimary)
                        Spacer()
                        Text("\(store.productCount(forBrand: b)) قطعة")
                            .font(.system(.footnote))
                            .foregroundColor(SalfordTheme.textMuted)
                    }
                    .frame(minHeight: SalfordSpacing.touch)
                    .swipeActions(edge: .trailing) {
                        Button(role: .destructive) {
                            brandToDelete = b
                        } label: {
                            Label("حذف", systemImage: "trash")
                        }
                        Button {
                            renameText = b
                            renaming = b
                        } label: {
                            Label("تعديل", systemImage: "pencil")
                        }
                        .tint(SalfordTheme.gold)
                    }
                    .contextMenu {
                        Button {
                            renameText = b
                            renaming = b
                        } label: { Label("تعديل الاسم", systemImage: "pencil") }
                        Button(role: .destructive) { brandToDelete = b } label: { Label("حذف", systemImage: "trash") }
                    }
                }
            }
            .listRowBackground(SalfordTheme.bgCard)
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("الماركات")
        .navigationBarTitleDisplayMode(.inline)
        .alert("تعديل اسم الماركة", isPresented: Binding(get: { renaming != nil }, set: { if !$0 { renaming = nil } })) {
            TextField("الاسم", text: $renameText)
            Button("حفظ") {
                if let old = renaming { message = store.renameBrand(old, to: renameText) }
                renaming = nil
            }
            Button("إلغاء", role: .cancel) { renaming = nil }
        } message: {
            Text("يتغير الاسم في كل القطع التي تحمل هذه الماركة.")
        }
        .confirmDelete(
            $brandToDelete,
            title: { "حذف الماركة «\($0)»؟" },
            message: { b in
                let n = store.productCount(forBrand: b)
                return n > 0
                    ? "\(n) قطعة تحمل هذه الماركة وستصبح «بدون ماركة». المبيعات السابقة تحتفظ باسم الماركة."
                    : "لا توجد قطع بهذه الماركة."
            },
            perform: { store.deleteBrand($0) }
        )
        .alert("تنبيه", isPresented: Binding(get: { message != nil }, set: { if !$0 { message = nil } })) {
            Button("حسناً", role: .cancel) {}
        } message: {
            Text(message ?? "")
        }
    }

    private func add() {
        guard store.addBrand(newBrand) != nil else { return }
        newBrand = ""
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
}
