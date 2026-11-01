import SwiftUI
import UIKit

/// Products: searchable, filterable, sortable list. Tap a piece to edit it; swipe for quick actions.
struct ProductsView: View {
    @EnvironmentObject var store: POSDataStore
    @State private var searchText: String = ""
    @State private var selectedCategory: String = "الكل"
    @State private var selectedBrand: String = "الكل"
    @State private var sort: SortOrder = .name
    @State private var onlyAttention: Bool = false
    @State private var showAddSheet: Bool = false
    @State private var editingProduct: Product? = nil
    @State private var previewingProduct: Product? = nil
    @State private var productToDelete: Product? = nil

    enum SortOrder: String, CaseIterable, Identifiable {
        case name = "الاسم"
        case stockLow = "الأقل مخزوناً"
        case priceHigh = "الأعلى سعراً"
        case newest = "الأحدث"
        var id: String { rawValue }
    }

    var filteredProducts: [Product] {
        let q = NumberInput.latinDigits(searchText).trimmingCharacters(in: .whitespaces)
        let list = store.products.filter { prod in
            (selectedCategory == "الكل" || prod.category == selectedCategory)
                && (selectedBrand == "الكل"
                    || (selectedBrand == POSDataStore.noBrandLabel ? prod.brand == nil : prod.brand == selectedBrand))
                && (q.isEmpty || prod.name.localizedCaseInsensitiveContains(q) || prod.sku.localizedCaseInsensitiveContains(q)
                    || (prod.brand ?? "").localizedCaseInsensitiveContains(q))
                && (!onlyAttention || prod.isLowStock || prod.isOutOfStock)
        }
        switch sort {
        case .name: return list.sorted { $0.name < $1.name }
        case .stockLow: return list.sorted { $0.stock < $1.stock }
        case .priceHigh: return list.sorted { $0.sellPrice > $1.sellPrice }
        case .newest: return list.sorted { $0.createdAt > $1.createdAt }
        }
    }

