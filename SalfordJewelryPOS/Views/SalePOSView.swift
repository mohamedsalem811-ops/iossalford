import SwiftUI

/// Selling screen: find a piece (search / category), tap to add it to the cart,
/// then complete the sale in the checkout sheet.
struct SalePOSView: View {
    @EnvironmentObject var store: POSDataStore

    @State private var search: String = ""
    @State private var category: String = "الكل"
    @State private var brand: String = "الكل"
    @State private var showCheckout: Bool = false
    @State private var alertMessage: String? = nil
    /// Scarves: the design whose sizes are being chosen.
    @State private var pickingDesign: POSDataStore.ScarfDesign? = nil

    private var filteredProducts: [Product] {
        let q = NumberInput.latinDigits(search).trimmingCharacters(in: .whitespaces)
        return store.products.filter { p in
            (category == "الكل" || p.category == category)
                && (brand == "الكل" || (brand == POSDataStore.noBrandLabel ? p.brand == nil : p.brand == brand))
                && (q.isEmpty || p.name.localizedCaseInsensitiveContains(q) || p.sku.localizedCaseInsensitiveContains(q)
                    || (p.brand ?? "").localizedCaseInsensitiveContains(q))
        }
        // Pieces in stock first, then by name.
        .sorted { ($0.isOutOfStock ? 1 : 0, $0.name) < ($1.isOutOfStock ? 1 : 0, $1.name) }
    }

    private var sellableSets: [JewelrySet] {
        store.sets.filter { !$0.items.isEmpty }
    }

