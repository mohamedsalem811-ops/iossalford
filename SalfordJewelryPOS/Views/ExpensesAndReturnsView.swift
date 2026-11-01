import SwiftUI

struct ExpensesAndReturnsView: View {
    @EnvironmentObject var store: POSDataStore
    @State private var expenseToDelete: ExpenseRecord? = nil
    @State private var expDesc: String = ""
    @State private var expAmount: String = ""

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                // Add Expense Card
                VStack(alignment: .leading, spacing: 10) {
                    Text("تسجيل مصروف تشغيلي جديد")
                        .font(.system(.subheadline, weight: .bold))
                        .foregroundColor(SalfordTheme.silverLight)
                    TextField("بيان المصروف مثل تغليف أو إعلانات", text: $expDesc)
                        .salfordField()
                    TextField("القيمة بالدينار الليبي", text: $expAmount)
                        .numericInput($expAmount, .decimal)
                        .salfordField()
                    Button {
                        if let amt = NumberInput.decimal(expAmount), amt > 0, !expDesc.isEmpty {
                            store.addExpense(description: expDesc, amount: amt, monthYear: store.currentMonthYear())
                            expDesc = ""
                            expAmount = ""
                        }
                    } label: {
                        Text("إضافة المصروف")
                    }
                    .buttonStyle(.salfordPrimary)
                }
                .salfordCard()

                ReturnEntryCard()

                ReturnsHistoryList()

                // Expenses History
                ForEach(store.expenses) { exp in
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(exp.description)
                                .font(.system(.subheadline, weight: .bold))
                                .foregroundColor(SalfordTheme.textPrimary)
                            Text(exp.expenseDate)
                                .font(.system(.caption))
                                .foregroundColor(SalfordTheme.textMuted)
                        }
                        Spacer()
                        Text(Money.lyd(exp.amount))
                            .font(.system(.subheadline, weight: .bold))
                            .foregroundColor(SalfordTheme.dangerRed)
                        Button(role: .destructive) {
                            expenseToDelete = exp
                        } label: {
                            Image(systemName: "trash")
                                .font(.system(.footnote))
                                .foregroundColor(SalfordTheme.dangerRed)
                        }
                    }
                    .salfordCard()
                }
            }
            .padding(14)
        }
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("المصاريف والمرتجعات")
        .confirmDelete(
            $expenseToDelete,
            title: { String(format: "حذف مصروف «%@» (%@ د.ل)؟", $0.description, Money.plain($0.amount)) },
            message: { _ in "سيتغير صافي الربح للشهر الذي سُجل فيه المصروف وأي إقفال ربع سنوي يعاد إصداره." },
            perform: { store.deleteExpense(id: $0.id) }
        )
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// Records a return, normally against the sale it came from so the refund and cost are exact.
struct ReturnEntryCard: View {
    @EnvironmentObject var store: POSDataStore

    enum Mode: String, CaseIterable, Identifiable {
        case fromSale = "من فاتورة بيع"
        case withoutSale = "بدون فاتورة"
        var id: String { rawValue }
    }

    @State private var mode: Mode = .fromSale
    @State private var saleSearch: String = ""
    @State private var selectedSaleId: Int = 0
    @State private var selectedProductId: Int = 0
    @State private var quantity: Int = 1
    @State private var refundText: String = ""
    @State private var reason: String = ""
    @State private var message: String = ""
    @State private var messageIsError: Bool = false

    /// Sales that still have pieces left to return, newest first, filtered by the search text.
    private var returnableSales: [SaleRecord] {
        store.sales
            .filter { store.returnableQuantity(for: $0) > 0 }
            .filter { sale in
                saleSearch.isEmpty
                    || sale.productName.localizedCaseInsensitiveContains(saleSearch)
                    || (sale.customerName ?? "").localizedCaseInsensitiveContains(saleSearch)
                    || (sale.sku ?? "").localizedCaseInsensitiveContains(saleSearch)
                    || "\(sale.id)" == saleSearch
            }
            .prefix(100)
            .map { $0 }
    }

    private var selectedSale: SaleRecord? {
        store.sales.first { $0.id == selectedSaleId }
    }

