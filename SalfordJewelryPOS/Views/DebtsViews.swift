import SwiftUI

/// Customers who owe money from credit (آجل) sales, and recording what they pay.
struct DebtsView: View {
    @EnvironmentObject var store: POSDataStore

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("إجمالي الديون المستحقة")
                        .font(.system(.footnote, weight: .bold))
                        .foregroundColor(SalfordTheme.textMuted)
                    Text(Money.lyd(store.totalOutstanding))
                        .font(.system(.title, weight: .heavy))
                        .foregroundColor(store.totalOutstanding > 0 ? SalfordTheme.dangerRed : SalfordTheme.emeraldSuccess)
                    Text("\(store.debtors.count) زبون عليه دين")
                        .font(.system(.caption))
                        .foregroundColor(SalfordTheme.textMuted)
                    if store.unassignedCreditTotal > 0 {
                        Label(String(format: "%@ د.ل مبيعات آجلة قديمة بدون اسم زبون — لا يمكن تحصيلها من هنا", Money.plain(store.unassignedCreditTotal)),
                              systemImage: "exclamationmark.triangle.fill")
                            .font(.system(.caption, weight: .bold))
                            .foregroundColor(SalfordTheme.warningAmber)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .salfordCard()

                if store.debtors.isEmpty {
                    Text("لا توجد ديون مستحقة 👌")
                        .font(.system(.subheadline))
                        .foregroundColor(SalfordTheme.textMuted)
                        .padding(.top, 20)
                }

                ForEach(store.debtors) { entry in
                    NavigationLink {
                        CustomerAccountView(customerId: entry.customer.id)
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(entry.customer.name)
                                    .font(.system(.subheadline, weight: .bold))
                                    .foregroundColor(SalfordTheme.textPrimary)
                                Text(entry.customer.phone ?? "بدون هاتف")
                                    .font(.system(.caption))
                                    .foregroundColor(SalfordTheme.textMuted)
                            }
                            Spacer()
                            Text(Money.lyd(entry.balance))
                                .font(.system(.callout, weight: .heavy))
                                .foregroundColor(SalfordTheme.dangerRed)
                            Image(systemName: "chevron.left")
                                .font(.system(.footnote, weight: .bold))
                                .foregroundColor(SalfordTheme.silverAccent)
                        }
                        .salfordCard()
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(14)
        }
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("الديون والتحصيل")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// One customer's credit account: balance, record a payment, and the history.
struct CustomerAccountView: View {
    @EnvironmentObject var store: POSDataStore
    let customerId: Int

    @State private var amountText: String = ""
    @State private var method: String = "كاش"
    @State private var note: String = ""
    @State private var message: String = ""
    @State private var messageIsError: Bool = false
    @State private var paymentToDelete: CustomerPayment? = nil

    private let methods = ["كاش", "بطاقة", "تحويل"]

