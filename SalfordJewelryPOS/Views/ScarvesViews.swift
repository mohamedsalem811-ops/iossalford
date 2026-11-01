import SwiftUI

// MARK: - Products tab (scarves): designs with their sizes

/// Scarves products: one row per design showing every size's stock and the price range.
struct ScarvesProductsView: View {
    @EnvironmentObject var store: POSDataStore
    @State private var search: String = ""
    @State private var brand: String = "الكل"
    @State private var category: String = "الكل"
    @State private var size: String = "الكل"
    @State private var showNew: Bool = false
    @State private var editing: POSDataStore.ScarfDesign? = nil
    @State private var toDelete: POSDataStore.ScarfDesign? = nil

    private var designs: [POSDataStore.ScarfDesign] {
        let q = NumberInput.latinDigits(search).trimmingCharacters(in: .whitespaces)
        return store.scarfDesigns().filter { d in
            let p = d.first
            return (brand == "الكل" || (brand == POSDataStore.noBrandLabel ? p.brand == nil : p.brand == brand))
                && (category == "الكل" || p.category == category)
                && (size == "الكل" || d.sizes.contains { $0.size == size })
                && (q.isEmpty || p.name.localizedCaseInsensitiveContains(q) || (p.brand ?? "").localizedCaseInsensitiveContains(q)
                    || (p.color ?? "").localizedCaseInsensitiveContains(q) || d.sizes.contains { $0.sku.localizedCaseInsensitiveContains(q) })
        }
    }