    var body: some View {
        List {
            Section {
                ForEach(filteredProducts) { prod in
                    Button {
                        editingProduct = prod
                    } label: {
                        ProductRow(product: prod) {
                            if prod.hasImage { previewingProduct = prod } else { editingProduct = prod }
                        }
                    }
                    .buttonStyle(.plain)
                    .listRowBackground(SalfordTheme.bgCard)
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button(role: .destructive) {
                            productToDelete = prod
                        } label: {
                            Label("حذف", systemImage: "trash")
                        }
                        Button {
                            store.openNewDraftReceipt(
                                items: [ReceiptLineItem(name: prod.name, color: prod.color ?? "", code: prod.sku, qty: 1, price: prod.sellPrice, brand: prod.brand)]
                            )
                        } label: {
                            Label("فاتورة هدية", systemImage: "gift")
                        }
                        .tint(SalfordTheme.gold)
                    }
                    .swipeActions(edge: .leading) {
                        Button {
                            store.adjustStock(productId: prod.id, by: 1)
                        } label: {
                            Label("+1 مخزون", systemImage: "plus")
                        }
                        .tint(SalfordTheme.emeraldSuccess)
                        Button {
                            store.adjustStock(productId: prod.id, by: -1)
                        } label: {
                            Label("−1 مخزون", systemImage: "minus")
                        }
                        .tint(SalfordTheme.warningAmber)
                    }
                    .contextMenu {
                        Button { editingProduct = prod } label: { Label("تعديل", systemImage: "pencil") }
                        if prod.hasImage {
                            Button { previewingProduct = prod } label: { Label("عرض الصورة", systemImage: "photo") }
                        }
                        Button { store.adjustStock(productId: prod.id, by: 1) } label: { Label("+1 مخزون", systemImage: "plus") }
                        Button {
                            store.openNewDraftReceipt(
                                items: [ReceiptLineItem(name: prod.name, color: prod.color ?? "", code: prod.sku, qty: 1, price: prod.sellPrice, brand: prod.brand)]
                            )
                        } label: { Label("إصدار فاتورة هدية", systemImage: "gift") }
                        Button(role: .destructive) { productToDelete = prod } label: { Label("حذف القطعة", systemImage: "trash") }
                    }
                }
            } header: {
                VStack(alignment: .leading, spacing: SalfordSpacing.s) {
                    if !store.brandsInUse.isEmpty {
                        BrandChips(brands: store.brandsInUse, selected: $selectedBrand)
                    }
                    categoryChips
                    Text(summaryText)
                        .font(.system(.footnote))
                        .foregroundColor(SalfordTheme.textMuted)
                        .textCase(nil)
                }
                .padding(.vertical, SalfordSpacing.xs)
            }

            if filteredProducts.isEmpty {
                Section {
                    if store.products.isEmpty {
                        SalfordEmptyState(icon: "sparkles", title: "لا توجد قطع بعد",
                                          message: "اضغط ＋ لإضافة أول قطعة مع صورتها وسعرها.")
                    } else {
                        SalfordEmptyState(icon: "magnifyingglass", title: "لا توجد نتائج",
                                          message: "غيّر البحث أو الفئة أو الفلتر.")
                    }
                }
                .listRowBackground(Color.clear)
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(SalfordTheme.bgPrimary)
        .searchable(text: $searchText, prompt: "اسم القطعة أو الكود أو الماركة")
        .navigationTitle("المنتجات")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Menu {
                    Picker("الترتيب", selection: $sort) {
                        ForEach(SortOrder.allCases) { Text($0.rawValue).tag($0) }
                    }
                    Toggle("المنخفض والنافد فقط", isOn: $onlyAttention)
                } label: {
                    Label("ترتيب وفلترة", systemImage: onlyAttention ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
                }
            }
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    showAddSheet = true
                } label: {
                    Label("إضافة قطعة", systemImage: "plus")
                }
            }
        }
        .confirmDelete(
            $productToDelete,
            title: { "حذف «\($0.name)»؟" },
            message: { prod in
                let salesCount = store.sales.filter { $0.productId == prod.id }.count
                let setsCount = store.sets.filter { $0.items.contains { $0.productId == prod.id } }.count
                var lines = ["المخزون الحالي: \(prod.stock) قطعة."]
                if salesCount > 0 {
                    lines.append("لهذه القطعة \(salesCount) عملية بيع: تبقى في السجل، لكن أي مرتجع منها لن يعود للمخزن.")
                    lines.append("إذا نفدت القطعة فقط، اجعل الكمية 0 بدلاً من حذفها.")
                }
                if setsCount > 0 {
                    lines.append("القطعة موجودة في \(setsCount) طقم.")
                }
                return lines.joined(separator: "\n")
            },
            perform: { store.deleteProduct(id: $0.id) }
        )
        .sheet(isPresented: $showAddSheet) {
            ProductFormSheet(product: nil)
                .environment(\.layoutDirection, .rightToLeft)
        }
        .sheet(item: $editingProduct) { prod in
            ProductFormSheet(product: prod)
                .environment(\.layoutDirection, .rightToLeft)
        }
        .sheet(item: $previewingProduct) { prod in
            ProductPhotoLightboxSheet(product: prod) {
                previewingProduct = nil
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                    editingProduct = prod
                }
            }
            .environment(\.layoutDirection, .rightToLeft)
        }
    }

    private var summaryText: String {
        let list = filteredProducts
        let pieces = list.reduce(0) { $0 + $1.stock }
        return "\(list.count) صنف • \(pieces) قطعة في المخزن • اسحب الصف لليمين لتعديل المخزون"
    }

    private var categoryChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: SalfordSpacing.s) {
                ForEach(["الكل"] + store.categories, id: \.self) { cat in
                    let selected = selectedCategory == cat
                    Button {
                        selectedCategory = cat
                    } label: {
                        Text(cat)
                            .font(.system(.subheadline, weight: .semibold))
                            .padding(.horizontal, SalfordSpacing.l)
                            .frame(minHeight: 34)
                            .background(selected ? SalfordTheme.silverLight : SalfordTheme.bgCard)
                            .foregroundColor(selected ? SalfordTheme.onPrimary : SalfordTheme.textPrimary)
                            .clipShape(Capsule())
                            .overlay(Capsule().stroke(SalfordTheme.borderSubtle, lineWidth: selected ? 0 : 1))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(selected ? .isSelected : [])
                }
            }
        }
        .textCase(nil)
    }
}

