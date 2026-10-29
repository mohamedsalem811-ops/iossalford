import SwiftUI
import Charts
import UniformTypeIdentifiers

struct MoreManagementHubView: View {
    @EnvironmentObject var store: POSDataStore

    var body: some View {
        List {
            Section("المبيعات والعملاء والأطقم") {
                NavigationLink {
                    SalesHistoryView()
                } label: {
                    Label("سجل المبيعات الكامل (\(store.sales.count))", systemImage: "list.bullet.rectangle.portrait.fill")
                }

                NavigationLink {
                    CustomersManagementView()
                } label: {
                    Label("الزبائن وسجل المشتريات (\(store.customers.count))", systemImage: "person.2.fill")
                }

                NavigationLink {
                    SetsManagementView()
                } label: {
                    Label("الأطقم والعروض الخاصة (\(store.sets.count))", systemImage: "gift.fill")
                }
            }

            Section("المالية والمقارنات والتقارير") {
                NavigationLink {
                    MonthlyComparisonChartView()
                } label: {
                    Label("مقارنة الأشهر المتطورة (Charts)", systemImage: "chart.xyaxis.line")
                }

                NavigationLink {
                    ExpensesAndReturnsView()
                } label: {
                    Label("المصاريف والمرتجعات", systemImage: "arrow.left.arrow.right.circle.fill")
                }
            }

            Section("الإعدادات والنسخ الاحتياطي") {
                NavigationLink {
                    SettingsAndBackupView()
                } label: {
                    Label("الإعدادات وسعر الصرف والنسخ الاحتياطي", systemImage: "gearshape.2.fill")
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("الإدارة والتقارير")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct SalesHistoryView: View {
    @EnvironmentObject var store: POSDataStore

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 10) {
                ForEach(store.sales) { sale in
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(sale.productName)
                                .font(.system(size: 13.5, weight: .bold))
                                .foregroundColor(.white)
                            Text("\(sale.customerName ?? "زبون نقدي") • \(sale.paymentMethod) • \(sale.saleDate)")
                                .font(.system(size: 11))
                                .foregroundColor(SalfordTheme.textMuted)
                            Text(String(format: "الإجمالي: %.0f د.ل ($%.1f) | الربح: +%.0f د.ل", sale.totalSell, sale.totalSellUSD, sale.profit))
                                .font(.system(size: 11.5, weight: .semibold))
                                .foregroundColor(SalfordTheme.emeraldSuccess)
                        }
                        Spacer()
                        Button {
                            store.openReceiptStudio(
                                saleId: sale.id,
                                items: [ReceiptLineItem(name: sale.productName, color: sale.color ?? "", code: sale.sku ?? "SFD", qty: sale.quantity, price: sale.actualPrice)],
                                customer: sale.customerName ?? "Salford Libya"
                            )
                        } label: {
                            Image(systemName: "doc.text.fill")
                                .padding(8)
                                .background(SalfordTheme.royalNavyMid)
                                .foregroundColor(SalfordTheme.silverLight)
                                .cornerRadius(8)
                        }
                    }
                    .salfordCard()
                }
            }
            .padding(14)
        }
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("سجل المبيعات")
    }
}

struct CustomersManagementView: View {
    @EnvironmentObject var store: POSDataStore

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 10) {
                ForEach(store.customers) { cust in
                    let custSales = store.sales.filter { $0.customerId == cust.id }
                    let totalSpent = custSales.reduce(0.0) { $0 + $1.totalSell }
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(cust.name)
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(.white)
                            Spacer()
                            Text(String(format: "%.0f د.ل (%d شروة)", totalSpent, custSales.count))
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(SalfordTheme.emeraldSuccess)
                        }
                        Text("الهاتف: \(cust.phone ?? "-") • المنطقة: \(cust.area ?? "-")")
                            .font(.system(size: 11.5))
                            .foregroundColor(SalfordTheme.textMuted)
                    }
                    .salfordCard()
                }
            }
            .padding(14)
        }
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("قاعدة بيانات الزبائن")
    }
}