    var body: some View {
        List {
            Section {
                ForEach(designs) { d in
                    Button {
                        editing = d
                    } label: {
                        ScarfDesignRow(design: d)
                    }
                    .buttonStyle(.plain)
                    .listRowBackground(SalfordTheme.bgCard)
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button(role: .destructive) {
                            toDelete = d
                        } label: {
                            Label("حذف", systemImage: "trash")
                        }
                    }
                    .contextMenu {
                        Button { editing = d } label: { Label("تعديل التصميم والمقاسات", systemImage: "pencil") }
                        Button(role: .destructive) { toDelete = d } label: { Label("حذف التصميم", systemImage: "trash") }
                    }
                }
            } header: {
                VStack(alignment: .leading, spacing: SalfordSpacing.s) {
                    if !store.brandsInUse.isEmpty {
                        BrandChips(brands: store.brandsInUse, selected: $brand)
                    }
                    chipRow(["الكل"] + store.categories, selection: $category)
                    if !store.scarfSizesInUse.isEmpty {
                        chipRow(["الكل"] + store.scarfSizesInUse, selection: $size, icon: "square.dashed")
                    }
                    Text("\(designs.count) تصميم • \(designs.reduce(0) { $0 + $1.totalStock }) قطعة")
                        .font(.system(.footnote))
                        .foregroundColor(SalfordTheme.textMuted)
                        .textCase(nil)
                }
                .padding(.vertical, SalfordSpacing.xs)
            }

            if designs.isEmpty {
                Section {
                    SalfordEmptyState(icon: "wind", title: store.products.isEmpty ? "لا توجد أوشحة بعد" : "لا توجد نتائج",
                                      message: store.products.isEmpty ? "اضغط ＋ لإضافة تصميم بمقاساته وأسعاره." : "غيّر البحث أو الفلاتر.")
                }
                .listRowBackground(Color.clear)
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(SalfordTheme.bgPrimary)
        .searchable(text: $search, prompt: "التصميم أو الماركة أو اللون")
        .navigationTitle("الأوشحة")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button { showNew = true } label: { Label("تصميم جديد", systemImage: "plus") }
            }
        }
        .sheet(isPresented: $showNew) {
            ScarfDesignForm(design: nil)
                .environment(\.layoutDirection, .rightToLeft)
        }
        .sheet(item: $editing) { d in
            ScarfDesignForm(design: d)
                .environment(\.layoutDirection, .rightToLeft)
        }
        .confirmDelete(
            $toDelete,
            title: { "حذف تصميم «\($0.first.name)»؟" },
            message: { d in "سيُحذف التصميم بكل مقاساته (\(d.sizes.count)) ومخزونها (\(d.totalStock) قطعة). المبيعات السابقة تبقى في السجل." },
            perform: { store.deleteScarfDesign($0) }
        )
    }

    private func chipRow(_ items: [String], selection: Binding<String>, icon: String? = nil) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: SalfordSpacing.s) {
                ForEach(items, id: \.self) { item in
                    let selected = selection.wrappedValue == item
                    Button {
                        selection.wrappedValue = item
                    } label: {
                        HStack(spacing: 4) {
                            if let icon, item != "الكل" { Image(systemName: icon).font(.system(.caption2)) }
                            Text(item)
                        }
                        .font(.system(.subheadline, weight: .semibold))
                        .padding(.horizontal, SalfordSpacing.m)
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

/// One design: photo, brand, name, material • colour, stock per size and price range.
struct ScarfDesignRow: View {
    let design: POSDataStore.ScarfDesign

    var body: some View {
        let p = design.first
        HStack(spacing: SalfordSpacing.m) {
            SalfordProductThumbnailView(image: ProductImageHelper.image(for: p), size: 60, cornerRadius: 12)
            VStack(alignment: .leading, spacing: 4) {
                if let b = p.brand { BrandTag(name: b) }
                Text(p.name)
                    .font(.system(.subheadline, weight: .bold))
                    .foregroundColor(SalfordTheme.textPrimary)
                    .lineLimit(2)
                Text([p.category, p.color].compactMap { $0 }.joined(separator: " • "))
                    .font(.system(.caption))
                    .foregroundColor(SalfordTheme.textMuted)
                // Stock per size: "90×90: 4 · 120×120: 2 · 140×140: 0"
                HStack(spacing: 6) {
                    ForEach(design.sizes) { s in
                        Text("\(s.size ?? "—"): \(s.stock)")
                            .font(.system(.caption2, weight: .bold))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background((s.isOutOfStock ? SalfordTheme.dangerRed : (s.isLowStock ? SalfordTheme.warningAmber : SalfordTheme.emeraldSuccess)).opacity(0.14))
                            .foregroundColor(s.isOutOfStock ? SalfordTheme.dangerRed : (s.isLowStock ? SalfordTheme.warningAmber : SalfordTheme.emeraldSuccess))
                            .clipShape(Capsule())
                    }
                }
            }
            Spacer(minLength: 4)
            VStack(alignment: .trailing, spacing: 2) {
                Text(design.minPrice == design.maxPrice ? Money.lyd(design.minPrice)
                     : "\(Money.plain(design.minPrice))–\(Money.lyd(design.maxPrice))")
                    .font(.system(.subheadline, weight: .heavy))
                    .foregroundColor(SalfordTheme.goldLight)
                    .multilineTextAlignment(.trailing)
                Text("\(design.totalStock) قطعة")
                    .font(.system(.caption))
                    .foregroundColor(SalfordTheme.textMuted)
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityHint("اضغط لتعديل التصميم والمقاسات")
    }
}

// MARK: - Design form

/// Add / edit a scarf design: shared details once, then one row per size with its own price/cost/stock.
struct ScarfDesignForm: View {
    @EnvironmentObject var store: POSDataStore
    @Environment(\.dismiss) private var dismiss
    let design: POSDataStore.ScarfDesign?

    @State private var name: String = ""
    @State private var brand: String = ""
    @State private var color: String = ""
    @State private var category: String = ""
    @State private var imageFile: String? = nil
    @State private var sizes: [POSDataStore.ScarfSizeInput] = []
    @State private var showCamera = false
    @State private var showLibrary = false
    @State private var formError: String? = nil

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    photoBlock
                }

                Section("التصميم") {
                    TextField("اسم التصميم — مثال: وشاح الحرير الكلاسيكي", text: $name)
                    BrandField(brand: $brand)
                    Picker("الخامة", selection: $category) {
                        ForEach(store.categories, id: \.self) { Text($0).tag($0) }
                    }
                    TextField("اللون / النقشة", text: $color)
                }

                Section {
                    ForEach($sizes) { $row in
                        ScarfSizeRowEditor(row: $row) {
                            sizes.removeAll { $0.id == row.id }
                        }
                    }
                    // Quick add for the usual sizes that aren't in the form yet.
                    let missing = POSDataStore.standardScarfSizes.filter { std in !sizes.contains { $0.size == std } }
                    if !missing.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: SalfordSpacing.s) {
                                ForEach(missing, id: \.self) { std in
                                    Button {
                                        sizes.append(POSDataStore.ScarfSizeInput(size: std))
                                    } label: {
                                        Label(std, systemImage: "plus")
                                            .font(.system(.footnote, weight: .bold))
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
                    Button {
                        sizes.append(POSDataStore.ScarfSizeInput())
                    } label: {
                        Label("مقاس آخر (اكتبه بنفسك)", systemImage: "plus.circle.fill")
                    }
                } header: {
                    Text("المقاسات والأسعار")
                } footer: {
                    Text("لكل مقاس سعره وتكلفته ومخزونه. اكتب أي مقاس، مثال: 70×70 أو 180×70.")
                }

                Section {
                    Button {
                        save()
                    } label: {
                        Label(design == nil ? "حفظ التصميم" : "حفظ التعديلات", systemImage: "checkmark.circle.fill")
                    }
                    .buttonStyle(.salfordSuccess)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                }
            }
            .scrollContentBackground(.hidden)
            .background(SalfordTheme.bgPrimary)
            .navigationTitle(design == nil ? "تصميم جديد" : "تعديل التصميم")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("إلغاء") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("حفظ") { save() }.font(.system(.body, weight: .bold))
                }
            }
            .onAppear(perform: load)
            .alert("لم يتم الحفظ", isPresented: Binding(get: { formError != nil }, set: { if !$0 { formError = nil } })) {
                Button("حسناً", role: .cancel) {}
            } message: {
                Text(formError ?? "")
            }
            .sheet(isPresented: $showCamera) {
                NativeImagePickerSheet(sourceType: .camera) { img in
                    if let f = ProductImageHelper.storeImage(img, prefix: store.line.imagePrefix) { imageFile = f }
                }
                .ignoresSafeArea()
            }
            .sheet(isPresented: $showLibrary) {
                NativeImagePickerSheet(sourceType: .photoLibrary) { img in
                    if let f = ProductImageHelper.storeImage(img, prefix: store.line.imagePrefix) { imageFile = f }
                }
                .ignoresSafeArea()
            }
        }
    }

    private var photoBlock: some View {
        VStack(spacing: SalfordSpacing.m) {
            ZStack {
                if let img = ProductImageHelper.image(named: imageFile) {
                    Image(uiImage: img).resizable().scaledToFill()
                } else {
                    ZStack {
                        SalfordTheme.fieldBg
                        VStack(spacing: SalfordSpacing.s) {
                            Image(systemName: "camera.viewfinder").font(.system(.largeTitle))
                            Text("صورة التصميم").font(.system(.subheadline, weight: .semibold))
                        }
                        .foregroundColor(SalfordTheme.textMuted)
                    }
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 180)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

            HStack(spacing: SalfordSpacing.m) {
                Button { showCamera = true } label: { Label("الكاميرا", systemImage: "camera.fill") }
                    .buttonStyle(.salfordPrimary)
                Button { showLibrary = true } label: { Label("الألبوم", systemImage: "photo.on.rectangle") }
                    .buttonStyle(.salfordSecondary)
                if imageFile != nil {
                    Button(role: .destructive) { imageFile = nil } label: { Image(systemName: "trash") }
                        .buttonStyle(SalfordButtonStyle(kind: .destructive, fullWidth: false))
                        .accessibilityLabel("حذف الصورة")
                }
            }
        }
        .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
        .listRowBackground(Color.clear)
    }

    private func load() {
        guard let d = design else {
            category = store.categories.first ?? "أخرى"
            // New design: the three usual sizes ready to fill in.
            sizes = POSDataStore.standardScarfSizes.map { POSDataStore.ScarfSizeInput(size: $0) }
            return
        }
        let p = d.first
        name = p.name
        brand = p.brand ?? ""
        color = p.color ?? ""
        category = store.categories.contains(p.category) ? p.category : (store.categories.last ?? "أخرى")
        imageFile = p.imageFile
        sizes = d.sizes.map {
            POSDataStore.ScarfSizeInput(productId: $0.id, size: $0.size ?? "",
                                        price: NumberInput.editable($0.sellPrice), cost: NumberInput.editable($0.costPrice),
                                        stock: "\($0.stock)", lowStockAlert: "\($0.lowStockAlert)")
        }
    }

    private func save() {
        // A design edited from an old single item gets a design id now.
        let existingId = design.flatMap { $0.first.designId } ?? (design == nil ? nil : UUID().uuidString)
        if let d = design, d.first.designId == nil, let id = existingId {
            for p in d.sizes { if let i = store.products.firstIndex(where: { $0.id == p.id }) { store.products[i].designId = id } }
        }
        if let error = store.saveScarfDesign(designId: existingId, name: name, brand: brand, color: color,
                                             category: category, imageFile: imageFile, sizes: sizes) {
            formError = error
            return
        }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        dismiss()
    }
}

/// One size in the design form: size, price, cost, stock, alert level.
struct ScarfSizeRowEditor: View {
    @Binding var row: POSDataStore.ScarfSizeInput
    let onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: SalfordSpacing.s) {
            HStack {
                Image(systemName: "square.dashed").foregroundColor(SalfordTheme.textMuted)
                TextField("المقاس — مثال 90×90", text: $row.size)
                    .font(.system(.body, weight: .bold))
                    .autocorrectionDisabled()
                Button(role: .destructive, action: onDelete) {
                    Image(systemName: "minus.circle.fill").foregroundColor(SalfordTheme.dangerRed)
                }
                .buttonStyle(.borderless)
                .accessibilityLabel("حذف هذا المقاس")
            }
            HStack(spacing: SalfordSpacing.s) {
                numberField("السعر", text: $row.price, kind: .decimal)
                numberField("التكلفة", text: $row.cost, kind: .decimal)
                numberField("الكمية", text: $row.stock, kind: .integer)
            }
        }
        .padding(.vertical, 4)
    }

    private func numberField(_ title: String, text: Binding<String>, kind: NumberInput.Kind) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.system(.caption2)).foregroundColor(SalfordTheme.textMuted)
            TextField("0", text: text)
                .numericInput(text, kind)
                .multilineTextAlignment(.center)
                .padding(.vertical, 6)
                .background(SalfordTheme.fieldBg)
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }
}

