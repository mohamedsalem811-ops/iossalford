import SwiftUI

struct CustomersManagementView: View {
    @EnvironmentObject var store: POSDataStore
    @State private var customerToDelete: Customer? = nil
    @State private var name: String = ""
    @State private var phone: String = ""
    @State private var area: String = ""
    @State private var notes: String = ""
    @State private var formMessage: String = ""
    @State private var search: String = ""

    private var filteredCustomers: [Customer] {
        let q = NumberInput.latinDigits(search).trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return store.customers }
        let digits = NumberInput.sanitize(q, kind: .integer)
        return store.customers.filter { c in
            c.name.localizedCaseInsensitiveContains(q)
                || (c.area ?? "").localizedCaseInsensitiveContains(q)
                || (digits.count >= 3 && (c.phone.map { NumberInput.sanitize($0, kind: .integer).contains(digits) } ?? false))
        }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                // Add Customer Card
                VStack(alignment: .leading, spacing: 10) {
                    Text("إضافة زبون جديد")
                        .font(.system(.subheadline, weight: .bold))
                        .foregroundColor(SalfordTheme.silverLight)

                    TextField("اسم الزبون الثلاثي", text: $name)
                        .salfordField()

                    HStack(spacing: 10) {
                        TextField("رقم الهاتف", text: $phone)
                            .numericInput($phone, .phone)
                            .salfordField()

                        TextField("المدينة أو المنطقة", text: $area)
                            .salfordField()
                    }

                    TextField("ملاحظات وتفضيلات الزبون", text: $notes)
                        .salfordField()

                    Button {
                        if let error = store.addOrUpdateCustomer(name: name, phone: phone, area: area, notes: notes) {
                            formMessage = error
                            return
                        }
                        formMessage = ""
                        name = ""
                        phone = ""
                        area = ""
                        notes = ""
                    } label: {
                        Label("حفظ بيانات الزبون", systemImage: "person.badge.plus")
                    }
                    .buttonStyle(.salfordPrimary)

                    if !formMessage.isEmpty {
                        Text(formMessage)
                            .font(.system(.footnote, weight: .bold))
                            .foregroundColor(SalfordTheme.dangerRed)
                    }
                }
                .salfordCard()

                // Customers List
                if !store.customers.isEmpty && filteredCustomers.isEmpty {
                    SalfordEmptyState(icon: "magnifyingglass", title: "لا يوجد زبون بهذا الاسم أو الرقم")
                }
                ForEach(filteredCustomers) { cust in
                    let custSales = store.sales.filter { $0.customerId == cust.id }
                    let totalSpent = custSales.reduce(0.0) { $0 + $1.totalSell }
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(cust.name)
                                .font(.system(.subheadline, weight: .bold))
                                .foregroundColor(SalfordTheme.textPrimary)
                            Spacer()
                            Text(String(format: "%@ د.ل • %d مشتريات", Money.plain(totalSpent), custSales.count))
                                .font(.system(.footnote, weight: .bold))
                                .foregroundColor(SalfordTheme.emeraldSuccess)
                        }
                        let owed = store.balance(for: cust.id)
                        HStack {
                            Text("الهاتف: \(cust.phone ?? "غير مسجل") • المنطقة: \(cust.area ?? "غير محددة")")
                                .font(.system(.caption))
                                .foregroundColor(SalfordTheme.textMuted)
                            Spacer()
                            if owed > 0 {
                                // A customer who still owes money can't be deleted (the debt would disappear).
                                Text(String(format: "عليه %@ د.ل", Money.plain(owed)))
                                    .font(.system(.caption, weight: .heavy))
                                    .foregroundColor(SalfordTheme.dangerRed)
                            } else if owed < 0 {
                                // Paid more than owed: keep the record so the credit isn't lost.
                                NavigationLink {
                                    CustomerAccountView(customerId: cust.id)
                                } label: {
                                    Text(String(format: "له %@ د.ل", Money.plain(-owed)))
                                        .font(.system(.caption, weight: .heavy))
                                        .foregroundColor(SalfordTheme.warningAmber)
                                }
                            } else {
                                Button(role: .destructive) {
                                    customerToDelete = cust
                                } label: {
                                    Image(systemName: "trash")
                                        .font(.system(.footnote))
                                        .foregroundColor(SalfordTheme.dangerRed)
                                }
                            }
                        }
                        if let n = cust.notes, !n.isEmpty {
                            Text(n)
                                .font(.system(.caption))
                                .foregroundColor(SalfordTheme.goldLight)
                        }
                    }
                    .salfordCard()
                }
            }
            .padding(14)
        }
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("الزبائن")
        .searchable(text: $search, prompt: "الاسم أو الهاتف أو المنطقة")
        .confirmDelete(
            $customerToDelete,
            title: { "حذف الزبون «\($0.name)»؟" },
            message: { cust in
                let count = store.sales.filter { $0.customerId == cust.id }.count
                return count > 0
                    ? "لهذا الزبون \(count) عملية شراء. تبقى المبيعات والفواتير باسمه، لكن تُحذف بيانات الاتصال والملاحظات."
                    : "تُحذف بيانات الاتصال والملاحظات."
            },
            perform: { store.deleteCustomer(id: $0.id) }
        )
        .navigationBarTitleDisplayMode(.inline)
    }
}