struct SetsManagementView: View {
    @EnvironmentObject var store: POSDataStore

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 10) {
                ForEach(store.sets) { jset in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Image(systemName: "sparkles")
                                .foregroundColor(SalfordTheme.silverAccent)
                            Text(jset.name)
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(.white)
                            Spacer()
                            Text(String(format: "خصم %.0f د.ل", jset.discount))
                                .font(.system(size: 11.5, weight: .bold))
                                .foregroundColor(SalfordTheme.emeraldSuccess)
                        }
                        Text(jset.description ?? "")
                            .font(.system(size: 12))
                            .foregroundColor(SalfordTheme.textMuted)
                    }
                    .salfordCard()
                }
            }
            .padding(14)
        }
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("الأطقم الملكية")
    }
}

struct MonthlyComparisonChartView: View {
    @EnvironmentObject var store: POSDataStore
    @State private var useUSD: Bool = false

    struct MonthSummary: Identifiable {
        let id = UUID()
        let month: String
        let sales: Double
        let profit: Double
        let netProfit: Double
    }

    var summaries: [MonthSummary] {
        let months = Array(Set(store.sales.map(\.monthYear) + [store.currentMonthYear()])).sorted()
        let rate = store.exchangeRate > 0 ? store.exchangeRate : 7.0
        return months.map { m in
            let s = store.sales.filter { $0.monthYear == m }.reduce(0.0) { $0 + $1.totalSell }
            let p = store.sales.filter { $0.monthYear == m }.reduce(0.0) { $0 + $1.profit }
            let e = store.expenses.filter { $0.monthYear == m }.reduce(0.0) { $0 + $1.amount }
            let divisor = useUSD ? rate : 1.0
            return MonthSummary(month: m, sales: s / divisor, profit: p / divisor, netProfit: (p - e) / divisor)
        }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Picker("العملة", selection: $useUSD) {
                    Text("دينار ليبي (LYD)").tag(false)
                    Text("دولار أمريكي (USD)").tag(true)
                }
                .pickerStyle(.segmented)

                VStack(alignment: .leading, spacing: 12) {
                    Text("منحنى الأداء الشهري المتطور (المبيعات وصافي الربح)")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(SalfordTheme.silverLight)

                    Chart {
                        ForEach(summaries) { item in
                            BarMark(
                                x: .value("الشهر", item.month),
                                y: .value("المبيعات", item.sales)
                            )
                            .foregroundStyle(SalfordTheme.silverAccent)
                            .cornerRadius(6)

                            LineMark(
                                x: .value("الشهر", item.month),
                                y: .value("صافي الربح", item.netProfit)
                            )
                            .foregroundStyle(SalfordTheme.emeraldSuccess)
                            .symbol(Circle())
                        }
                    }
                    .frame(height: 230)
                }
                .salfordCard()
            }
            .padding(14)
        }
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("مقارنة الأشهر المتطورة")
    }
}

struct ExpensesAndReturnsView: View {
    @EnvironmentObject var store: POSDataStore
    @State private var expDesc: String = ""
    @State private var expAmount: String = ""

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("تسجيل مصروف جديد")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(SalfordTheme.silverLight)
                    TextField("بيان المصروف", text: $expDesc)
                        .padding(10)
                        .background(SalfordTheme.bgElevated)
                        .foregroundColor(.white)
                        .cornerRadius(10)
                    TextField("القيمة (د.ل)", text: $expAmount)
                        .keyboardType(.decimalPad)
                        .padding(10)
                        .background(SalfordTheme.bgElevated)
                        .foregroundColor(.white)
                        .cornerRadius(10)
                    Button {
                        if let amt = Double(expAmount), amt > 0, !expDesc.isEmpty {
                            store.addExpense(description: expDesc, amount: amt, monthYear: store.currentMonthYear())
                            expDesc = ""
                            expAmount = ""
                        }
                    } label: {
                        Text("إضافة المصروف")
                            .font(.system(size: 13, weight: .bold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 11)
                            .background(SalfordTheme.silverGradient)
                            .foregroundColor(SalfordTheme.bgPrimary)
                            .cornerRadius(10)
                    }
                }
                .salfordCard()