    private var selectedProduct: Product? {
        store.products.first { $0.id == selectedProductId }
    }

    private var maxQuantity: Int {
        switch mode {
        case .fromSale: return max(1, selectedSale.map { store.returnableQuantity(for: $0) } ?? 1)
        case .withoutSale: return 99
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("تسجيل مرتجع وإعادة القطعة للمخزن")
                .font(.system(.subheadline, weight: .bold))
                .foregroundColor(SalfordTheme.warningAmber)

            Picker("نوع المرتجع", selection: $mode) {
                ForEach(Mode.allCases) { m in Text(m.rawValue).tag(m) }
            }
            .pickerStyle(.segmented)

            if mode == .fromSale {
                TextField("ابحث باسم القطعة أو الزبون أو رقم البيعة", text: $saleSearch)
                    .salfordField()

                if returnableSales.isEmpty {
                    Text("لا توجد مبيعات قابلة للإرجاع تطابق البحث")
                        .font(.system(.footnote))
                        .foregroundColor(SalfordTheme.textMuted)
                } else {
                    Picker("البيعة", selection: $selectedSaleId) {
                        Text("اختر البيعة…").tag(0)
                        ForEach(returnableSales) { sale in
                            Text("#\(sale.id) \(sale.productName) • \(sale.customerName ?? "بدون اسم") • \(String(sale.saleDate.prefix(10))) • \(sale.quantity)×\(Money.plain(sale.actualPrice))")
                                .tag(sale.id)
                        }
                    }
                    .pickerStyle(.menu)
                    .padding(.horizontal, 8)
                    .frame(maxWidth: .infinity, minHeight: SalfordSpacing.touch, alignment: .leading)
                    .background(SalfordTheme.fieldBg)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }

                if let sale = selectedSale {
                    Text(String(format: "دفع الزبون %@ د.ل للقطعة • المتبقي للإرجاع: %d", Money.plain(sale.actualPrice), store.returnableQuantity(for: sale)))
                        .font(.system(.caption))
                        .foregroundColor(SalfordTheme.silverAccent)
                }
            } else {
                Picker("القطعة المرتجعة", selection: $selectedProductId) {
                    Text("اختر القطعة…").tag(0)
                    ForEach(store.products) { prod in
                        Text(prod.name).tag(prod.id)
                    }
                }
                .pickerStyle(.menu)
                .padding(.horizontal, 8)
                .frame(maxWidth: .infinity, minHeight: SalfordSpacing.touch, alignment: .leading)
                .background(SalfordTheme.fieldBg)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

                Text("استخدم هذا فقط لقطع بيعت قبل استخدام التطبيق. أدخل المبلغ الذي أُعيد للزبون فعلاً.")
                    .font(.system(.caption))
                    .foregroundColor(SalfordTheme.textMuted)
            }

            Stepper("الكمية المرتجعة: \(quantity)", value: $quantity, in: 1...maxQuantity)
                .font(.system(.footnote, weight: .bold))
                .foregroundColor(SalfordTheme.textPrimary)

            VStack(alignment: .leading, spacing: 4) {
                Text("المبلغ المسترد للزبون (د.ل)")
                    .font(.system(.caption, weight: .semibold))
                    .foregroundColor(SalfordTheme.textMuted)
                TextField("0", text: $refundText)
                    .numericInput($refundText, .decimal)
                    .salfordField()
            }

            TextField("سبب الإرجاع أو الاستبدال", text: $reason)
                .salfordField()

            Button {
                submit()
            } label: {
                Text("تأكيد المرتجع وإضافة للمخزن")
            }
            .buttonStyle(SalfordButtonStyle(kind: .warning))

            if !message.isEmpty {
                Text(message)
                    .font(.system(.footnote, weight: .bold))
                    .foregroundColor(messageIsError ? SalfordTheme.dangerRed : SalfordTheme.emeraldSuccess)
            }
        }
        .salfordCard()
        .onChange(of: mode) { _ in resetSelection() }
        .onChange(of: selectedSaleId) { _ in quantity = 1; fillDefaultRefund() }
        .onChange(of: selectedProductId) { _ in quantity = 1; fillDefaultRefund() }
        .onChange(of: quantity) { _ in fillDefaultRefund() }
    }

