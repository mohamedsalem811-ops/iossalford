import SwiftUI

struct SalePOSView: View {
    @EnvironmentObject var store: POSDataStore

    @State private var selectedProductId: Int = 0
    @State private var quantity: Int = 1
    @State private var unitPriceText: String = ""
    @State private var liveRateText: String = ""
    @State private var paymentMethod: String = "كاش"
    @State private var customerName: String = ""
    @State private var customerPhone: String = ""
    @State private var customerArea: String = ""
    @State private var saleNote: String = ""
    @State private var alertMessage: String = ""
    @State private var showAlert: Bool = false
    @State private var confirmClearCart: Bool = false

    let paymentMethods = ["كاش", "بطاقة", "تحويل", "آجل"]

    private var selectedProduct: Product? {
        store.products.first(where: { $0.id == selectedProductId }) ?? store.products.first
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                // Product Picker Card
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Image(systemName: "sparkles")
                            .foregroundColor(SalfordTheme.silverAccent)
                        Text("اختيار القطعة وتفاصيل السعر")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(SalfordTheme.silverLight)
                        Spacer()
                    }

                    Picker("اختر المنتج", selection: $selectedProductId) {
                        ForEach(store.products) { product in
                            Text("\(product.name) (\(product.stock) متوفر) - \(Int(product.sellPrice)) د.ل")
                                .tag(product.id)
                        }
                    }
                    .pickerStyle(.menu)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(SalfordTheme.bgElevated)
                    .cornerRadius(10)
                    .onChange(of: selectedProductId) { newId in
                        quantity = 1
                        if let p = store.products.first(where: { $0.id == newId }) {
                            unitPriceText = NumberInput.editable(p.sellPrice)
                        }
                    }