                ForEach(store.expenses) { exp in
                    HStack {
                        VStack(alignment: .leading) {
                            Text(exp.description)
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(.white)
                            Text(exp.expenseDate)
                                .font(.system(size: 11))
                                .foregroundColor(SalfordTheme.textMuted)
                        }
                        Spacer()
                        Text(String(format: "%.0f د.ل", exp.amount))
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(SalfordTheme.dangerRed)
                    }
                    .salfordCard()
                }
            }
            .padding(14)
        }
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("المصاريف والمرتجعات")
    }
}

struct SettingsAndBackupView: View {
    @EnvironmentObject var store: POSDataStore
    @State private var rateText: String = ""
    @State private var newPin: String = ""
    @State private var showFileImporter: Bool = false
    @State private var statusMsg: String = ""

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("سعر صرف الدولار والرمز السري")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(SalfordTheme.silverLight)

                    HStack {
                        TextField("سعر الصرف ($1 = د.ل)", text: $rateText)
                            .keyboardType(.decimalPad)
                            .padding(10)
                            .background(SalfordTheme.bgElevated)
                            .foregroundColor(.white)
                            .cornerRadius(10)
                        Button("حفظ السعر") {
                            if let r = Double(rateText), r > 0 {
                                store.exchangeRate = r
                                store.saveToDisk()
                                statusMsg = "✅ تم تحديث سعر الصرف"
                            }
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(SalfordTheme.emeraldSuccess)
                        .foregroundColor(.black)
                        .cornerRadius(10)
                    }

                    HStack {
                        TextField("رمز الدخول الجديد (8 أرقام)", text: $newPin)
                            .keyboardType(.numberPad)
                            .padding(10)
                            .background(SalfordTheme.bgElevated)
                            .foregroundColor(.white)
                            .cornerRadius(10)
                        Button("تحديث الرمز") {
                            if newPin.count == 8 {
                                store.pin = newPin
                                store.saveToDisk()
                                statusMsg = "✅ تم تحديث رمز الدخول"
                            } else {
                                statusMsg = "❌ يجب أن يتكون الرمز من 8 أرقام"
                            }
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(SalfordTheme.silverGradient)
                        .foregroundColor(SalfordTheme.bgPrimary)
                        .cornerRadius(10)
                    }
                }
                .salfordCard()

                VStack(alignment: .leading, spacing: 10) {
                    Text("النسخ الاحتياطي واستعادة البيانات (JSON)")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(SalfordTheme.silverLight)

                    if let backupURL = store.exportBackupJSON() {
                        ShareLink(item: backupURL, preview: SharePreview("SALFORD_Jewelry_Backup.json")) {
                            Label("تصدير نسخة احتياطية كاملة إلى الملفات / iCloud", systemImage: "externaldrive.fill.badge.checkmark")
                                .font(.system(size: 13, weight: .bold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(SalfordTheme.royalNavyMid)
                                .foregroundColor(.white)
                                .cornerRadius(11)
                        }
                    }

                    Button {
                        showFileImporter = true
                    } label: {
                        Label("استيراد نسخة احتياطية JSON", systemImage: "square.and.arrow.down.fill")
                            .font(.system(size: 13, weight: .bold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(SalfordTheme.bgElevated)
                            .foregroundColor(SalfordTheme.silverLight)
                            .cornerRadius(11)
                    }

                    if !statusMsg.isEmpty {
                        Text(statusMsg)
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(SalfordTheme.emeraldSuccess)
                    }
                }
                .salfordCard()
            }
            .padding(14)
        }
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("الإعدادات والنسخ الاحتياطي")
        .onAppear {
            rateText = String(format: "%.2f", store.exchangeRate)
            newPin = store.pin
        }
        .fileImporter(isPresented: $showFileImporter, allowedContentTypes: [.json]) { result in
            if case .success(let url) = result {
                if store.importBackupJSON(from: url) {
                    statusMsg = "✅ تمت استعادة النسخة الاحتياطية بنجاح"
                } else {
                    statusMsg = "❌ فشل قراءة ملف النسخة الاحتياطية"
                }
            }
        }
    }
}