// MARK: - Selling: choose the size

/// Card in the selling grid for one design. Tapping opens the size picker.
struct ScarfSaleCard: View {
    @EnvironmentObject var store: POSDataStore
    let design: POSDataStore.ScarfDesign
    let onTap: () -> Void

    var body: some View {
        let p = design.first
        let available = design.sizes.reduce(0) { $0 + max(0, $1.stock - store.cartQuantity(for: $1.id)) }
        let inCart = design.sizes.reduce(0) { $0 + store.cartQuantity(for: $1.id) }
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: SalfordSpacing.s) {
                ZStack(alignment: .topLeading) {
                    Group {
                        if let img = ProductImageHelper.image(for: p) {
                            Image(uiImage: img).resizable().scaledToFill()
                        } else {
                            ZStack {
                                SalfordTheme.royalNavyMid
                                Image(systemName: "wind").font(.system(.title2)).foregroundColor(SalfordTheme.textMuted)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 110)
                    .clipped()
                    if inCart > 0 {
                        Text("×\(inCart)")
                            .font(.system(.caption, weight: .heavy))
                            .padding(.horizontal, 8).padding(.vertical, 4)
                            .background(store.line.accent)
                            .foregroundColor(.white)
                            .clipShape(Capsule())
                            .padding(6)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                if let b = p.brand { BrandTag(name: b) }
                Text(p.name)
                    .font(.system(.subheadline, weight: .semibold))
                    .foregroundColor(SalfordTheme.textPrimary)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text(design.sizes.compactMap(\.size).joined(separator: " • "))
                    .font(.system(.caption2))
                    .foregroundColor(SalfordTheme.textMuted)
                    .lineLimit(1)
                HStack {
                    Text(design.minPrice == design.maxPrice ? Money.lyd(design.minPrice) : "من \(Money.lyd(design.minPrice))")
                        .font(.system(.subheadline, weight: .heavy))
                        .foregroundColor(SalfordTheme.goldLight)
                    Spacer(minLength: 4)
                    Text(available > 0 ? "\(available) متوفر" : "نفد")
                        .font(.system(.caption, weight: .semibold))
                        .foregroundColor(available > 0 ? SalfordTheme.textMuted : SalfordTheme.dangerRed)
                }
            }
            .padding(SalfordSpacing.s)
            .salfordCard()
            .opacity(available > 0 ? 1 : 0.55)
        }
        .buttonStyle(.plain)
        .disabled(available <= 0)
        .accessibilityLabel("\(p.name)، المقاسات \(design.sizes.compactMap(\.size).joined(separator: "، "))")
        .accessibilityHint("اضغط لاختيار المقاس")
    }
}

/// Sheet listing the design's sizes; tap a size to add one to the cart.
struct ScarfSizePickerSheet: View {
    @EnvironmentObject var store: POSDataStore
    @Environment(\.dismiss) private var dismiss
    let design: POSDataStore.ScarfDesign
    @State private var message: String? = nil

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(design.sizes) { s in
                        let free = s.stock - store.cartQuantity(for: s.id)
                        Button {
                            if let problem = store.addToCart(product: s, quantity: 1, unitPrice: s.sellPrice) {
                                message = problem.message
                                UINotificationFeedbackGenerator().notificationOccurred(.error)
                            } else {
                                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                dismiss()
                            }
                        } label: {
                            HStack {
                                Image(systemName: "square.dashed").foregroundColor(store.line.accent)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(s.size ?? "—")
                                        .font(.system(.headline, weight: .bold))
                                        .foregroundColor(SalfordTheme.textPrimary)
                                    Text(free > 0 ? "\(free) متوفر" : "نفد")
                                        .font(.system(.caption))
                                        .foregroundColor(free > 0 ? SalfordTheme.textMuted : SalfordTheme.dangerRed)
                                }
                                Spacer()
                                Text(Money.lyd(s.sellPrice))
                                    .font(.system(.headline, weight: .heavy))
                                    .foregroundColor(SalfordTheme.goldLight)
                                Image(systemName: "plus.circle.fill")
                                    .foregroundColor(free > 0 ? store.line.accent : SalfordTheme.textMuted)
                            }
                            .frame(minHeight: SalfordSpacing.touch)
                        }
                        .disabled(free <= 0)
                        .listRowBackground(SalfordTheme.bgCard)
                    }
                } header: {
                    Text("اختر المقاس").textCase(nil)
                }
                if let message {
                    Section {
                        Label(message, systemImage: "exclamationmark.triangle.fill")
                            .foregroundColor(SalfordTheme.dangerRed)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(SalfordTheme.bgPrimary)
            .navigationTitle(design.first.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("إغلاق") { dismiss() } }
            }
        }
        .presentationDetents([.medium, .large])
    }
}
