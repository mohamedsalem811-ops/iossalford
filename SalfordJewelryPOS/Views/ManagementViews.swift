import SwiftUI
import Charts
import UniformTypeIdentifiers

struct MoreManagementHubView: View {
    @EnvironmentObject var store: POSDataStore

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Header Summary Banner
                HStack(spacing: 12) {
                    ZStack {
                        Circle()
                            .fill(SalfordTheme.royalNavyMid)
                            .frame(width: 48, height: 48)
                        Image(systemName: "crown.fill")
                            .font(.system(size: 20))
                            .foregroundColor(SalfordTheme.goldLight)
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        Text("مركز الإدارة والتقارير المالية")
                            .font(.system(size: 15, weight: .heavy))
                            .foregroundColor(.white)
                        Text("إدارة المبيعات والزبائن والأطقم والمقارنات الشهرية")
                            .font(.system(size: 12))
                            .foregroundColor(SalfordTheme.textMuted)
                    }
                    Spacer()
                }
                .salfordCard(borderColor: SalfordTheme.gold.opacity(0.35))

                // Section 1: Sales, Customers & Sets
                VStack(alignment: .leading, spacing: 10) {
                    Text("المبيعات والزبائن والأطقم")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(SalfordTheme.goldLight)
                        .padding(.horizontal, 4)

                    NavigationLink {
                        SalesHistoryView()
                    } label: {
                        ManagementRowCard(
                            title: "سجل المبيعات الكامل",
                            subtitle: "مراجعة كافة العمليات وإصدار الفواتير أو الإلغاء",
                            badgeText: "\(store.sales.count) عملية",
                            icon: "list.bullet.rectangle.portrait.fill",
                            accent: SalfordTheme.silverLight
                        )
                    }

                    NavigationLink {
                        CustomersManagementView()
                    } label: {
                        ManagementRowCard(
                            title: "قاعدة بيانات الزبائن",
                            subtitle: "إضافة الزبائن ومراجعة إجمالي مشتريات كل زبون",
                            badgeText: "\(store.customers.count) زبون",
                            icon: "person.2.fill",
                            accent: SalfordTheme.emeraldSuccess
                        )
                    }

                    NavigationLink {
                        SetsManagementView()
                    } label: {
                        ManagementRowCard(
                            title: "الأطقم الملكية والعروض",
                            subtitle: "تجهيز الأطقم الكاملة بخصم خاص للعملاء",
                            badgeText: "\(store.sets.count) أطقم",
                            icon: "gift.fill",
                            accent: SalfordTheme.goldLight
                        )
                    }
                }

                // Section 2: Financial Reports & Comparisons
                VStack(alignment: .leading, spacing: 10) {
                    Text("التقارير المالية والمقارنات")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(SalfordTheme.goldLight)
                        .padding(.horizontal, 4)

                    NavigationLink {
                        MonthlyComparisonChartView()
                    } label: {
                        ManagementRowCard(
                            title: "مقارنة الأشهر والرسوم البيانية",
                            subtitle: "تحليل المبيعات وصافي الأرباح بالدينار والدولار",
                            badgeText: "تحليل ذكي",
                            icon: "chart.xyaxis.line",
                            accent: SalfordTheme.infoBlue
                        )
                    }

                    NavigationLink {
                        ExpensesAndReturnsView()
                    } label: {
                        ManagementRowCard(
                            title: "المصاريف والمرتجعات",
                            subtitle: "تسجيل المصاريف التشغيلية وإرجاع القطع للمخزن",
                            badgeText: "\(store.expenses.count) مصروف",
                            icon: "arrow.left.arrow.right.circle.fill",
                            accent: SalfordTheme.warningAmber
                        )
                    }

                    NavigationLink {
                        QuarterlyClosingView()
                    } label: {
                        ManagementRowCard(
                            title: "الإقفال الربع سنوي",
                            subtitle: "جرد وأرشفة نتائج كل ثلاثة أشهر بشكل مستقل",
                            badgeText: "\(store.closings.count) إقفال",
                            icon: "checkmark.shield.fill",
                            accent: SalfordTheme.emeraldSuccess
                        )
                    }
                }

