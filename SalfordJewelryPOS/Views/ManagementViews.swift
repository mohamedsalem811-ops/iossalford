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
    @State private var saleToDelete: SaleRecord? = nil

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
                            Text("#\(sale.id) \(sale.productName)")
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
                            if store.returnedQuantity(forSale: sale.id) > 0 {
                                Text("•")
                                Text("مُرتجع: \(store.returnedQuantity(forSale: sale.id))")
                                    .foregroundColor(SalfordTheme.warningAmber)
                            }
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
                                saleToDelete = sale
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
        .confirmationDialog(
            "حذف البيعة #\(saleToDelete?.id ?? 0)؟",
            isPresented: Binding(get: { saleToDelete != nil }, set: { if !$0 { saleToDelete = nil } }),
            titleVisibility: .visible
        ) {
            Button("حذف البيعة وإعادة القطع للمخزن", role: .destructive) {
                if let sale = saleToDelete { store.deleteSale(sale) }
                saleToDelete = nil
            }
            Button("إلغاء", role: .cancel) { saleToDelete = nil }
        } message: {
            Text("استخدم الحذف فقط لبيعة سُجلت بالخطأ. إذا أعاد الزبون القطعة فسجّلها كمرتجع بدلاً من ذلك. ستُحذف أيضاً أي مرتجعات مرتبطة بهذه البيعة.")
        }
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
        let months = Array(Set(store.sales.map(\.monthYear) + store.returns.map(\.monthYear) + store.expenses.map(\.monthYear) + [store.currentMonthYear()])).sorted()
        let rate = store.exchangeRate > 0 ? store.exchangeRate : 7.0
        return months.map { m in
            let sum = store.summary(forMonth: m)
            let divisor = useUSD ? rate : 1.0
            return MonthSummary(month: m, sales: sum.netSales / divisor, profit: sum.grossProfit / divisor, netProfit: sum.netProfit / divisor)
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

                ReturnEntryCard()

                ReturnsHistoryList()

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
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(SalfordTheme.warningAmber)

            Picker("نوع المرتجع", selection: $mode) {
                ForEach(Mode.allCases) { m in Text(m.rawValue).tag(m) }
            }
            .pickerStyle(.segmented)

            if mode == .fromSale {
                TextField("ابحث باسم القطعة أو الزبون أو رقم البيعة", text: $saleSearch)
                    .padding(10)
                    .background(SalfordTheme.bgElevated)
                    .foregroundColor(.white)
                    .cornerRadius(10)

                if returnableSales.isEmpty {
                    Text("لا توجد مبيعات قابلة للإرجاع تطابق البحث")
                        .font(.system(size: 12))
                        .foregroundColor(SalfordTheme.textMuted)
                } else {
                    Picker("البيعة", selection: $selectedSaleId) {
                        Text("اختر البيعة…").tag(0)
                        ForEach(returnableSales) { sale in
                            Text("#\(sale.id) \(sale.productName) • \(sale.customerName ?? "بدون اسم") • \(String(sale.saleDate.prefix(10))) • \(sale.quantity)×\(Int(sale.actualPrice))")
                                .tag(sale.id)
                        }
                    }
                    .pickerStyle(.menu)
                    .padding(8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(SalfordTheme.bgElevated)
                    .cornerRadius(10)
                }

                if let sale = selectedSale {
                    Text(String(format: "دفع الزبون %.0f د.ل للقطعة • المتبقي للإرجاع: %d", sale.actualPrice, store.returnableQuantity(for: sale)))
                        .font(.system(size: 11.5))
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
                .padding(8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(SalfordTheme.bgElevated)
                .cornerRadius(10)

                Text("استخدم هذا فقط لقطع بيعت قبل استخدام التطبيق. أدخل المبلغ الذي أُعيد للزبون فعلاً.")
                    .font(.system(size: 11))
                    .foregroundColor(SalfordTheme.textMuted)
            }

            Stepper("الكمية المرتجعة: \(quantity)", value: $quantity, in: 1...maxQuantity)
                .font(.system(size: 12.5, weight: .bold))
                .foregroundColor(.white)

            VStack(alignment: .leading, spacing: 4) {
                Text("المبلغ المسترد للزبون (د.ل)")
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundColor(SalfordTheme.textMuted)
                TextField("0", text: $refundText)
                    .keyboardType(.decimalPad)
                    .padding(10)
                    .background(SalfordTheme.bgElevated)
                    .foregroundColor(.white)
                    .cornerRadius(10)
            }

            TextField("سبب الإرجاع أو الاستبدال", text: $reason)
                .padding(10)
                .background(SalfordTheme.bgElevated)
                .foregroundColor(.white)
                .cornerRadius(10)

            Button {
                submit()
            } label: {
                Text("تأكيد المرتجع وإضافة للمخزن")
                    .font(.system(size: 13, weight: .bold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(SalfordTheme.warningAmber)
                    .foregroundColor(.black)
                    .cornerRadius(10)
            }

            if !message.isEmpty {
                Text(message)
                    .font(.system(size: 12, weight: .bold))
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
                refundText = String(format: "%.0f", sale.actualPrice * Double(quantity))
            } else {
                refundText = ""
            }
        case .withoutSale:
            if let prod = selectedProduct {
                refundText = String(format: "%.0f", prod.sellPrice * Double(quantity))
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
        guard let refund = Double(refundText) else {
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
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(SalfordTheme.goldLight)

                ForEach(store.returns.prefix(30)) { ret in
                    HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("\(ret.productName) × \(ret.quantity)")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(.white)
                            Text("\(ret.saleId.map { "بيعة #\($0)" } ?? "بدون فاتورة") • \(ret.returnDate)")
                                .font(.system(size: 11))
                                .foregroundColor(SalfordTheme.textMuted)
                            if let r = ret.reason {
                                Text(r)
                                    .font(.system(size: 11))
                                    .foregroundColor(SalfordTheme.textMuted)
                            }
                        }
                        Spacer()
                        Text(String(format: "-%.0f د.ل", ret.refundAmount))
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(SalfordTheme.warningAmber)
                        Button {
                            returnToDelete = ret
                        } label: {
                            Image(systemName: "arrow.uturn.backward.circle")
                                .font(.system(size: 15))
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

struct QuarterlyClosingView: View {
    @EnvironmentObject var store: POSDataStore
    @State private var selectedPeriod: QuarterPeriod = .containing()
    @State private var closingNotes: String = ""
    @State private var confirmReplace: Bool = false
    @State private var closingToDelete: QuarterlyClosing? = nil
    @State private var statusMsg: String = ""

    /// The current quarter and the 7 before it.
    private var selectablePeriods: [QuarterPeriod] {
        var list: [QuarterPeriod] = []
        var p = QuarterPeriod.containing()
        for _ in 0..<8 {
            list.append(p)
            p = p.quarter == 1 ? QuarterPeriod(year: p.year - 1, quarter: 4) : QuarterPeriod(year: p.year, quarter: p.quarter - 1)
        }
        return list
    }

    var body: some View {
        let sum = store.summary(for: selectedPeriod)

        ScrollView {
            VStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("إصدار إقفال ربع سنوي جديد")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(SalfordTheme.silverLight)

                    Picker("الربع السنوي", selection: $selectedPeriod) {
                        ForEach(selectablePeriods) { period in
                            Text(period.title + (store.existingClosing(for: period) != nil ? " ✓" : "")).tag(period)
                        }
                    }
                    .pickerStyle(.menu)
                    .padding(8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(SalfordTheme.bgElevated)
                    .cornerRadius(10)

                    Text("الأشهر المشمولة: " + selectedPeriod.monthKeys.joined(separator: " • "))
                        .font(.system(size: 11))
                        .foregroundColor(SalfordTheme.textMuted)

                    // Live preview of exactly what will be saved
                    VStack(spacing: 6) {
                        closingRow("إجمالي المبيعات", sum.grossSales)
                        closingRow("تكلفة البضاعة المباعة", -sum.costOfSales)
                        closingRow("الربح الإجمالي", sum.grossProfit, bold: true)
                        closingRow("المرتجعات (\(sum.itemsReturned) قطعة) — صافي أثرها على الربح", -sum.returnsProfitImpact)
                        closingRow("المصاريف", -sum.expenses)
                        Divider().background(SalfordTheme.borderSubtle)
                        closingRow("صافي الربح", sum.netProfit, bold: true,
                                   color: sum.netProfit >= 0 ? SalfordTheme.emeraldSuccess : SalfordTheme.dangerRed)
                        Text("\(sum.transactions) عملية بيع • \(sum.itemsSold) قطعة مباعة • مبالغ مستردة \(String(format: "%.0f", sum.refunds)) د.ل")
                            .font(.system(size: 11))
                            .foregroundColor(SalfordTheme.textMuted)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(10)
                    .background(SalfordTheme.royalNavyTop.opacity(0.55))
                    .cornerRadius(10)

                    TextField("ملاحظات الجرد والإقفال", text: $closingNotes)
                        .padding(10)
                        .background(SalfordTheme.bgElevated)
                        .foregroundColor(.white)
                        .cornerRadius(10)

                    Button {
                        if store.existingClosing(for: selectedPeriod) != nil {
                            confirmReplace = true
                        } else {
                            saveClosing()
                        }
                    } label: {
                        Label("اعتماد وحفظ إقفال \(selectedPeriod.title)", systemImage: "checkmark.seal.fill")
                            .font(.system(size: 13, weight: .bold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 11)
                            .background(SalfordTheme.emeraldSuccess)
                            .foregroundColor(.black)
                            .cornerRadius(10)
                    }

                    if !statusMsg.isEmpty {
                        Text(statusMsg)
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(SalfordTheme.emeraldSuccess)
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
                        Text(String(format: "المبيعات: %.0f د.ل • المرتجعات: %.0f د.ل • المصاريف: %.0f د.ل • القطع المباعة: %d", cls.totalSales, cls.totalRefunds, cls.totalExpenses, cls.itemsSold))
                            .font(.system(size: 11.5))
                            .foregroundColor(SalfordTheme.textMuted)
                        if cls.periodKey == nil {
                            Label("إقفال قديم — حُسب على كل المبيعات منذ البداية وليس على هذا الربع فقط. يُنصح بحذفه وإعادة الإقفال.", systemImage: "exclamationmark.triangle.fill")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(SalfordTheme.warningAmber)
                        }
                        if let notes = cls.notes {
                            Text(notes)
                                .font(.system(size: 11))
                                .foregroundColor(SalfordTheme.textMuted)
                        }
                        HStack {
                            Text("تاريخ الإقفال: \(cls.closedAt)")
                                .font(.system(size: 11))
                                .foregroundColor(SalfordTheme.goldLight)
                            Spacer()
                            Button(role: .destructive) {
                                closingToDelete = cls
                            } label: {
                                Image(systemName: "trash.fill")
                                    .font(.system(size: 12))
                                    .foregroundColor(SalfordTheme.dangerRed)
                            }
                        }
                    }
                    .salfordCard()
                }
            }
            .padding(14)
        }
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("الإقفال الربع سنوي")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog("تم إقفال \(selectedPeriod.title) من قبل", isPresented: $confirmReplace, titleVisibility: .visible) {
            Button("استبدال الإقفال القديم بالأرقام الحالية", role: .destructive) { saveClosing() }
            Button("إلغاء", role: .cancel) {}
        }
        .confirmationDialog(
            "حذف إقفال \(closingToDelete?.quarterKey ?? "")؟",
            isPresented: Binding(get: { closingToDelete != nil }, set: { if !$0 { closingToDelete = nil } }),
            titleVisibility: .visible
        ) {
            Button("حذف الإقفال", role: .destructive) {
                if let c = closingToDelete { store.deleteClosing(id: c.id) }
                closingToDelete = nil
            }
            Button("إلغاء", role: .cancel) { closingToDelete = nil }
        } message: {
            Text("يُحذف سجل الإقفال فقط؛ المبيعات والمصاريف لا تتأثر.")
        }
    }

    private func saveClosing() {
        store.createQuarterlyClosing(period: selectedPeriod, notes: closingNotes)
        closingNotes = ""
        statusMsg = "✅ تم حفظ إقفال \(selectedPeriod.title)"
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    private func closingRow(_ title: String, _ value: Double, bold: Bool = false, color: Color = .white) -> some View {
        HStack {
            Text(title)
                .font(.system(size: 12, weight: bold ? .bold : .regular))
                .foregroundColor(SalfordTheme.silverLight)
            Spacer()
            Text(String(format: "%.0f د.ل", value))
                .font(.system(size: 12.5, weight: bold ? .heavy : .semibold))
                .foregroundColor(color)
        }
    }
}

struct SettingsAndBackupView: View {
    @EnvironmentObject var store: POSDataStore
    @State private var rateText: String = ""
    @State private var currentPin: String = ""
    @State private var newPin: String = ""
    @State private var confirmPin: String = ""
    @State private var pinStatusMsg: String = ""
    @State private var pinStatusIsError: Bool = false
    @State private var showFileImporter: Bool = false
    @State private var statusMsg: String = ""
    @State private var backupURL: URL? = nil

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

                    VStack(alignment: .leading, spacing: 8) {
                        Text("تغيير رمز الدخول")
                            .font(.system(size: 12.5, weight: .bold))
                            .foregroundColor(SalfordTheme.silverLight)

                        if store.isUsingDefaultPin {
                            Label("أنت تستخدم الرمز الافتراضي — غيّره الآن لحماية بيانات المحل", systemImage: "exclamationmark.triangle.fill")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(SalfordTheme.warningAmber)
                        }

                        pinField("الرمز الحالي", text: $currentPin)
                        pinField("الرمز الجديد (8 أرقام)", text: $newPin)
                        pinField("تأكيد الرمز الجديد", text: $confirmPin)

                        Button("تحديث الرمز") {
                            updatePin()
                        }
                        .font(.system(size: 12.5, weight: .bold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(SalfordTheme.silverGradient)
                        .foregroundColor(SalfordTheme.bgPrimary)
                        .cornerRadius(10)

                        if !pinStatusMsg.isEmpty {
                            Text(pinStatusMsg)
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(pinStatusIsError ? SalfordTheme.dangerRed : SalfordTheme.emeraldSuccess)
                        }
                    }
                }
                .salfordCard()

                VStack(alignment: .leading, spacing: 10) {
                    Text("النسخ الاحتياطي واستعادة قاعدة البيانات")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(SalfordTheme.silverLight)

                    if let backupURL {
                        ShareLink(item: backupURL, preview: SharePreview(backupURL.lastPathComponent)) {
                            Label("تصدير نسخة احتياطية كاملة إلى الملفات", systemImage: "externaldrive.fill.badge.checkmark")
                                .font(.system(size: 13, weight: .bold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(SalfordTheme.royalNavyMid)
                                .foregroundColor(.white)
                                .cornerRadius(11)
                        }
                    } else {
                        Text("تعذر تجهيز ملف النسخة الاحتياطية — تحقق من مساحة التخزين")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(SalfordTheme.dangerRed)
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
            backupURL = store.exportBackupJSON()
        }
        .fileImporter(isPresented: $showFileImporter, allowedContentTypes: [.json]) { result in
            if case .success(let url) = result {
                if store.importBackupJSON(from: url) {
                    statusMsg = "تمت استعادة النسخة الاحتياطية بنجاح"
                    backupURL = store.exportBackupJSON()
                } else {
                    statusMsg = "تعذر قراءة ملف النسخة الاحتياطية"
                }
            }
        }
    }

    private func pinField(_ title: String, text: Binding<String>) -> some View {
        SecureField(title, text: text)
            .keyboardType(.numberPad)
            .padding(10)
            .background(SalfordTheme.bgElevated)
            .foregroundColor(.white)
            .cornerRadius(10)
            .onChange(of: text.wrappedValue) { newVal in
                let cleaned = String(PinVault.normalize(newVal).prefix(PinVault.pinLength))
                if cleaned != newVal { text.wrappedValue = cleaned }
            }
    }

    private func updatePin() {
        defer {
            currentPin = ""
            newPin = ""
            confirmPin = ""
        }
        guard newPin == confirmPin else {
            pinStatusIsError = true
            pinStatusMsg = "الرمز الجديد وتأكيده غير متطابقين"
            return
        }
        switch store.changePin(current: currentPin, new: newPin) {
        case .success:
            pinStatusIsError = false
            pinStatusMsg = "✅ تم تحديث رمز الدخول بنجاح"
        case .wrongCurrentPin:
            pinStatusIsError = true
            pinStatusMsg = "الرمز الحالي غير صحيح"
        case .invalidNewPin:
            pinStatusIsError = true
            pinStatusMsg = "يرجى إدخال 8 أرقام للرمز الجديد"
        case .sameAsDefault:
            pinStatusIsError = true
            pinStatusMsg = "لا يمكن استخدام الرمز الافتراضي — اختر رمزاً آخر"
        case .keychainError:
            pinStatusIsError = true
            pinStatusMsg = "تعذر حفظ الرمز في سلسلة المفاتيح الآمنة — حاول مرة أخرى"
        }
    }
}