/// One row of the products list.
struct ProductRow: View {
    let product: Product
    let onPhotoTap: () -> Void

    var body: some View {
        HStack(spacing: SalfordSpacing.m) {
            Button(action: onPhotoTap) {
                SalfordProductThumbnailView(
                    image: ProductImageHelper.image(for: product),
                    size: 60,
                    cornerRadius: 12,
                    showZoomBadge: product.hasImage
                )
            }
            .buttonStyle(.plain)
            .accessibilityLabel(product.hasImage ? "عرض صورة القطعة" : "إضافة صورة")

            VStack(alignment: .leading, spacing: 4) {
                if let brand = product.brand {
                    BrandTag(name: brand)
                }
                Text(product.name)
                    .font(.system(.subheadline, weight: .bold))
                    .foregroundColor(SalfordTheme.textPrimary)
                    .lineLimit(2)
                Text([product.sku, product.category, product.color, product.size.map { "مقاس \($0)" }]
                        .compactMap { $0 }.joined(separator: " • "))
                    .font(.system(.caption))
                    .foregroundColor(SalfordTheme.textMuted)
                    .lineLimit(1)
                HStack(spacing: SalfordSpacing.s) {
                    Text(Money.lyd(product.sellPrice))
                        .font(.system(.subheadline, weight: .heavy))
                        .foregroundColor(SalfordTheme.goldLight)
                    Text("تكلفة \(Money.plain(product.costPrice))")
                        .font(.system(.caption))
                        .foregroundColor(SalfordTheme.textMuted)
                }
            }

            Spacer(minLength: 4)

            stockPill
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityHint("اضغط للتعديل")
    }

    private var stockPill: some View {
        let color: Color = product.isOutOfStock ? SalfordTheme.dangerRed
            : (product.isLowStock ? SalfordTheme.warningAmber : SalfordTheme.emeraldSuccess)
        return VStack(spacing: 0) {
            Text("\(product.stock)")
                .font(.system(.headline, weight: .heavy))
            Text(product.isOutOfStock ? "نفد" : "قطعة")
                .font(.system(.caption2, weight: .semibold))
        }
        .foregroundColor(color)
        .frame(minWidth: 48, minHeight: 44)
        .background(color.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

/// Full-Screen Clear Photo Lightbox when tapping a product image in إدارة المنتجات
struct ProductPhotoLightboxSheet: View {
    let product: Product
    var onEditRequested: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var zoomScale: CGFloat = 1.0

    var body: some View {
        NavigationStack {
            ZStack {
                SalfordTheme.bgPrimary.ignoresSafeArea()

                VStack(spacing: 16) {
                    if let uiImg = ProductImageHelper.image(for: product) {
                        Image(uiImage: uiImg)
                            .resizable()
                            .scaledToFit()
                            .frame(maxWidth: .infinity, maxHeight: 380)
                            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 20, style: .continuous)
                                    .stroke(SalfordTheme.goldLight.opacity(0.6), lineWidth: 1.5)
                            )
                            .scaleEffect(zoomScale)
                            .gesture(
                                MagnificationGesture()
                                    .onChanged { val in
                                        zoomScale = max(1.0, min(val, 3.0))
                                    }
                                    .onEnded { _ in
                                        withAnimation(.spring()) {
                                            zoomScale = 1.0
                                        }
                                    }
                            )
                            .padding(.horizontal, 16)
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(product.name)
                                .font(.system(.headline, weight: .heavy))
                                .foregroundColor(SalfordTheme.textPrimary)
                            Spacer()
                            Text(product.category)
                                .font(.system(.footnote, weight: .bold))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 4)
                                .background(SalfordTheme.royalNavyMid)
                                .foregroundColor(SalfordTheme.goldLight)
                                .clipShape(Capsule())
                        }

                        Text("الكود: \(product.sku) • اللون: \(product.color ?? "غير محدد")")
                            .font(.system(.subheadline))
                            .foregroundColor(SalfordTheme.textMuted)

                        Divider().background(SalfordTheme.borderSubtle)

                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("سعر التكلفة")
                                    .font(.system(.caption))
                                    .foregroundColor(SalfordTheme.textMuted)
                                Text(Money.lyd(product.costPrice))
                                    .font(.system(.callout, weight: .bold))
                                    .foregroundColor(SalfordTheme.silverLight)
                            }
                            Spacer()
                            VStack(alignment: .leading, spacing: 4) {
                                Text("سعر البيع")
                                    .font(.system(.caption))
                                    .foregroundColor(SalfordTheme.textMuted)
                                Text(Money.lyd(product.sellPrice))
                                    .font(.system(.callout, weight: .heavy))
                                    .foregroundColor(SalfordTheme.emeraldSuccess)
                            }
                            Spacer()
                            VStack(alignment: .leading, spacing: 4) {
                                Text("المخزون المتوفر")
                                    .font(.system(.caption))
                                    .foregroundColor(SalfordTheme.textMuted)
                                Text("\(product.stock) قطع")
                                    .font(.system(.callout, weight: .bold))
                                    .foregroundColor(SalfordTheme.goldLight)
                            }
                        }
                    }
                    .salfordCard()
                    .padding(.horizontal, 16)

                    Button {
                        onEditRequested()
                    } label: {
                        Label("تغيير الصورة أو تعديل بيانات القطعة", systemImage: "camera.rotate.fill")
                            .font(.system(.subheadline, weight: .bold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                            .background(SalfordTheme.silverGradient)
                            .foregroundColor(SalfordTheme.onPrimary)
                            .cornerRadius(12)
                    }
                    .padding(.horizontal, 16)

                    Spacer()
                }
                .padding(.top, 14)
            }
            .navigationTitle("صورة وتفاصيل القطعة")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("إغلاق") {
                        dismiss()
                    }
                    .foregroundColor(SalfordTheme.silverLight)
                }
            }
        }
    }
}