                // Section 3: Settings & Backup
                VStack(alignment: .leading, spacing: 10) {
                    Text("إعدادات النظام والأمان")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(SalfordTheme.goldLight)
                        .padding(.horizontal, 4)

                    NavigationLink {
                        SettingsAndBackupView()
                    } label: {
                        ManagementRowCard(
                            title: "الإعدادات والنسخ الاحتياطي",
                            subtitle: "تعديل سعر الصرف ورمز الدخول وحفظ البيانات",
                            badgeText: String(format: "%.2f د.ل", store.exchangeRate),
                            icon: "gearshape.2.fill",
                            accent: SalfordTheme.silverAccent
                        )
                    }
                }
            }
            .padding(14)
        }
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("لوحة الإدارة")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct ManagementRowCard: View {
    let title: String
    let subtitle: String
    let badgeText: String
    let icon: String
    let accent: Color

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(SalfordTheme.royalNavyMid)
                    .frame(width: 44, height: 44)
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(accent)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.white)
                    .multilineTextAlignment(.leading)
                Text(subtitle)
                    .font(.system(size: 11.5))
                    .foregroundColor(SalfordTheme.textMuted)
                    .multilineTextAlignment(.leading)
                    .lineLimit(2)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 6) {
                Text(badgeText)
                    .font(.system(size: 11, weight: .bold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(accent.opacity(0.16))
                    .foregroundColor(accent)
                    .clipShape(Capsule())

                Image(systemName: "chevron.left")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(SalfordTheme.textMuted)
            }
        }
        .salfordCard()
    }
}