                    if let prod = selectedProduct {
                        HStack(spacing: 12) {
                            SalfordProductThumbnailView(image: ProductImageHelper.image(for: prod), size: 60, cornerRadius: 12)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("الكود: \(prod.sku)")
                                    .font(.system(size: 11.5, weight: .semibold))
                                    .foregroundColor(SalfordTheme.silverAccent)
                                Text("اللون: \(prod.color ?? "غير محدد") • المتوفر: \(prod.stock)" + (store.cartQuantity(for: prod.id) > 0 ? " (منها \(store.cartQuantity(for: prod.id)) في السلة)" : ""))
                                    .font(.system(size: 11.5))
                                    .foregroundColor(SalfordTheme.textMuted)
                            }
                            Spacer()
                            Stepper("الكمية: \(quantity)", value: $quantity, in: 1...max(1, prod.stock - store.cartQuantity(for: prod.id)))
                                .font(.system(size: 12.5, weight: .bold))
                                .foregroundColor(.white)
                        }
                    }

                    HStack(spacing: 10) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("سعر البيع الفعلي (د.ل)")
                                .font(.system(size: 11.5, weight: .semibold))
                                .foregroundColor(SalfordTheme.textMuted)
                            TextField("السعر", text: $unitPriceText)
                                .numericInput($unitPriceText, .decimal)
                                .padding(10)
                                .background(SalfordTheme.bgElevated)
                                .foregroundColor(.white)
                                .cornerRadius(10)
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            Text("سعر صرف الدولار الآن بالدينار *")
                                .font(.system(size: 11.5, weight: .bold))
                                .foregroundColor(SalfordTheme.emeraldSuccess)
                            TextField("7.00", text: $liveRateText)
                                .numericInput($liveRateText, .decimal)
                                .padding(10)
                                .background(SalfordTheme.bgElevated)
                                .foregroundColor(.white)
                                .cornerRadius(10)
                        }
                    }

                    // Live Profit Preview Strip
                    if let prod = selectedProduct {
                        let unitP = NumberInput.decimal(unitPriceText) ?? prod.sellPrice
                        let rate = NumberInput.decimal(liveRateText) ?? store.exchangeRate
                        let totalSell = unitP * Double(quantity)
                        let profit = totalSell - (prod.costPrice * Double(quantity))
                        let profitUSD = rate > 0 ? profit / rate : 0

                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("الإجمالي: \(String(format: "%.0f د.ل", totalSell))")
                                    .font(.system(size: 13, weight: .heavy))
                                    .foregroundColor(.white)
                                Text(String(format: "المعادل بالدولار: %.2f دولار", rate > 0 ? totalSell / rate : 0))
                                    .font(.system(size: 11))
                                    .foregroundColor(SalfordTheme.silverAccent)
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 2) {
                                Text(String(format: "الربح: %.0f د.ل", profit))
                                    .font(.system(size: 13, weight: .heavy))
                                    .foregroundColor(profit >= 0 ? SalfordTheme.emeraldSuccess : SalfordTheme.dangerRed)
                                Text(String(format: "ربح الدولار: %.2f دولار", profitUSD))
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundColor(SalfordTheme.emeraldSuccess)
                            }
                        }
                        .padding(10)
                        .background(SalfordTheme.royalNavyTop.opacity(0.55))
                        .cornerRadius(10)
                    }

                    // Action Buttons: Add to Multi-Item Cart OR Instant Single Sale
                    HStack(spacing: 10) {
                        Button {
                            addToCart()
                        } label: {
                            Label("إضافة للسلة (\(store.cart.count))", systemImage: "cart.badge.plus")
                                .font(.system(size: 13, weight: .bold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(SalfordTheme.royalNavyMid)
                                .foregroundColor(SalfordTheme.silverLight)
                                .cornerRadius(11)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 11)
                                        .stroke(SalfordTheme.silverAccent.opacity(0.45), lineWidth: 1)
                                )
                        }

                        Button {
                            completeDirectSale()
                        } label: {
                            Label("بيع فوري + فاتورة", systemImage: "checkmark.circle.fill")
                                .font(.system(size: 13, weight: .heavy))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(SalfordTheme.silverGradient)
                                .foregroundColor(SalfordTheme.bgPrimary)
                                .cornerRadius(11)
                        }
                    }
                }
                .salfordCard()

                // Unified Multi-Item Shopping Cart Section
                if !store.cart.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Image(systemName: "bag.fill")
                                .foregroundColor(SalfordTheme.emeraldSuccess)
                            Text("سلة البيعة الموحدة (\(store.cart.reduce(0) { $0 + $1.quantity }) قطع)")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(SalfordTheme.silverLight)
                            Spacer()
                            Button("إفراغ السلة") {
                                confirmClearCart = true
                            }
                            .font(.system(size: 11.5, weight: .bold))
                            .foregroundColor(SalfordTheme.dangerRed)
                        }

                        ForEach(store.cart) { item in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.product.name)
                                        .font(.system(size: 13, weight: .bold))
                                        .foregroundColor(.white)
                                    Text("\(item.product.sku) • \(item.quantity) × \(Int(item.unitPrice)) د.ل")
                                        .font(.system(size: 11))
                                        .foregroundColor(SalfordTheme.textMuted)
                                    if let warning = stockWarning(for: item) {
                                        Label(warning, systemImage: "exclamationmark.triangle.fill")
                                            .font(.system(size: 11, weight: .bold))
                                            .foregroundColor(SalfordTheme.dangerRed)
                                    }
                                }
                                Spacer()
                                Text(String(format: "%.0f د.ل", item.subtotal))
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundColor(SalfordTheme.silverLight)
                                Button {
                                    store.cart.removeAll { $0.id == item.id }
                                } label: {
                                    Image(systemName: "trash.fill")
                                        .foregroundColor(SalfordTheme.dangerRed)
                                        .padding(6)
                                }
                            }
                            .padding(.vertical, 4)
                        }

                        let cartTotal = store.cart.reduce(0.0) { $0 + $1.subtotal }
                        Button {
                            checkoutUnifiedCart()
                        } label: {
                            HStack {
                                Image(systemName: "printer.fill")
                                Text("اعتماد السلة وإصدار فاتورة موحدة (\(Int(cartTotal)) د.ل)")
                                    .font(.system(size: 13.5, weight: .heavy))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                            .background(SalfordTheme.emeraldSuccess)
                            .foregroundColor(.black)
                            .cornerRadius(12)
                        }
                    }
                    .salfordCard()
                }

                // Customer & Payment Info Card
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Image(systemName: "person.crop.circle.badge.plus")
                            .foregroundColor(SalfordTheme.silverAccent)
                        Text("بيانات الزبون وطريقة الدفع (تُحفظ تلقائياً)")
                            .font(.system(size: 13.5, weight: .bold))
                            .foregroundColor(SalfordTheme.silverLight)
                        Spacer()
                    }

                    Picker("طريقة الدفع", selection: $paymentMethod) {
                        ForEach(paymentMethods, id: \.self) { method in
                            Text(method).tag(method)
                        }
                    }
                    .pickerStyle(.segmented)

                    TextField("اسم الزبون (اختياري — يظهر في الفاتورة)", text: $customerName)
                        .padding(10)
                        .background(SalfordTheme.bgElevated)
                        .foregroundColor(.white)
                        .cornerRadius(10)

                    // Existing customers matching the name or phone: tap to fill in their details,
                    // so the sale is linked to them instead of creating a duplicate.
                    let suggestions = store.customerSuggestions(for: customerName.isEmpty ? customerPhone : customerName)
                        .filter { $0.name != customerName || ($0.phone ?? "") != customerPhone }
                    if !suggestions.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(suggestions) { c in
                                    Button {
                                        customerName = c.name
                                        customerPhone = c.phone ?? ""
                                        customerArea = c.area ?? ""
                                    } label: {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(c.name)
                                                .font(.system(size: 12, weight: .bold))
                                            Text(c.phone ?? "بدون هاتف")
                                                .font(.system(size: 10.5))
                                                .foregroundColor(SalfordTheme.textMuted)
                                        }
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 6)
                                        .background(SalfordTheme.royalNavyMid)
                                        .foregroundColor(SalfordTheme.silverLight)
                                        .cornerRadius(9)
                                    }
                                }
                            }
                        }
                    }

                    HStack(spacing: 10) {
                        TextField("رقم الهاتف", text: $customerPhone)
                            .numericInput($customerPhone, .phone)
                            .padding(10)
                            .background(SalfordTheme.bgElevated)
                            .foregroundColor(.white)
                            .cornerRadius(10)

                        TextField("المنطقة / المدينة", text: $customerArea)
                            .padding(10)
                            .background(SalfordTheme.bgElevated)
                            .foregroundColor(.white)
                            .cornerRadius(10)
                    }

                    TextField("ملاحظات البيعة", text: $saleNote)
                        .padding(10)
                        .background(SalfordTheme.bgElevated)
                        .foregroundColor(.white)
                        .cornerRadius(10)
                }
                .salfordCard()
            }
            .padding(14)
        }
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("تسجيل بيعة والسلة")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            if selectedProductId == 0, let first = store.products.first {
                selectedProductId = first.id
                unitPriceText = NumberInput.editable(first.sellPrice)
            }
            if liveRateText.isEmpty {
                liveRateText = NumberInput.editable(store.exchangeRate)
            }
        }
        .confirmationDialog("إفراغ السلة بالكامل؟", isPresented: $confirmClearCart, titleVisibility: .visible) {
            Button("إفراغ السلة", role: .destructive) { store.cart.removeAll() }
            Button("إلغاء", role: .cancel) {}
        } message: {
            Text("ستُزال كل القطع من السلة. لا يتأثر المخزون لأن السلة لم تُبع بعد.")
        }
        .alert("تنبيه", isPresented: $showAlert) {
            Button("حسناً", role: .cancel) {}
        } message: {
            Text(alertMessage)
        }
    }

    /// Shown under a cart line when the current stock no longer covers the cart.
    private func stockWarning(for item: CartItem) -> String? {
        guard let current = store.products.first(where: { $0.id == item.product.id }) else {
            return "القطعة حُذفت من المخزون — احذفها من السلة"
        }
        let inCart = store.cartQuantity(for: current.id)
        return inCart > current.stock ? "المتوفر الآن \(current.stock) فقط — عدّل السلة" : nil
    }

    private func showProblems(_ problems: [POSDataStore.SaleProblem], title: String) {
        alertMessage = ([title] + problems.map { "• " + $0.message }).joined(separator: "\n")
        showAlert = true
        UINotificationFeedbackGenerator().notificationOccurred(.error)
    }

    private func addToCart() {
        guard let prod = selectedProduct else { return }
        let unitP = NumberInput.decimal(unitPriceText) ?? prod.sellPrice
        if let problem = store.addToCart(product: prod, quantity: quantity, unitPrice: unitP) {
            showProblems([problem], title: "لم تتم الإضافة للسلة:")
            return
        }
        quantity = 1
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    private func completeDirectSale() {
        guard let prod = selectedProduct else { return }
        guard let rate = NumberInput.decimal(liveRateText), rate > 0 else {
            alertMessage = "يرجى إدخال سعر الصرف الحالي للدولار"
            showAlert = true
            return
        }
        store.exchangeRate = rate
        let unitP = NumberInput.decimal(unitPriceText) ?? prod.sellPrice
        if let problem = store.recordSingleSale(
            product: prod,
            quantity: quantity,
            actualPrice: unitP,
            saleRate: rate,
            paymentMethod: paymentMethod,
            customerName: customerName,
            customerPhone: customerPhone,
            customerArea: customerArea,
            note: saleNote
        ) {
            showProblems([problem], title: "لم تتم البيعة:")
            return
        }
        quantity = 1
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    private func checkoutUnifiedCart() {
        guard let rate = NumberInput.decimal(liveRateText), rate > 0 else {
            alertMessage = "يرجى إدخال سعر الصرف الحالي للدولار"
            showAlert = true
            return
        }
        store.exchangeRate = rate
        let problems = store.checkoutCart(
            saleRate: rate,
            paymentMethod: paymentMethod,
            customerName: customerName,
            customerPhone: customerPhone,
            customerArea: customerArea,
            note: saleNote
        )
        guard problems.isEmpty else {
            showProblems(problems, title: "لم يتم بيع أي قطعة — السلة محفوظة كما هي. يرجى تعديل:")
            return
        }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }
}