/// Add / edit a piece: photo, details, price (with live profit) and stock.
struct ProductFormSheet: View {
    @EnvironmentObject var store: POSDataStore
    @Environment(\.dismiss) private var dismiss
    let product: Product?

    @State private var name: String = ""
    @State private var sku: String = ""
    @State private var category: String = "خواتم"
    @State private var brand: String = ""
    @State private var color: String = ""
    @State private var costPrice: String = ""
    @State private var sellPrice: String = ""
    @State private var stock: String = "1"
    @State private var size: String = ""
    @State private var lowStockAlert: String = "3"
    /// Photo file chosen in this form (nil = no photo).
    @State private var imageFile: String? = nil
    /// Legacy Base64 photo of a product that was not migrated to a file yet.
    @State private var legacyImageBase64: String? = nil

    @State private var showCameraPicker: Bool = false
    @State private var showLibraryPicker: Bool = false
    @State private var formError: String? = nil
    @State private var triedToSave: Bool = false

    private var sellValue: Double? { NumberInput.decimal(sellPrice) }
    private var costValue: Double? { NumberInput.decimal(costPrice) }
    private var nameMissing: Bool { name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    private var sellMissing: Bool { (sellValue ?? 0) <= 0 }

    var body: some View {
        NavigationStack {
            Form {
                photoSection

                Section("بيانات القطعة") {
                    TextField("اسم القطعة — مثال: خاتم سوليتير ألماس", text: $name)
                    if triedToSave && nameMissing {
                        fieldError("اسم القطعة مطلوب")
                    }
                    BrandField(brand: $brand)
                    Picker("الفئة", selection: $category) {
                        ForEach(store.categories, id: \.self) { Text($0).tag($0) }
                    }
                    TextField("اللون — ذهبي، فضي، روز جولد", text: $color)
                    TextField("المقاس (اختياري) — مثال: 7 أو M", text: $size)
                    VStack(alignment: .leading, spacing: 2) {
                        TextField("الكود (يُولّد تلقائياً إذا تُرك فارغاً)", text: $sku)
                            .textInputAutocapitalization(.characters)
                            .autocorrectionDisabled()
                        Text("يجب أن يكون الكود مختلفاً لكل قطعة")
                            .font(.system(.caption2))
                            .foregroundColor(SalfordTheme.textMuted)
                    }
                }

                Section {
                    labeledNumberField("سعر البيع", text: $sellPrice, kind: .decimal, suffix: "د.ل")
                    if triedToSave && sellMissing {
                        fieldError("سعر البيع مطلوب ويجب أن يكون أكبر من 0")
                    }
                    labeledNumberField("سعر التكلفة", text: $costPrice, kind: .decimal, suffix: "د.ل")
                    if let sell = sellValue, let cost = costValue, sell > 0 {
                        let profit = sell - cost
                        HStack {
                            Text("الربح للقطعة")
                            Spacer()
                            Text("\(Money.lyd(profit)) • \(Int((profit / sell) * 100))٪")
                                .font(.system(.subheadline, weight: .bold))
                                .foregroundColor(profit >= 0 ? SalfordTheme.emeraldSuccess : SalfordTheme.dangerRed)
                        }
                    }
                } header: {
                    Text("السعر")
                } footer: {
                    Text("أدخل التكلفة 0 إذا كانت غير معروفة. التكلفة بالدولار تُحفظ بسعر الصرف الحالي.")
                }

                Section("المخزون") {
                    HStack {
                        Text("الكمية في المخزن")
                        Spacer()
                        Button {
                            let v = max(0, (NumberInput.integer(stock) ?? 0) - 1)
                            stock = "\(v)"
                        } label: { Image(systemName: "minus.circle.fill").font(.system(.title3)) }
                        .buttonStyle(.borderless)
                        .accessibilityLabel("إنقاص الكمية")
                        TextField("0", text: $stock)
                            .numericInput($stock, .integer)
                            .multilineTextAlignment(.center)
                            .frame(width: 60)
                        Button {
                            stock = "\((NumberInput.integer(stock) ?? 0) + 1)"
                        } label: { Image(systemName: "plus.circle.fill").font(.system(.title3)) }
                        .buttonStyle(.borderless)
                        .accessibilityLabel("زيادة الكمية")
                    }
                    labeledNumberField("تنبيه عند وصول المخزون إلى", text: $lowStockAlert, kind: .integer, suffix: "قطع")
                }

                Section {
                    Button {
                        savePiece()
                    } label: {
                        Label(product == nil ? "حفظ وإضافة القطعة" : "حفظ التعديلات", systemImage: "checkmark.circle.fill")
                    }
                    .buttonStyle(.salfordSuccess)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                }
            }
            .scrollContentBackground(.hidden)
            .background(SalfordTheme.bgPrimary)
            .navigationTitle(product == nil ? "قطعة جديدة" : "تعديل القطعة")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("إلغاء") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("حفظ") { savePiece() }
                        .font(.system(.body, weight: .bold))
                }
            }
            .onAppear(perform: load)
            .alert("لم يتم الحفظ", isPresented: Binding(get: { formError != nil }, set: { if !$0 { formError = nil } })) {
                Button("حسناً", role: .cancel) {}
            } message: {
                Text(formError ?? "")
            }
            .sheet(isPresented: $showCameraPicker) {
                NativeImagePickerSheet(sourceType: .camera) { pickedImage in
                    if let file = ProductImageHelper.storeImage(pickedImage, prefix: store.line.imagePrefix) {
                        imageFile = file
                        legacyImageBase64 = nil
                    }
                }
                .ignoresSafeArea()
            }
            .sheet(isPresented: $showLibraryPicker) {
                NativeImagePickerSheet(sourceType: .photoLibrary) { pickedImage in
                    if let file = ProductImageHelper.storeImage(pickedImage, prefix: store.line.imagePrefix) {
                        imageFile = file
                        legacyImageBase64 = nil
                    }
                }
                .ignoresSafeArea()
            }
        }
    }

    // MARK: Sections

    private var photoSection: some View {
        Section {
            let image = ProductImageHelper.image(named: imageFile) ?? ProductImageHelper.image(from: legacyImageBase64)
            ZStack {
                if let image {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                } else {
                    ZStack {
                        SalfordTheme.fieldBg
                        VStack(spacing: SalfordSpacing.s) {
                            Image(systemName: "camera.viewfinder")
                                .font(.system(.largeTitle))
                            Text("أضف صورة واضحة للقطعة")
                                .font(.system(.subheadline, weight: .semibold))
                        }
                        .foregroundColor(SalfordTheme.textMuted)
                    }
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 200)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
            .accessibilityLabel(image == nil ? "لا توجد صورة" : "صورة القطعة")

            HStack(spacing: SalfordSpacing.m) {
                Button {
                    showCameraPicker = true
                } label: {
                    Label("الكاميرا", systemImage: "camera.fill")
                }
                .buttonStyle(.salfordPrimary)

                Button {
                    showLibraryPicker = true
                } label: {
                    Label("الألبوم", systemImage: "photo.on.rectangle")
                }
                .buttonStyle(.salfordSecondary)

                if image != nil {
                    Button(role: .destructive) {
                        imageFile = nil
                        legacyImageBase64 = nil
                    } label: {
                        Image(systemName: "trash")
                    }
                    .buttonStyle(SalfordButtonStyle(kind: .destructive, fullWidth: false))
                    .accessibilityLabel("حذف الصورة")
                }
            }
            .listRowInsets(EdgeInsets(top: 4, leading: 8, bottom: 8, trailing: 8))
            .listRowBackground(Color.clear)
        }
    }

    private func labeledNumberField(_ title: String, text: Binding<String>, kind: NumberInput.Kind, suffix: String) -> some View {
        HStack {
            Text(title)
            Spacer()
            TextField("0", text: text)
                .numericInput(text, kind)
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: 120)
            Text(suffix)
                .foregroundColor(SalfordTheme.textMuted)
        }
    }

    private func fieldError(_ text: String) -> some View {
        Label(text, systemImage: "exclamationmark.circle.fill")
            .font(.system(.footnote, weight: .semibold))
            .foregroundColor(SalfordTheme.dangerRed)
    }

    // MARK: Load / save

    private func load() {
        guard let p = product else {
            // New piece: first category of this system (jewelry or scarves).
            category = store.categories.first ?? "أخرى"
            return
        }
        name = p.name
        sku = p.sku
        category = store.categories.contains(p.category) ? p.category : "أخرى"
        brand = p.brand ?? ""
        color = p.color ?? ""
        costPrice = NumberInput.editable(p.costPrice)
        sellPrice = NumberInput.editable(p.sellPrice)
        stock = "\(p.stock)"
        size = p.size ?? ""
        lowStockAlert = "\(p.lowStockAlert)"
        imageFile = p.imageFile
        legacyImageBase64 = p.imageBase64
    }

    private func savePiece() {
        triedToSave = true
        guard !nameMissing else {
            formError = "يرجى إدخال اسم القطعة"
            return
        }
        // Never save a price that was left empty or mistyped as 0.
        guard let sell = sellValue, sell > 0 else {
            formError = "يرجى إدخال سعر البيع (أرقام 0-9 فقط)"
            return
        }
        guard let cost = costValue else {
            formError = "يرجى إدخال سعر التكلفة (أرقام 0-9 فقط). أدخل 0 إذا كانت التكلفة غير معروفة."
            return
        }
        guard let stk = NumberInput.integer(stock) else {
            formError = "يرجى إدخال الكمية المتوفرة في المخزن"
            return
        }
        let alertLevel = NumberInput.integer(lowStockAlert) ?? 3

        // The USD cost records the exchange rate on the day the piece was bought.
        // Keep it on edit unless the cost price itself was changed.
        let costRate: Double?
        let costUSD: Double?
        if let p = product, abs(p.costPrice - cost) < 0.0005 {
            costRate = p.costRate
            costUSD = p.costUSD
        } else {
            let rate = store.exchangeRate > 0 ? store.exchangeRate : 7.0
            costRate = rate
            costUSD = cost / rate
        }

        let trimmedColor = color.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedSize = size.trimmingCharacters(in: .whitespacesAndNewlines)

        let newProd = Product(
            id: product?.id ?? 0,
            sku: sku.trimmingCharacters(in: .whitespacesAndNewlines),
            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
            category: category,
            costPrice: Money.round(cost),
            sellPrice: Money.round(sell),
            stock: stk,
            lowStockAlert: alertLevel,
            size: trimmedSize.isEmpty ? nil : trimmedSize,
            color: trimmedColor.isEmpty ? nil : trimmedColor,
            imageBase64: legacyImageBase64,
            costRate: costRate,
            costUSD: costUSD,
            createdAt: product?.createdAt ?? store.nowTimestamp(),
            imageFile: imageFile,
            brand: brand.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : brand
        )
        if let error = store.saveProduct(newProd) {
            formError = error
            return
        }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        dismiss()
    }
}