struct SalesHistoryView: View {
    @EnvironmentObject var store: POSDataStore

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 10) {
                if store.sales.isEmpty {
                    Text("لا توجد عمليات بيع مسجلة حتى الآن")
                        .font(.system(size: 13))
                        .foregroundColor(SalfordTheme.textMuted)
                        .padding(.top, 40)
                }
                ForEach(store.sales) { sale in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(sale.productName)
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(.white)
                            Spacer()
                            Text(String(format: "%.0f د.ل", sale.totalSell))
                                .font(.system(size: 14, weight: .heavy))
                                .foregroundColor(SalfordTheme.silverLight)
                        }

                        HStack(spacing: 8) {
                            Text("الزبون: \(sale.customerName ?? "زبون نقدي")")
                            Text("•")
                            Text("الدفع: \(sale.paymentMethod)")
                            Text("•")
                            Text("الكمية: \(sale.quantity)")
                        }
                        .font(.system(size: 11.5))
                        .foregroundColor(SalfordTheme.textMuted)

                        HStack {
                            HStack(spacing: 8) {
                                Text(String(format: "الربح: %.0f د.ل", sale.profit))
                                    .font(.system(size: 11.5, weight: .bold))
                                    .foregroundColor(SalfordTheme.emeraldSuccess)
                                Text(String(format: "المعادل: %.1f دولار", sale.totalSellUSD))
                                    .font(.system(size: 11.5, weight: .semibold))
                                    .foregroundColor(SalfordTheme.goldLight)
                            }
                            Spacer()
                            Button {
                                store.openReceiptStudio(
                                    saleId: sale.id,
                                    items: [ReceiptLineItem(name: sale.productName, color: sale.color ?? "", code: sale.sku ?? "SFD", qty: sale.quantity, price: sale.actualPrice)],
                                    customer: sale.customerName ?? "Salford Libya"
                                )
                            } label: {
                                Label("فاتورة", systemImage: "printer.fill")
                                    .font(.system(size: 11.5, weight: .bold))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(SalfordTheme.royalNavyMid)
                                    .foregroundColor(SalfordTheme.silverLight)
                                    .cornerRadius(8)
                            }

                            Button(role: .destructive) {
                                store.deleteSale(sale)
                            } label: {
                                Image(systemName: "trash.fill")
                                    .font(.system(size: 12))
                                    .padding(7)
                                    .background(SalfordTheme.dangerRed.opacity(0.18))
                                    .foregroundColor(SalfordTheme.dangerRed)
                                    .cornerRadius(8)
                            }
                        }
                    }
                    .salfordCard()
                }
            }
            .padding(14)
        }
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("سجل المبيعات")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct CustomersManagementView: View {
    @EnvironmentObject var store: POSDataStore
    @State private var name: String = ""
    @State private var phone: String = ""
    @State private var area: String = ""
    @State private var notes: String = ""

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
                            .keyboardType(.phonePad)
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
                        guard !name.trimmingCharacters(in: .whitespaces).isEmpty else { return }
                        store.addOrUpdateCustomer(name: name, phone: phone, area: area, notes: notes)
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
                            Text(String(format: "%.0f د.ل • %d مشتريات", totalSpent, custSales.count))
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(SalfordTheme.emeraldSuccess)
                        }
                        HStack {
                            Text("الهاتف: \(cust.phone ?? "غير مسجل") • المنطقة: \(cust.area ?? "غير محددة")")
                                .font(.system(size: 11.5))
                                .foregroundColor(SalfordTheme.textMuted)
                            Spacer()
                            Button(role: .destructive) {
                                store.deleteCustomer(id: cust.id)
                            } label: {
                                Image(systemName: "trash")
                                    .font(.system(size: 12))
                                    .foregroundColor(SalfordTheme.dangerRed)
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
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct SetsManagementView: View {
    @EnvironmentObject var store: POSDataStore
    @State private var setName: String = ""
    @State private var setDesc: String = ""
    @State private var setDiscount: String = "100"

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("إنشاء طقم مجوهرات جديد")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(SalfordTheme.silverLight)

                    TextField("اسم الطقم الملكي", text: $setName)
                        .padding(10)
                        .background(SalfordTheme.bgElevated)
                        .foregroundColor(.white)
                        .cornerRadius(10)

                    TextField("وصف ومكونات الطقم", text: $setDesc)
                        .padding(10)
                        .background(SalfordTheme.bgElevated)
                        .foregroundColor(.white)
                        .cornerRadius(10)

                    TextField("قيمة الخصم الخاص للطقم بالدينار", text: $setDiscount)
                        .keyboardType(.decimalPad)
                        .padding(10)
                        .background(SalfordTheme.bgElevated)
                        .foregroundColor(.white)
                        .cornerRadius(10)

                    Button {
                        guard !setName.trimmingCharacters(in: .whitespaces).isEmpty else { return }
                        store.addSet(
                            name: setName,
                            description: setDesc,
                            discount: Double(setDiscount) ?? 0,
                            items: []
                        )
                        setName = ""
                        setDesc = ""
                    } label: {
                        Label("إضافة الطقم للقائمة", systemImage: "plus.circle.fill")
                            .font(.system(size: 13, weight: .bold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 11)
                            .background(SalfordTheme.silverGradient)
                            .foregroundColor(SalfordTheme.bgPrimary)
                            .cornerRadius(10)
                    }
                }
                .salfordCard()

                ForEach(store.sets) { jset in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Image(systemName: "sparkles")
                                .foregroundColor(SalfordTheme.goldLight)
                            Text(jset.name)
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(.white)
                            Spacer()
                            Text(String(format: "خصم %.0f د.ل", jset.discount))
                                .font(.system(size: 11.5, weight: .bold))
                                .foregroundColor(SalfordTheme.emeraldSuccess)
                            Button(role: .destructive) {
                                store.deleteSet(id: jset.id)
                            } label: {
                                Image(systemName: "trash")
                                    .font(.system(size: 12))
                                    .foregroundColor(SalfordTheme.dangerRed)
                            }
                        }
                        if let desc = jset.description, !desc.isEmpty {
                            Text(desc)
                                .font(.system(size: 12))
                                .foregroundColor(SalfordTheme.textMuted)
                        }
                    }
                    .salfordCard()
                }
            }
            .padding(14)
        }
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("الأطقم الملكية")
        .navigationBarTitleDisplayMode(.inline)
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
                    Text("بالدينار الليبي").tag(false)
                    Text("بالدولار الأمريكي").tag(true)
                }
                .pickerStyle(.segmented)

                VStack(alignment: .leading, spacing: 12) {
                    Text("منحنى الأداء الشهري للمبيعات وصافي الربح")
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
                    .frame(height: 220)
                }
                .salfordCard()

                // Monthly Table Breakdown
                ForEach(summaries) { item in
                    let unitLabel = useUSD ? "دولار" : "د.ل"
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text("شهر \(item.month)")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(.white)
                            Spacer()
                            Text(String(format: "المبيعات: %.0f \(unitLabel)", item.sales))
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(SalfordTheme.silverLight)
                        }
                        HStack {
                            Text(String(format: "إجمالي الربح: %.0f \(unitLabel)", item.profit))
                                .font(.system(size: 12))
                                .foregroundColor(SalfordTheme.goldLight)
                            Spacer()
                            Text(String(format: "صافي الربح: %.0f \(unitLabel)", item.netProfit))
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(SalfordTheme.emeraldSuccess)
                        }
                    }
                    .salfordCard()
                }
            }
            .padding(14)
        }
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("مقارنة الأشهر")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct ExpensesAndReturnsView: View {
    @EnvironmentObject var store: POSDataStore
    @State private var expDesc: String = ""
    @State private var expAmount: String = ""
    @State private var selectedReturnProductId: Int = 0
    @State private var returnReason: String = ""

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                // Add Expense Card
                VStack(alignment: .leading, spacing: 10) {
                    Text("تسجيل مصروف تشغيلي جديد")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(SalfordTheme.silverLight)
                    TextField("بيان المصروف مثل تغليف أو إعلانات", text: $expDesc)
                        .padding(10)
                        .background(SalfordTheme.bgElevated)
                        .foregroundColor(.white)
                        .cornerRadius(10)
                    TextField("القيمة بالدينار الليبي", text: $expAmount)
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

                // Record Return Card
                VStack(alignment: .leading, spacing: 10) {
                    Text("تسجيل مرتجع وإعادة القطعة للمخزن")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(SalfordTheme.warningAmber)

                    Picker("القطعة المرتجعة", selection: $selectedReturnProductId) {
                        ForEach(store.products) { prod in
                            Text(prod.name).tag(prod.id)
                        }
                    }
                    .pickerStyle(.menu)
                    .padding(8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(SalfordTheme.bgElevated)
                    .cornerRadius(10)

                    TextField("سبب الإرجاع أو الاستبدال", text: $returnReason)
                        .padding(10)
                        .background(SalfordTheme.bgElevated)
                        .foregroundColor(.white)
                        .cornerRadius(10)

                    Button {
                        if let prod = store.products.first(where: { $0.id == selectedReturnProductId }) ?? store.products.first {
                            store.addReturn(product: prod, quantity: 1, reason: returnReason)
                            returnReason = ""
                        }
                    } label: {
                        Text("تأكيد المرتجع وإضافة للمخزن")
                            .font(.system(size: 13, weight: .bold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 11)
                            .background(SalfordTheme.warningAmber)
                            .foregroundColor(.black)
                            .cornerRadius(10)
                    }
                }
                .salfordCard()

                // Expenses History
                ForEach(store.expenses) { exp in
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
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
                        Button(role: .destructive) {
                            store.deleteExpense(id: exp.id)
                        } label: {
                            Image(systemName: "trash")
                                .font(.system(size: 12))
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
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            if selectedReturnProductId == 0, let first = store.products.first {
                selectedReturnProductId = first.id
            }
        }
    }
}

struct QuarterlyClosingView: View {
    @EnvironmentObject var store: POSDataStore
    @State private var quarterTitle: String = "الربع الرابع ٢٠٢٦"
    @State private var closingNotes: String = ""

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("إصدار إقفال ربع سنوي جديد")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(SalfordTheme.silverLight)

                    TextField("عنوان الربع السنوي", text: $quarterTitle)
                        .padding(10)
                        .background(SalfordTheme.bgElevated)
                        .foregroundColor(.white)
                        .cornerRadius(10)

                    TextField("ملاحظات الجرد والإقفال", text: $closingNotes)
                        .padding(10)
                        .background(SalfordTheme.bgElevated)
                        .foregroundColor(.white)
                        .cornerRadius(10)

                    Button {
                        guard !quarterTitle.isEmpty else { return }
                        store.createQuarterlyClosing(quarterKey: quarterTitle, notes: closingNotes)
                        closingNotes = ""
                    } label: {
                        Label("اعتماد وحفظ الإقفال الربع سنوي", systemImage: "checkmark.seal.fill")
                            .font(.system(size: 13, weight: .bold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 11)
                            .background(SalfordTheme.emeraldSuccess)
                            .foregroundColor(.black)
                            .cornerRadius(10)
                    }
                }
                .salfordCard()

                ForEach(store.closings) { cls in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(cls.quarterKey)
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(.white)
                            Spacer()
                            Text(String(format: "الصافي: %.0f د.ل", cls.totalProfit))
                                .font(.system(size: 13, weight: .heavy))
                                .foregroundColor(SalfordTheme.emeraldSuccess)
                        }
                        Text(String(format: "المبيعات: %.0f د.ل • المصاريف: %.0f د.ل • القطع المباعة: %d", cls.totalSales, cls.totalExpenses, cls.itemsSold))
                            .font(.system(size: 11.5))
                            .foregroundColor(SalfordTheme.textMuted)
                        Text("تاريخ الإقفال: \(cls.closedAt)")
                            .font(.system(size: 11))
                            .foregroundColor(SalfordTheme.goldLight)
                    }
                    .salfordCard()
                }
            }
            .padding(14)
        }
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("الإقفال الربع سنوي")
        .navigationBarTitleDisplayMode(.inline)
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
                    Text("سعر صرف الدولار ورمز الدخول")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(SalfordTheme.silverLight)

                    HStack {
                        TextField("سعر الصرف بالدينار", text: $rateText)
                            .keyboardType(.decimalPad)
                            .padding(10)
                            .background(SalfordTheme.bgElevated)
                            .foregroundColor(.white)
                            .cornerRadius(10)
                        Button("حفظ السعر") {
                            if let r = Double(rateText), r > 0 {
                                store.exchangeRate = r
                                store.saveToDisk()
                                statusMsg = "تم تحديث سعر الصرف بنجاح"
                            }
                        }
                        .font(.system(size: 12.5, weight: .bold))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(SalfordTheme.emeraldSuccess)
                        .foregroundColor(.black)
                        .cornerRadius(10)
                    }

                    HStack {
                        TextField("رمز الدخول الجديد من 8 أرقام", text: $newPin)
                            .keyboardType(.numberPad)
                            .padding(10)
                            .background(SalfordTheme.bgElevated)
                            .foregroundColor(.white)
                            .cornerRadius(10)
                        Button("تحديث الرمز") {
                            if newPin.count == 8 {
                                store.pin = newPin
                                store.saveToDisk()
                                statusMsg = "تم تحديث رمز الدخول بنجاح"
                            } else {
                                statusMsg = "يرجى إدخال 8 أرقام للرمز"
                            }
                        }
                        .font(.system(size: 12.5, weight: .bold))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(SalfordTheme.silverGradient)
                        .foregroundColor(SalfordTheme.bgPrimary)
                        .cornerRadius(10)
                    }
                }
                .salfordCard()

                VStack(alignment: .leading, spacing: 10) {
                    Text("النسخ الاحتياطي واستعادة قاعدة البيانات")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(SalfordTheme.silverLight)

                    if let backupURL = store.exportBackupJSON() {
                        ShareLink(item: backupURL, preview: SharePreview("SALFORD_Jewelry_Backup.json")) {
                            Label("تصدير نسخة احتياطية كاملة إلى الملفات", systemImage: "externaldrive.fill.badge.checkmark")
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
                        Label("استيراد نسخة احتياطية محفوظة", systemImage: "square.and.arrow.down.fill")
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
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            rateText = String(format: "%.2f", store.exchangeRate)
            newPin = store.pin
        }
        .fileImporter(isPresented: $showFileImporter, allowedContentTypes: [.json]) { result in
            if case .success(let url) = result {
                if store.importBackupJSON(from: url) {
                    statusMsg = "تمت استعادة النسخة الاحتياطية بنجاح"
                } else {
                    statusMsg = "تعذر قراءة ملف النسخة الاحتياطية"
                }
            }
        }
    }
}