    private let columns = [GridItem(.adaptive(minimum: 150), spacing: SalfordSpacing.m)]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SalfordSpacing.l) {
                if !store.brandsInUse.isEmpty {
                    BrandChips(brands: store.brandsInUse, selected: $brand)
                }
                categoryChips

                if !sellableSets.isEmpty && search.isEmpty {
                    bundlesRow
                }

                if store.products.isEmpty {
                    SalfordEmptyState(icon: "sparkles", title: "لا توجد قطع بعد",
                                      message: "أضف القطع من تبويب «المنتجات» لتظهر هنا للبيع.")
                } else if filteredProducts.isEmpty {
                    SalfordEmptyState(icon: "magnifyingglass", title: "لا توجد نتائج",
                                      message: "جرّب اسماً آخر أو كود القطعة، أو اختر «الكل».")
                } else {
                    LazyVGrid(columns: columns, spacing: SalfordSpacing.m) {
                        if store.line == .scarves {
                            // One card per design; tapping it asks for the size.
                            ForEach(store.scarfDesigns(from: filteredProducts)) { design in
                                ScarfSaleCard(design: design) {
                                    // Show every size of the design, not only the ones matching the filters.
                                    pickingDesign = store.scarfDesigns().first { $0.id == design.id } ?? design
                                }
                            }
                        } else {
                            ForEach(filteredProducts) { product in
                                ProductSaleCard(product: product, inCart: store.cartQuantity(for: product.id)) {
                                    add(product)
                                }
                            }
                        }
                    }
                }
            }
            .padding(SalfordSpacing.l)
            .padding(.bottom, store.cart.isEmpty ? 0 : 70)
        }
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("البيع")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $search, prompt: "اسم القطعة أو الكود أو الماركة")
        .safeAreaInset(edge: .bottom) {
            if !store.cart.isEmpty {
                cartBar
            }
        }
        .sheet(item: $pickingDesign) { design in
            ScarfSizePickerSheet(design: design)
                .environmentObject(store)
                .environment(\.layoutDirection, .rightToLeft)
        }
        .sheet(isPresented: $showCheckout) {
            NavigationStack {
                CheckoutSheet()
            }
            .environmentObject(store)
            .environment(\.layoutDirection, .rightToLeft)
        }
        .alert("تنبيه", isPresented: Binding(get: { alertMessage != nil }, set: { if !$0 { alertMessage = nil } })) {
            Button("حسناً", role: .cancel) {}
        } message: {
            Text(alertMessage ?? "")
        }
    }

    // MARK: Pieces

    private var categoryChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: SalfordSpacing.s) {
                ForEach(["الكل"] + store.categories, id: \.self) { cat in
                    let selected = category == cat
                    Button {
                        category = cat
                    } label: {
                        Text(cat)
                            .font(.system(.subheadline, weight: .semibold))
                            .padding(.horizontal, SalfordSpacing.l)
                            .frame(minHeight: 36)
                            .background(selected ? SalfordTheme.silverLight : SalfordTheme.bgCard)
                            .foregroundColor(selected ? SalfordTheme.onPrimary : SalfordTheme.textPrimary)
                            .clipShape(Capsule())
                            .overlay(Capsule().stroke(SalfordTheme.borderSubtle, lineWidth: selected ? 0 : 1))
                    }
                    .accessibilityAddTraits(selected ? .isSelected : [])
                }
            }
        }
    }

    private var bundlesRow: some View {
        VStack(alignment: .leading, spacing: SalfordSpacing.s) {
            SalfordSectionTitle(title: "الأطقم", icon: "sparkles")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: SalfordSpacing.m) {
                    ForEach(sellableSets) { jset in
                        let available = store.availableBundles(jset)
                        Button {
                            if let problem = store.addSetToCart(jset) {
                                alertMessage = "لم تتم إضافة الطقم:\n" + problem.message
                                UINotificationFeedbackGenerator().notificationOccurred(.error)
                            } else {
                                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                            }
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(jset.name)
                                    .font(.system(.subheadline, weight: .bold))
                                    .foregroundColor(SalfordTheme.textPrimary)
                                    .lineLimit(1)
                                Text(Money.lyd(store.bundlePrice(of: jset)))
                                    .font(.system(.footnote, weight: .bold))
                                    .foregroundColor(SalfordTheme.emeraldSuccess)
                                Text("بدلاً من \(Money.lyd(store.listPrice(of: jset)))")
                                    .font(.system(.caption))
                                    .strikethrough()
                                    .foregroundColor(SalfordTheme.textMuted)
                                Text(available > 0 ? "متاح: \(available)" : "غير متوفر")
                                    .font(.system(.caption, weight: .semibold))
                                    .foregroundColor(available > 0 ? SalfordTheme.textMuted : SalfordTheme.dangerRed)
                            }
                            .padding(SalfordSpacing.m)
                            .frame(width: 180, alignment: .leading)
                            .salfordCard(borderColor: SalfordTheme.gold.opacity(0.35))
                            .opacity(available > 0 ? 1 : 0.5)
                        }
                        .buttonStyle(.plain)
                        .disabled(available == 0)
                    }
                }
            }
        }
    }

    private func add(_ product: Product) {
        if let problem = store.addToCart(product: product, quantity: 1, unitPrice: product.sellPrice) {
            alertMessage = problem.message
            UINotificationFeedbackGenerator().notificationOccurred(.error)
        } else {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        }
    }

    // MARK: Cart bar

    private var cartBar: some View {
        Button {
            showCheckout = true
        } label: {
            HStack(spacing: SalfordSpacing.m) {
                Image(systemName: "cart.fill")
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(store.cartPieces) قطعة في السلة")
                        .font(.system(.footnote, weight: .semibold))
                    Text(Money.lyd(store.cartTotal))
                        .font(.system(.headline, weight: .heavy))
                }
                Spacer()
                Text("إتمام البيع")
                    .font(.system(.subheadline, weight: .bold))
                Image(systemName: "chevron.left")
            }
            .padding(.horizontal, SalfordSpacing.l)
            .frame(minHeight: 60)
            .background(SalfordTheme.silverGradient)
            .foregroundColor(SalfordTheme.onPrimary)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .shadow(color: .black.opacity(0.2), radius: 8, y: 2)
        }
        .padding(.horizontal, SalfordSpacing.l)
        .padding(.bottom, SalfordSpacing.s)
        .accessibilityLabel("إتمام البيع، \(store.cartPieces) قطعة، المجموع \(Money.lyd(store.cartTotal))")
    }
}

