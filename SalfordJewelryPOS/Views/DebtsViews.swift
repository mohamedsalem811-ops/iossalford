import SwiftUI

/// Customers who owe money from credit (آجل) sales, and recording what they pay.
struct DebtsView: View {
    @EnvironmentObject var store: POSDataStore

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("إجمالي الديون المستحقة")
                        .font(.system(size: 12.5, weight: .bold))
                        .foregroundColor(SalfordTheme.textMuted)
                    Text(Money.lyd(store.totalOutstanding))
                        .font(.system(size: 26, weight: .heavy))
                        .foregroundColor(store.totalOutstanding > 0 ? SalfordTheme.dangerRed : SalfordTheme.emeraldSuccess)
                    Text("\(store.debtors.count) زبون عليه دين")
                        .font(.system(size: 11.5))
                        .foregroundColor(SalfordTheme.textMuted)
                    if store.unassignedCreditTotal > 0 {
                        Label(String(format: "%@ د.ل مبيعات آجلة قديمة بدون اسم زبون — لا يمكن تحصيلها من هنا", Money.plain(store.unassignedCreditTotal)),
                              systemImage: "exclamationmark.triangle.fill")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(SalfordTheme.warningAmber)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .salfordCard()

                if store.debtors.isEmpty {
                    Text("لا توجد ديون مستحقة 👌")
                        .font(.system(size: 13))
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
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(.white)
                                Text(entry.customer.phone ?? "بدون هاتف")
                                    .font(.system(size: 11.5))
                                    .foregroundColor(SalfordTheme.textMuted)
                            }
                            Spacer()
                            Text(Money.lyd(entry.balance))
                                .font(.system(size: 15, weight: .heavy))
                                .foregroundColor(SalfordTheme.dangerRed)
                            Image(systemName: "chevron.left")
                                .font(.system(size: 12, weight: .bold))
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
                        .font(.system(size: 16, weight: .heavy))
                        .foregroundColor(.white)
                    Text(String(format: "المتبقي عليه: %@ د.ل", Money.plain(owed)))
                        .font(.system(size: 14, weight: .heavy))
                        .foregroundColor(owed > 0 ? SalfordTheme.dangerRed : SalfordTheme.emeraldSuccess)

                    if owed > 0 {
                        HStack(spacing: 8) {
                            TextField("مبلغ الدفعة", text: $amountText)
                                .numericInput($amountText, .decimal)
                                .padding(10)
                                .background(SalfordTheme.bgElevated)
                                .foregroundColor(.white)
                                .cornerRadius(10)
                            Button("كامل المبلغ") { amountText = NumberInput.editable(owed) }
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(SalfordTheme.silverAccent)
                        }
                        Picker("طريقة الدفع", selection: $method) {
                            ForEach(methods, id: \.self) { Text($0).tag($0) }
                        }
                        .pickerStyle(.segmented)
                        TextField("ملاحظة (اختياري)", text: $note)
                            .padding(10)
                            .background(SalfordTheme.bgElevated)
                            .foregroundColor(.white)
                            .cornerRadius(10)
                        Button {
                            submit()
                        } label: {
                            Label("تسجيل الدفعة", systemImage: "banknote.fill")
                                .font(.system(size: 13, weight: .bold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 11)
                                .background(SalfordTheme.emeraldSuccess)
                                .foregroundColor(.black)
                                .cornerRadius(10)
                        }
                    }
                    if !message.isEmpty {
                        Text(message)
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(messageIsError ? SalfordTheme.dangerRed : SalfordTheme.emeraldSuccess)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .salfordCard()

                VStack(alignment: .leading, spacing: 8) {
                    Text("المبيعات الآجلة")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(SalfordTheme.goldLight)
                    ForEach(store.creditSales(for: customerId)) { sale in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("#\(sale.id) \(sale.productName) ×\(sale.quantity)")
                                    .font(.system(size: 12.5, weight: .bold))
                                    .foregroundColor(.white)
                                Text(sale.saleDate)
                                    .font(.system(size: 10.5))
                                    .foregroundColor(SalfordTheme.textMuted)
                            }
                            Spacer()
                            Text(String(format: "+%@", Money.plain(sale.totalSell)))
                                .font(.system(size: 12.5, weight: .bold))
                                .foregroundColor(SalfordTheme.dangerRed)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .salfordCard()

                VStack(alignment: .leading, spacing: 8) {
                    Text("الدفعات المستلمة")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(SalfordTheme.goldLight)
                    let list = store.payments(for: customerId)
                    if list.isEmpty {
                        Text("لا توجد دفعات بعد")
                            .font(.system(size: 12))
                            .foregroundColor(SalfordTheme.textMuted)
                    }
                    ForEach(list) { p in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("\(p.method)\(p.note.map { " • " + $0 } ?? "")")
                                    .font(.system(size: 12.5, weight: .bold))
                                    .foregroundColor(.white)
                                Text(p.paymentDate)
                                    .font(.system(size: 10.5))
                                    .foregroundColor(SalfordTheme.textMuted)
                            }
                            Spacer()
                            Text(String(format: "−%@", Money.plain(p.amount)))
                                .font(.system(size: 12.5, weight: .bold))
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
