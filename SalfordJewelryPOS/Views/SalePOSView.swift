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
                        if let p = store.products.first(where: { $0.id == newId }) {
                            unitPriceText = String(format: "%.0f", p.sellPrice)
                        }
                    }

                    if let prod = selectedProduct {
                        HStack(spacing: 12) {
                            SalfordProductThumbnailView(imageBase64: prod.imageBase64, size: 60, cornerRadius: 12)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("الكود: \(prod.sku)")
                                    .font(.system(size: 11.5, weight: .semibold))
                                    .foregroundColor(SalfordTheme.silverAccent)
                                Text("اللون: \(prod.color ?? "غير محدد") • المتوفر: \(prod.stock)")
                                    .font(.system(size: 11.5))
                                    .foregroundColor(SalfordTheme.textMuted)
                            }
                            Spacer()
                            Stepper("الكمية: \(quantity)", value: $quantity, in: 1...max(1, prod.stock))
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
                                .keyboardType(.decimalPad)
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
                                .keyboardType(.decimalPad)
                                .padding(10)
                                .background(SalfordTheme.bgElevated)
                                .foregroundColor(.white)
                                .cornerRadius(10)
                        }
                    }

                    // Live Profit Preview Strip
                    if let prod = selectedProduct {
                        let unitP = Double(unitPriceText) ?? prod.sellPrice
                        let rate = Double(liveRateText) ?? store.exchangeRate
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
                            Text("سلة البيعة الموحدة (\(store.cart.count) قطع)")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(SalfordTheme.silverLight)
                            Spacer()
                            Button("إفراغ السلة") {
                                store.cart.removeAll()
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

                    HStack(spacing: 10) {
                        TextField("رقم الهاتف", text: $customerPhone)
                            .keyboardType(.phonePad)
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
                unitPriceText = String(format: "%.0f", first.sellPrice)
            }
            if liveRateText.isEmpty {
                liveRateText = String(format: "%.2f", store.exchangeRate)
            }
        }
        .alert("تنبيه", isPresented: $showAlert) {
            Button("حسناً", role: .cancel) {}
        } message: {
            Text(alertMessage)
        }
    }

    private func addToCart() {
        guard let prod = selectedProduct else { return }
        let unitP = Double(unitPriceText) ?? prod.sellPrice
        if prod.stock < quantity {
            alertMessage = "الكمية المطلوبة أكبر من المخزون المتوفر (\(prod.stock))"
            showAlert = true
            return
        }
        store.cart.append(CartItem(product: prod, quantity: quantity, unitPrice: unitP))
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    private func completeDirectSale() {
        guard let prod = selectedProduct else { return }
        guard let rate = Double(liveRateText), rate > 0 else {
            alertMessage = "يرجى إدخال سعر الصرف الحالي للدولار"
            showAlert = true
            return
        }
        if prod.stock < quantity {
            alertMessage = "الكمية المطلوبة غير متوفرة في المخزن"
            showAlert = true
            return
        }
        store.exchangeRate = rate
        let unitP = Double(unitPriceText) ?? prod.sellPrice
        store.recordSingleSale(
            product: prod,
            quantity: quantity,
            actualPrice: unitP,
            saleRate: rate,
            paymentMethod: paymentMethod,
            customerName: customerName,
            customerPhone: customerPhone,
            customerArea: customerArea,
            note: saleNote
        )
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    private func checkoutUnifiedCart() {
        guard let rate = Double(liveRateText), rate > 0 else {
            alertMessage = "يرجى إدخال سعر الصرف الحالي للدولار"
            showAlert = true
            return
        }
        store.exchangeRate = rate
        store.checkoutCart(
            saleRate: rate,
            paymentMethod: paymentMethod,
            customerName: customerName,
            customerPhone: customerPhone,
            customerArea: customerArea,
            note: saleNote
        )
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }
}