    /// Pre-fills the refund with what the customer paid (sale) or the list price (no invoice).
    private func fillDefaultRefund() {
        switch mode {
        case .fromSale:
            if let sale = selectedSale {
                refundText = NumberInput.editable(sale.actualPrice * Double(quantity))
            } else {
                refundText = ""
            }
        case .withoutSale:
            if let prod = selectedProduct {
                refundText = NumberInput.editable(prod.sellPrice * Double(quantity))
            } else {
                refundText = ""
            }
        }
    }

    private func resetSelection() {
        selectedSaleId = 0
        selectedProductId = 0
        quantity = 1
        refundText = ""
    }

    private func submit() {
        guard let refund = NumberInput.decimal(refundText) else {
            show("يرجى إدخال المبلغ المسترد", error: true)
            return
        }
        let error: String?
        switch mode {
        case .fromSale:
            guard let sale = selectedSale else {
                show("يرجى اختيار البيعة المرتجعة", error: true)
                return
            }
            error = store.addReturn(for: sale, quantity: quantity, refundAmount: refund, reason: reason)
        case .withoutSale:
            guard let prod = selectedProduct else {
                show("يرجى اختيار القطعة المرتجعة", error: true)
                return
            }
            error = store.addReturnWithoutSale(product: prod, quantity: quantity, refundAmount: refund, reason: reason)
        }
        if let error {
            show(error, error: true)
        } else {
            show("✅ تم تسجيل المرتجع وإعادة \(quantity) قطعة للمخزن", error: false)
            reason = ""
            resetSelection()
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
    }

    private func show(_ text: String, error: Bool) {
        message = text
        messageIsError = error
        if error { UINotificationFeedbackGenerator().notificationOccurred(.error) }
    }
}

/// Recorded returns, with undo for returns entered by mistake.
struct ReturnsHistoryList: View {
    @EnvironmentObject var store: POSDataStore
    @State private var returnToDelete: ReturnRecord? = nil
    @State private var errorMessage: String? = nil

    var body: some View {
        if !store.returns.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("سجل المرتجعات")
                    .font(.system(.subheadline, weight: .bold))
                    .foregroundColor(SalfordTheme.goldLight)

                ForEach(store.returns.prefix(30)) { ret in
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("\(ret.productName) × \(ret.quantity)")
                                .font(.system(.subheadline, weight: .bold))
                                .foregroundColor(SalfordTheme.textPrimary)
                            Text("\(ret.saleId.map { "بيعة #\($0)" } ?? "بدون فاتورة") • \(ret.returnDate)")
                                .font(.system(.caption))
                                .foregroundColor(SalfordTheme.textMuted)
                            if let r = ret.reason {
                                Text(r)
                                    .font(.system(.caption))
                                    .foregroundColor(SalfordTheme.textMuted)
                            }
                        }
                        Spacer()
                        Text(String(format: "-%@ د.ل", Money.plain(ret.refundAmount)))
                            .font(.system(.subheadline, weight: .bold))
                            .foregroundColor(SalfordTheme.warningAmber)
                        Button {
                            returnToDelete = ret
                        } label: {
                            Image(systemName: "arrow.uturn.backward.circle")
                                .font(.system(.callout))
                                .foregroundColor(SalfordTheme.dangerRed)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
            .salfordCard()
            .confirmationDialog(
                "إلغاء هذا المرتجع؟",
                isPresented: Binding(get: { returnToDelete != nil }, set: { if !$0 { returnToDelete = nil } }),
                titleVisibility: .visible
            ) {
                Button("إلغاء المرتجع وسحب القطع من المخزن", role: .destructive) {
                    if let r = returnToDelete { errorMessage = store.deleteReturn(r) }
                    returnToDelete = nil
                }
                Button("تراجع", role: .cancel) { returnToDelete = nil }
            }
            .alert("تعذر الإلغاء", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
                Button("حسناً", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }
}