    var body: some View {
        let customer = store.customers.first { $0.id == customerId }
        let owed = store.balance(for: customerId)

        ScrollView {
            VStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 10) {
                    Text(customer?.name ?? "زبون")
                        .font(.system(.callout, weight: .heavy))
                        .foregroundColor(SalfordTheme.textPrimary)
                    // Negative = the customer paid more than they owe (e.g. a paid credit sale was deleted).
                    Text(owed < 0
                         ? String(format: "له رصيد: %@ د.ل (دفع أكثر من المستحق)", Money.plain(-owed))
                         : String(format: "المتبقي عليه: %@ د.ل", Money.plain(owed)))
                        .font(.system(.subheadline, weight: .heavy))
                        .foregroundColor(owed > 0 ? SalfordTheme.dangerRed : (owed < 0 ? SalfordTheme.warningAmber : SalfordTheme.emeraldSuccess))

                    if owed > 0 {
                        HStack(spacing: 8) {
                            TextField("مبلغ الدفعة", text: $amountText)
                                .numericInput($amountText, .decimal)
                                .salfordField()
                            Button("كامل المبلغ") { amountText = NumberInput.editable(owed) }
                                .font(.system(.footnote, weight: .bold))
                                .foregroundColor(SalfordTheme.silverAccent)
                        }
                        Picker("طريقة الدفع", selection: $method) {
                            ForEach(methods, id: \.self) { Text($0).tag($0) }
                        }
                        .pickerStyle(.segmented)
                        TextField("ملاحظة (اختياري)", text: $note)
                            .salfordField()
                        Button {
                            submit()
                        } label: {
                            Label("تسجيل الدفعة", systemImage: "banknote.fill")
                        }
                        .buttonStyle(.salfordSuccess)
                    }
                    if !message.isEmpty {
                        Text(message)
                            .font(.system(.footnote, weight: .bold))
                            .foregroundColor(messageIsError ? SalfordTheme.dangerRed : SalfordTheme.emeraldSuccess)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .salfordCard()

                VStack(alignment: .leading, spacing: 8) {
                    Text("المبيعات الآجلة")
                        .font(.system(.subheadline, weight: .bold))
                        .foregroundColor(SalfordTheme.goldLight)
                    ForEach(store.creditSales(for: customerId)) { sale in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("#\(sale.id) \(sale.productName) ×\(sale.quantity)")
                                    .font(.system(.footnote, weight: .bold))
                                    .foregroundColor(SalfordTheme.textPrimary)
                                Text(sale.saleDate)
                                    .font(.system(.caption))
                                    .foregroundColor(SalfordTheme.textMuted)
                            }
                            Spacer()
                            Text(String(format: "+%@", Money.plain(sale.totalSell)))
                                .font(.system(.footnote, weight: .bold))
                                .foregroundColor(SalfordTheme.dangerRed)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .salfordCard()

                VStack(alignment: .leading, spacing: 8) {
                    Text("الدفعات المستلمة")
                        .font(.system(.subheadline, weight: .bold))
                        .foregroundColor(SalfordTheme.goldLight)
                    let list = store.payments(for: customerId)
                    if list.isEmpty {
                        Text("لا توجد دفعات بعد")
                            .font(.system(.footnote))
                            .foregroundColor(SalfordTheme.textMuted)
                    }
                    ForEach(list) { p in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("\(p.method)\(p.note.map { " • " + $0 } ?? "")")
                                    .font(.system(.footnote, weight: .bold))
                                    .foregroundColor(SalfordTheme.textPrimary)
                                Text(p.paymentDate)
                                    .font(.system(.caption))
                                    .foregroundColor(SalfordTheme.textMuted)
                            }
                            Spacer()
                            Text(String(format: "−%@", Money.plain(p.amount)))
                                .font(.system(.footnote, weight: .bold))
                                .foregroundColor(SalfordTheme.emeraldSuccess)
                            Button {
                                paymentToDelete = p
                            } label: {
                                Image(systemName: "arrow.uturn.backward.circle")
                                    .foregroundColor(SalfordTheme.dangerRed)
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .salfordCard()
            }
            .padding(14)
        }
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("حساب الزبون")
        .navigationBarTitleDisplayMode(.inline)
        .confirmDelete(
            $paymentToDelete,
            title: { String(format: "إلغاء دفعة %@ د.ل؟", Money.plain($0.amount)) },
            message: { _ in "استخدم هذا فقط لدفعة سُجلت بالخطأ. سيعود المبلغ إلى رصيد الزبون المستحق." },
            confirmLabel: "إلغاء الدفعة",
            perform: { store.deletePayment($0) }
        )
    }

    private func submit() {
        guard let amount = NumberInput.decimal(amountText) else {
            message = "يرجى إدخال مبلغ الدفعة"
            messageIsError = true
            return
        }
        if let error = store.recordPayment(customerId: customerId, amount: amount, method: method, note: note) {
            message = error
            messageIsError = true
        } else {
            message = String(format: "✅ تم تسجيل دفعة %@ د.ل", Money.plain(amount))
            messageIsError = false
            amountText = ""
            note = ""
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
    }
}