/// One piece in the selling grid. Tap adds one to the cart.
struct ProductSaleCard: View {
    let product: Product
    let inCart: Int
    let onAdd: () -> Void

    private var available: Int { product.stock - inCart }

    var body: some View {
        Button(action: onAdd) {
            VStack(alignment: .leading, spacing: SalfordSpacing.s) {
                ZStack(alignment: .topLeading) {
                    Group {
                        if let img = ProductImageHelper.image(for: product) {
                            Image(uiImage: img)
                                .resizable()
                                .scaledToFill()
                        } else {
                            ZStack {
                                SalfordTheme.royalNavyMid
                                Image(systemName: "sparkles")
                                    .font(.system(.title2))
                                    .foregroundColor(SalfordTheme.textMuted)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 110)
                    .clipped()

                    if inCart > 0 {
                        Text("×\(inCart)")
                            .font(.system(.caption, weight: .heavy))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(SalfordTheme.gold)
                            .foregroundColor(.white)
                            .clipShape(Capsule())
                            .padding(6)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                if let brand = product.brand {
                    BrandTag(name: brand)
                }
                Text(product.name)
                    .font(.system(.subheadline, weight: .semibold))
                    .foregroundColor(SalfordTheme.textPrimary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)

                HStack {
                    Text(Money.lyd(product.sellPrice))
                        .font(.system(.subheadline, weight: .heavy))
                        .foregroundColor(SalfordTheme.goldLight)
                    Spacer(minLength: 4)
                    stockBadge
                }
            }
            .padding(SalfordSpacing.s)
            .salfordCard()
            .opacity(available > 0 ? 1 : 0.55)
        }
        .buttonStyle(.plain)
        .disabled(available <= 0)
        .accessibilityLabel("\(product.name)، \(Money.lyd(product.sellPrice))، المتوفر \(product.stock)")
        .accessibilityHint(available > 0 ? "اضغط لإضافة قطعة إلى السلة" : "غير متوفر")
    }

    @ViewBuilder private var stockBadge: some View {
        if product.isOutOfStock {
            Text("نفد").font(.system(.caption, weight: .bold)).foregroundColor(SalfordTheme.dangerRed)
        } else if available <= 0 {
            Text("كله في السلة").font(.system(.caption2, weight: .bold)).foregroundColor(SalfordTheme.warningAmber)
        } else {
            Text("\(available) متوفر")
                .font(.system(.caption, weight: .semibold))
                .foregroundColor(product.isLowStock ? SalfordTheme.warningAmber : SalfordTheme.textMuted)
        }
    }
}

/// Review the cart and complete the sale: lines, customer, payment, exchange rate.
struct CheckoutSheet: View {
    @EnvironmentObject var store: POSDataStore
    @Environment(\.dismiss) private var dismiss

    @State private var paymentMethod: String = "كاش"
    @State private var customerName: String = ""
    @State private var customerPhone: String = ""
    @State private var customerArea: String = ""
    @State private var note: String = ""
    @State private var rateText: String = ""
    @State private var problems: [String] = []
    @State private var confirmClear: Bool = false

    private let paymentMethods = ["كاش", "بطاقة", "تحويل", "آجل"]

    private var rate: Double? {
        guard let r = NumberInput.decimal(rateText), r > 0 else { return nil }
        return r
    }

    var body: some View {
        Form {
            Section {
                if store.cart.isEmpty {
                    Text("السلة فارغة").foregroundColor(SalfordTheme.textMuted)
                }
                ForEach(store.cart) { item in
                    CartLineEditor(item: item) { message in
                        problems = [message]
                    }
                }
            } header: {
                HStack {
                    Text("السلة")
                    Spacer()
                    if !store.cart.isEmpty {
                        Button("إفراغ") { confirmClear = true }
                            .font(.system(.footnote, weight: .bold))
                            .foregroundColor(SalfordTheme.dangerRed)
                    }
                }
            }

            Section("الزبون") {
                TextField("الاسم (يظهر في الفاتورة)", text: $customerName)
                let suggestions = store.customerSuggestions(for: customerName.isEmpty ? customerPhone : customerName)
                    .filter { $0.name != customerName || ($0.phone ?? "") != customerPhone }
                if !suggestions.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: SalfordSpacing.s) {
                            ForEach(suggestions) { c in
                                Button {
                                    customerName = c.name
                                    customerPhone = c.phone ?? ""
                                    customerArea = c.area ?? ""
                                } label: {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(c.name).font(.system(.footnote, weight: .bold))
                                        Text(c.phone ?? "بدون هاتف").font(.system(.caption2)).foregroundColor(SalfordTheme.textMuted)
                                    }
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(SalfordTheme.royalNavyMid)
                                    .foregroundColor(SalfordTheme.textPrimary)
                                    .clipShape(RoundedRectangle(cornerRadius: 9))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
                TextField("رقم الهاتف", text: $customerPhone)
                    .numericInput($customerPhone, .phone)
                TextField("المنطقة / المدينة", text: $customerArea)
            }

            Section {
                Picker("طريقة الدفع", selection: $paymentMethod) {
                    ForEach(paymentMethods, id: \.self) { Text($0).tag($0) }
                }
                .pickerStyle(.segmented)
                if POSDataStore.isCredit(paymentMethod) {
                    Label("بيع آجل: يُسجل المبلغ ديناً على الزبون — أدخل اسمه أو رقم هاتفه.",
                          systemImage: "creditcard.trianglebadge.exclamationmark")
                        .font(.system(.footnote, weight: .semibold))
                        .foregroundColor(SalfordTheme.warningAmber)
                }
                HStack {
                    Text("سعر صرف الدولار")
                    Spacer()
                    TextField("7.00", text: $rateText)
                        .numericInput($rateText, .decimal)
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: 110)
                }
                TextField("ملاحظة على البيعة (اختياري)", text: $note)
            } header: {
                Text("الدفع")
            }

            Section {
                summaryRow("المجموع", Money.lyd(store.cartTotal), bold: true)
                summaryRow("الربح", Money.lyd(store.cartProfit),
                           color: store.cartProfit >= 0 ? SalfordTheme.emeraldSuccess : SalfordTheme.dangerRed)
                if let r = rate {
                    summaryRow("بالدولار", String(format: "%.2f $", store.cartTotal / r))
                }
            }

            if !problems.isEmpty {
                Section {
                    ForEach(problems, id: \.self) { p in
                        Label(p, systemImage: "exclamationmark.triangle.fill")
                            .font(.system(.footnote, weight: .semibold))
                            .foregroundColor(SalfordTheme.dangerRed)
                    }
                }
            }

            Section {
                Button {
                    confirm()
                } label: {
                    Label("تأكيد البيع وإصدار الفاتورة", systemImage: "checkmark.seal.fill")
                }
                .buttonStyle(.salfordSuccess)
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
                .disabled(store.cart.isEmpty)
            }
        }
        .scrollContentBackground(.hidden)
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("إتمام البيع")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("رجوع") { dismiss() }
            }
        }
        .onAppear {
            if rateText.isEmpty { rateText = NumberInput.editable(store.exchangeRate) }
        }
        .confirmationDialog("إفراغ السلة بالكامل؟", isPresented: $confirmClear, titleVisibility: .visible) {
            Button("إفراغ السلة", role: .destructive) {
                store.cart.removeAll()
                dismiss()
            }
            Button("إلغاء", role: .cancel) {}
        } message: {
            Text("ستُزال كل القطع من السلة. لا يتأثر المخزون لأن السلة لم تُبع بعد.")
        }
    }

    private func summaryRow(_ title: String, _ value: String, bold: Bool = false, color: Color = SalfordTheme.textPrimary) -> some View {
        HStack {
            Text(title).font(.system(.body, weight: bold ? .bold : .regular))
            Spacer()
            Text(value).font(.system(.body, weight: bold ? .heavy : .semibold)).foregroundColor(color)
        }
    }

    private func confirm() {
        guard let r = rate else {
            problems = ["يرجى إدخال سعر صرف الدولار الحالي"]
            return
        }
        store.exchangeRate = r
        let result = store.checkoutCart(
            saleRate: r,
            paymentMethod: paymentMethod,
            customerName: customerName,
            customerPhone: customerPhone,
            customerArea: customerArea,
            note: note
        )
        guard result.isEmpty else {
            problems = result.map(\.message)
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            return
        }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        // The receipt opens in its own sheet; close this one first (only one sheet can show at a time).
        store.showGiftReceiptStudio = false
        dismiss()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) {
            store.showGiftReceiptStudio = true
        }
    }
}

/// One cart line: quantity and price can be changed; bundle pieces can only be removed (whole bundle).
struct CartLineEditor: View {
    @EnvironmentObject var store: POSDataStore
    let item: CartItem
    let onProblem: (String) -> Void
    @State private var priceText: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: SalfordSpacing.s) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(store.displayName(for: item.product))
                        .font(.system(.subheadline, weight: .bold))
                        .foregroundColor(SalfordTheme.textPrimary)
                    Text(item.product.sku)
                        .font(.system(.caption))
                        .foregroundColor(SalfordTheme.textMuted)
                    if let setName = item.setName {
                        Label("ضمن طقم: \(setName)", systemImage: "sparkles")
                            .font(.system(.caption, weight: .bold))
                            .foregroundColor(SalfordTheme.goldLight)
                    }
                    if let warning = stockWarning {
                        Label(warning, systemImage: "exclamationmark.triangle.fill")
                            .font(.system(.caption, weight: .bold))
                            .foregroundColor(SalfordTheme.dangerRed)
                    }
                }
                Spacer()
                Text(Money.lyd(item.subtotal))
                    .font(.system(.subheadline, weight: .heavy))
                    .foregroundColor(SalfordTheme.textPrimary)
            }

            HStack(spacing: SalfordSpacing.m) {
                if item.bundleGroup == nil {
                    Stepper(value: Binding(
                        get: { item.quantity },
                        set: { newValue in
                            if let problem = store.setCartQuantity(item.id, to: newValue) { onProblem(problem.message) }
                        }
                    ), in: 1...99) {
                        Text("الكمية: \(item.quantity)").font(.system(.footnote, weight: .semibold))
                    }

                    TextField("السعر", text: $priceText)
                        .numericInput($priceText, .decimal)
                        .multilineTextAlignment(.center)
                        .frame(width: 90)
                        .padding(.vertical, 6)
                        .background(SalfordTheme.fieldBg)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .onChange(of: priceText) { newValue in
                            if let p = NumberInput.decimal(newValue) { store.setCartUnitPrice(item.id, to: p) }
                        }
                        .accessibilityLabel("سعر القطعة")
                } else {
                    Text("\(item.quantity) × \(Money.lyd(item.unitPrice))")
                        .font(.system(.footnote))
                        .foregroundColor(SalfordTheme.textMuted)
                    Spacer()
                }

                Button(role: .destructive) {
                    store.removeFromCart(item)
                } label: {
                    Image(systemName: "trash")
                }
                .buttonStyle(.borderless)
                .accessibilityLabel(item.bundleGroup == nil ? "حذف من السلة" : "حذف الطقم كاملاً من السلة")
            }
        }
        .padding(.vertical, 4)
        .onAppear { priceText = NumberInput.editable(item.unitPrice) }
    }

    private var stockWarning: String? {
        guard let current = store.products.first(where: { $0.id == item.product.id }) else {
            return "القطعة حُذفت من المخزون — احذفها من السلة"
        }
        let inCart = store.cartQuantity(for: current.id)
        return inCart > current.stock ? "المتوفر الآن \(current.stock) فقط" : nil
    }
}
