import SwiftUI

struct CustomersManagementView: View {
    @EnvironmentObject var store: POSDataStore
    @State private var customerToDelete: Customer? = nil
    @State private var name: String = ""
    @State private var phone: String = ""
    @State private var area: String = ""
    @State private var notes: String = ""
    @State private var formMessage: String = ""

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                // Add Customer Card
                VStack(alignment: .leading, spacing: 10) {
                    Text("إضافة زبون جديد")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(SalfordTheme.silverLight)

                    TextField("اسم الزبون الثلاثي", text: $name)
                        .padding(10)
                        .background(SalfordTheme.bgElevated)
                        .foregroundColor(.white)
                        .cornerRadius(10)

                    HStack(spacing: 10) {
                        TextField("رقم الهاتف", text: $phone)
                            .numericInput($phone, .phone)
                            .padding(10)
                            .background(SalfordTheme.bgElevated)
                            .foregroundColor(.white)
                            .cornerRadius(10)

                        TextField("المدينة أو المنطقة", text: $area)
                            .padding(10)
                            .background(SalfordTheme.bgElevated)
                            .foregroundColor(.white)
                            .cornerRadius(10)
                    }

                    TextField("ملاحظات وتفضيلات الزبون", text: $notes)
                        .padding(10)
                        .background(SalfordTheme.bgElevated)
                        .foregroundColor(.white)
                        .cornerRadius(10)

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
                            .font(.system(size: 13, weight: .bold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 11)
                            .background(SalfordTheme.silverGradient)
                            .foregroundColor(SalfordTheme.bgPrimary)
                            .cornerRadius(10)
                    }

                    if !formMessage.isEmpty {
                        Text(formMessage)
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(SalfordTheme.dangerRed)
                    }
                }
                .salfordCard()

                // Customers List
                ForEach(store.customers) { cust in
                    let custSales = store.sales.filter { $0.customerId == cust.id }
                    let totalSpent = custSales.reduce(0.0) { $0 + $1.totalSell }
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(cust.name)
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(.white)
                            Spacer()
                            Text(String(format: "%@ د.ل • %d مشتريات", Money.plain(totalSpent), custSales.count))
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(SalfordTheme.emeraldSuccess)
                        }
                        let owed = store.balance(for: cust.id)
                        HStack {
                            Text("الهاتف: \(cust.phone ?? "غير مسجل") • المنطقة: \(cust.area ?? "غير محددة")")
                                .font(.system(size: 11.5))
                                .foregroundColor(SalfordTheme.textMuted)
                            Spacer()
                            if owed > 0 {
                                // A customer who still owes money can't be deleted (the debt would disappear).
                                Text(String(format: "عليه %@ د.ل", Money.plain(owed)))
                                    .font(.system(size: 11.5, weight: .heavy))
                                    .foregroundColor(SalfordTheme.dangerRed)
                            } else {
                                Button(role: .destructive) {
                                    customerToDelete = cust
                                } label: {
                                    Image(systemName: "trash")
                                        .font(.system(size: 12))
                                        .foregroundColor(SalfordTheme.dangerRed)
                                }
                            }
                        }
                        if let n = cust.notes, !n.isEmpty {
                            Text(n)
                                .font(.system(size: 11))
                                .foregroundColor(SalfordTheme.goldLight)
                        }
                    }
                    .salfordCard()
                }
            }
            .padding(14)
        }
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("قاعدة بيانات الزبائن")
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
