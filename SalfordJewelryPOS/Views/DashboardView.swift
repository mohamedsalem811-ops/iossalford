import SwiftUI
import Charts

/// Home screen: today at a glance, the chosen month's figures, what needs attention,
/// quick actions, the month's daily chart, categories and the latest sales.
struct DashboardView: View {
    @EnvironmentObject var store: POSDataStore
    @Binding var selectedTab: AppTab
    @State private var selectedMonth: String = ""
    @State private var showRateEditor: Bool = false

    private var activeMonth: String {
        selectedMonth.isEmpty ? store.currentMonthYear() : selectedMonth
    }

    /// Months that have any activity, newest first (always includes the current month).
    private var availableMonths: [String] {
        let all = Set(store.sales.map(\.monthYear) + store.expenses.map(\.monthYear)
                      + store.returns.map(\.monthYear) + [store.currentMonthYear()])
        return all.sorted(by: >)
    }

    private var monthSales: [SaleRecord] {
        store.sales.filter { $0.monthYear == activeMonth }
    }

    private var todayKey: String { String(store.nowTimestamp().prefix(10)) }

    private var todaySales: [SaleRecord] {
        store.sales.filter { $0.saleDate.hasPrefix(todayKey) }
    }

    private var stockAlerts: [Product] {
        // Out-of-stock pieces matter most, so they come first.
        store.products.filter { $0.isLowStock || $0.isOutOfStock }
            .sorted { ($0.isOutOfStock ? 0 : 1, $0.stock) < ($1.isOutOfStock ? 0 : 1, $1.stock) }
    }

    var body: some View {
        let sum = store.summary(forMonth: activeMonth)
        let rate = store.exchangeRate > 0 ? store.exchangeRate : 7.0

        ScrollView {
            VStack(alignment: .leading, spacing: SalfordSpacing.l) {
                todayStrip
                monthHeader
                monthKPIs(sum, rate: rate)
                attentionSection
                quickActions
                dailyChart
                categoryBreakdown
                brandBreakdown
                recentSales
                stockValueCard(rate: rate)
            }
            .padding(SalfordSpacing.l)
        }
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("الرئيسية")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showRateEditor) {
            NavigationStack {
                ScrollView {
                    ExchangeRateEditor { showRateEditor = false }
                        .padding(SalfordSpacing.l)
                }
                .background(SalfordTheme.bgPrimary)
                .navigationTitle("سعر الدولار")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("إغلاق") { showRateEditor = false }
                    }
                }
            }
            .presentationDetents([.medium])
            .environmentObject(store)
            .environment(\.layoutDirection, .rightToLeft)
        }
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                // Short text that fits the bar (the longer label was shortened to "…"); tap to change it.
                Button {
                    showRateEditor = true
                } label: {
                    Text(String(format: "$ %.2f", store.exchangeRate))
                        .font(.system(.subheadline, weight: .bold))
                        .foregroundColor(SalfordTheme.emeraldSuccess)
                        .fixedSize()
                }
                .accessibilityLabel(String(format: "سعر الدولار %.2f دينار، اضغط للتعديل", store.exchangeRate))
            }
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    withAnimation { store.lock() }
                } label: {
                    Label("قفل التطبيق", systemImage: "lock.fill")
                }
            }
        }
    }

    // MARK: Today

    private var todayStrip: some View {
        let total = todaySales.reduce(0) { $0 + $1.totalSell }
        let pieces = todaySales.reduce(0) { $0 + $1.quantity }
        return VStack(alignment: .leading, spacing: SalfordSpacing.s) {
            Text("اليوم")
                .font(.system(.footnote, weight: .bold))
                .foregroundColor(SalfordTheme.textMuted)
            HStack(alignment: .firstTextBaseline) {
                Text(Money.lyd(total))
                    .font(.system(.largeTitle, weight: .heavy))
                    .foregroundColor(SalfordTheme.textPrimary)
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(todaySales.count) عملية")
                    Text("\(pieces) قطعة")
                }
                .font(.system(.footnote, weight: .semibold))
                .foregroundColor(SalfordTheme.textMuted)
            }
        }
        .padding(SalfordSpacing.l)
        .salfordCard(borderColor: SalfordTheme.gold.opacity(0.35))
        .accessibilityElement(children: .combine)
    }

    // MARK: Month

    private var monthHeader: some View {
        HStack {
            Text("ملخص الشهر")
                .font(.system(.title3, weight: .bold))
                .foregroundColor(SalfordTheme.textPrimary)
            Spacer()
            Menu {
                Picker("الشهر", selection: Binding(get: { activeMonth }, set: { selectedMonth = $0 })) {
                    ForEach(availableMonths, id: \.self) { Text($0).tag($0) }
                }
            } label: {
                Label(activeMonth, systemImage: "calendar")
                    .font(.system(.subheadline, weight: .semibold))
            }
        }
    }

    private func monthKPIs(_ sum: PeriodSummary, rate: Double) -> some View {
        let margin = sum.grossSales > 0 ? Int((sum.grossProfit / sum.grossSales) * 100) : 0
        let columns = [GridItem(.adaptive(minimum: 150), spacing: SalfordSpacing.m)]
        return LazyVGrid(columns: columns, spacing: SalfordSpacing.m) {
            KPIStatCard(
                title: "صافي المبيعات",
                value: Money.lyd(sum.netSales),
                subtitle: "\(sum.transactions) عملية • \(sum.itemsSold) قطعة",
                icon: "banknote.fill",
                accentColor: SalfordTheme.silverAccent
            )
            KPIStatCard(
                title: "ربح المبيعات",
                value: Money.lyd(sum.grossProfit),
                subtitle: "الهامش \(margin)٪",
                icon: "chart.line.uptrend.xyaxis",
                accentColor: SalfordTheme.emeraldSuccess
            )
            KPIStatCard(
                title: "المصاريف والمرتجعات",
                value: Money.lyd(sum.expenses + sum.returnsProfitImpact),
                subtitle: "مصاريف \(Money.plain(sum.expenses)) • مرتجعات \(Money.plain(sum.returnsProfitImpact))",
                icon: "arrow.down.right.circle.fill",
                accentColor: SalfordTheme.dangerRed
            )
            KPIStatCard(
                title: "صافي الربح",
                value: Money.lyd(sum.netProfit),
                subtitle: String(format: "%.1f دولار", sum.netProfit / rate),
                icon: "crown.fill",
                accentColor: sum.netProfit >= 0 ? SalfordTheme.emeraldSuccess : SalfordTheme.dangerRed
            )
        }
    }

    // MARK: Needs attention

    @ViewBuilder private var attentionSection: some View {
        let owed = store.totalOutstanding
        if owed > 0 || !stockAlerts.isEmpty {
            VStack(alignment: .leading, spacing: SalfordSpacing.m) {
                SalfordSectionTitle(title: "يحتاج انتباهك", icon: "bell.badge.fill")

                if owed > 0 {
                    NavigationLink {
                        DebtsView()
                    } label: {
                        attentionRow(icon: "creditcard.fill", color: SalfordTheme.dangerRed,
                                     title: "ديون مستحقة: \(Money.lyd(owed))",
                                     detail: "\(store.debtors.count) زبون — اضغط للتحصيل")
                    }
                    .buttonStyle(.plain)
                }

                if !stockAlerts.isEmpty {
                    Button {
                        selectedTab = .products
                    } label: {
                        attentionRow(icon: "exclamationmark.triangle.fill", color: SalfordTheme.warningAmber,
                                     title: "المخزون: \(stockAlerts.filter(\.isOutOfStock).count) نفدت • \(stockAlerts.filter { !$0.isOutOfStock }.count) قاربت",
                                     detail: stockAlertNames)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(SalfordSpacing.l)
            .salfordCard()
        }
    }

    private var stockAlertNames: String {
        let names = stockAlerts.prefix(3).map { p -> String in
            p.isOutOfStock ? "\(p.name) (نفد)" : "\(p.name) (\(p.stock))"
        }
        return names.joined(separator: "، ") + (stockAlerts.count > 3 ? "…" : "")
    }

    private func attentionRow(icon: String, color: Color, title: String, detail: String) -> some View {
        HStack(spacing: SalfordSpacing.m) {
            Image(systemName: icon)
                .font(.system(.title3))
                .foregroundColor(color)
                .frame(width: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(.subheadline, weight: .bold))
                    .foregroundColor(SalfordTheme.textPrimary)
                Text(detail)
                    .font(.system(.footnote))
                    .foregroundColor(SalfordTheme.textMuted)
                    .lineLimit(2)
            }
            Spacer()
            Image(systemName: "chevron.left")
                .font(.system(.footnote, weight: .bold))
                .foregroundColor(SalfordTheme.textMuted)
        }
        .frame(minHeight: SalfordSpacing.touch)
        .contentShape(Rectangle())
    }

    // MARK: Quick actions

    private var quickActions: some View {
        HStack(spacing: SalfordSpacing.m) {
            Button {
                selectedTab = .sale
            } label: {
                Label("بيعة جديدة", systemImage: "cart.fill.badge.plus")
            }
            .buttonStyle(.salfordPrimary)

            Button {
                store.openNewDraftReceipt(items: [])
            } label: {
                Label("فاتورة هدية", systemImage: "gift.fill")
            }
            .buttonStyle(.salfordSecondary)

            Button {
                selectedTab = .products
            } label: {
                Label("قطعة جديدة", systemImage: "plus.square.fill")
            }
            .buttonStyle(.salfordSecondary)
        }
        .labelStyle(VerticalLabelStyle())
    }

    // MARK: Daily chart

    private struct DayPoint: Identifiable {
        let day: Int
        let sales: Double
        let profit: Double
        var id: Int { day }
    }

    private var dailyPoints: [DayPoint] {
        var sales: [Int: Double] = [:]
        var profit: [Int: Double] = [:]
        for s in monthSales {
            // saleDate is "yyyy-MM-dd HH:mm:ss"
            let parts = s.saleDate.split(separator: " ").first?.split(separator: "-") ?? []
            guard parts.count == 3, let day = Int(parts[2]) else { continue }
            sales[day, default: 0] += s.totalSell
            profit[day, default: 0] += s.profit
        }
        return sales.keys.sorted().map { DayPoint(day: $0, sales: sales[$0] ?? 0, profit: profit[$0] ?? 0) }
    }

    private var dailyChart: some View {
        VStack(alignment: .leading, spacing: SalfordSpacing.m) {
            SalfordSectionTitle(title: "المبيعات اليومية — \(activeMonth)", icon: "chart.bar.fill")
            if dailyPoints.isEmpty {
                SalfordEmptyState(icon: "chart.bar", title: "لا توجد مبيعات في هذا الشهر")
            } else {
                Chart(dailyPoints) { p in
                    BarMark(x: .value("اليوم", p.day), y: .value("المبيعات", p.sales))
                        .foregroundStyle(SalfordTheme.silverAccent)
                        .cornerRadius(4)
                    LineMark(x: .value("اليوم", p.day), y: .value("الربح", p.profit))
                        .foregroundStyle(SalfordTheme.emeraldSuccess)
                        .symbol(Circle())
                }
                .chartXAxisLabel("اليوم")
                .frame(height: 200)
                HStack(spacing: SalfordSpacing.l) {
                    legend(color: SalfordTheme.silverAccent, text: "المبيعات")
                    legend(color: SalfordTheme.emeraldSuccess, text: "الربح")
                }
            }
        }
        .padding(SalfordSpacing.l)
        .salfordCard()
    }

    private func legend(color: Color, text: String) -> some View {
        HStack(spacing: 6) {
            Circle().fill(color).frame(width: 10, height: 10)
            Text(text).font(.system(.caption)).foregroundColor(SalfordTheme.textMuted)
        }
    }

    // MARK: Categories

    private struct CategoryTotal: Identifiable {
        let category: String
        let total: Double
        var id: String { category }
    }

    private var categoryTotals: [CategoryTotal] {
        var map: [String: Double] = [:]
        for s in monthSales {
            let cat = store.products.first(where: { $0.id == s.productId })?.category ?? "أخرى"
            map[cat, default: 0] += s.totalSell
        }
        return map.map { CategoryTotal(category: $0.key, total: $0.value) }.sorted { $0.total > $1.total }
    }

    @ViewBuilder private var categoryBreakdown: some View {
        let totals = categoryTotals
        if !totals.isEmpty {
            let maxTotal = max(totals.map(\.total).max() ?? 1, 0.001)
            VStack(alignment: .leading, spacing: SalfordSpacing.m) {
                SalfordSectionTitle(title: "المبيعات حسب الفئة", icon: "square.grid.2x2.fill")
                ForEach(totals) { item in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(item.category)
                                .font(.system(.subheadline, weight: .semibold))
                                .foregroundColor(SalfordTheme.textPrimary)
                            Spacer()
                            Text(Money.lyd(item.total))
                                .font(.system(.subheadline, weight: .bold))
                                .foregroundColor(SalfordTheme.textPrimary)
                        }
                        GeometryReader { geo in
                            Capsule()
                                .fill(SalfordTheme.gold.opacity(0.7))
                                .frame(width: max(6, geo.size.width * CGFloat(item.total / maxTotal)))
                        }
                        .frame(height: 6)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
            .padding(SalfordSpacing.l)
            .salfordCard()
        }
    }

    // MARK: Brands

    @ViewBuilder private var brandBreakdown: some View {
        let totals: [CategoryTotal] = {
            var map: [String: Double] = [:]
            for s in monthSales {
                // Brand at sale time; older sales fall back to the piece's current brand.
                let b = s.brand ?? store.products.first(where: { $0.id == s.productId })?.brand ?? POSDataStore.noBrandLabel
                map[b, default: 0] += s.totalSell
            }
            return map.map { CategoryTotal(category: $0.key, total: $0.value) }.sorted { $0.total > $1.total }
        }()
        // Only worth showing when at least one sale this month has a brand.
        if totals.contains(where: { $0.category != POSDataStore.noBrandLabel }) {
            let maxTotal = max(totals.map(\.total).max() ?? 1, 0.001)
            VStack(alignment: .leading, spacing: SalfordSpacing.m) {
                SalfordSectionTitle(title: "المبيعات حسب الماركة", icon: "seal.fill")
                ForEach(totals) { item in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(item.category)
                                .font(.system(.subheadline, weight: .semibold))
                                .foregroundColor(SalfordTheme.textPrimary)
                            Spacer()
                            Text(Money.lyd(item.total))
                                .font(.system(.subheadline, weight: .bold))
                                .foregroundColor(SalfordTheme.textPrimary)
                        }
                        GeometryReader { geo in
                            Capsule()
                                .fill(SalfordTheme.silverAccent.opacity(0.7))
                                .frame(width: max(6, geo.size.width * CGFloat(item.total / maxTotal)))
                        }
                        .frame(height: 6)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
            .padding(SalfordSpacing.l)
            .salfordCard()
        }
    }

    // MARK: Recent sales

    private var recentSales: some View {
        let latest = Array(store.sales.prefix(5))
        return VStack(alignment: .leading, spacing: SalfordSpacing.s) {
            HStack {
                SalfordSectionTitle(title: "آخر المبيعات", icon: "clock.arrow.circlepath")
                NavigationLink("الكل") { SalesHistoryView() }
                    .font(.system(.subheadline, weight: .semibold))
            }
            if latest.isEmpty {
                SalfordEmptyState(icon: "cart", title: "لا توجد مبيعات بعد", message: "ابدأ من تبويب «البيع».")
            }
            ForEach(latest) { sale in
                Button {
                    store.openReceiptForSale(sale)
                } label: {
                    HStack(spacing: SalfordSpacing.m) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(sale.productName)
                                .font(.system(.subheadline, weight: .bold))
                                .foregroundColor(SalfordTheme.textPrimary)
                                .lineLimit(1)
                            Text("\(sale.customerName ?? "زبون نقدي") • \(sale.paymentMethod) • \(String(sale.saleDate.prefix(16)))")
                                .font(.system(.caption))
                                .foregroundColor(SalfordTheme.textMuted)
                                .lineLimit(1)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 2) {
                            Text(Money.lyd(sale.totalSell))
                                .font(.system(.subheadline, weight: .heavy))
                                .foregroundColor(SalfordTheme.textPrimary)
                            Text("ربح \(Money.plain(sale.profit))")
                                .font(.system(.caption, weight: .semibold))
                                .foregroundColor(SalfordTheme.emeraldSuccess)
                        }
                        Image(systemName: "doc.text")
                            .foregroundColor(SalfordTheme.gold)
                    }
                    .frame(minHeight: SalfordSpacing.touch)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityHint("يفتح فاتورة البيعة")
                if sale.id != latest.last?.id {
                    Divider()
                }
            }
        }
        .padding(SalfordSpacing.l)
        .salfordCard()
    }

    // MARK: Stock value

    private func stockValueCard(rate: Double) -> some View {
        let units = store.products.reduce(0) { $0 + $1.stock }
        let costValue = store.products.reduce(0.0) { $0 + $1.costPrice * Double($1.stock) }
        let sellValue = store.products.reduce(0.0) { $0 + $1.sellPrice * Double($1.stock) }
        return VStack(alignment: .leading, spacing: SalfordSpacing.s) {
            SalfordSectionTitle(title: "المخزون", icon: "cube.box.fill")
            HStack {
                stockStat("القطع", "\(units)")
                Divider().frame(height: 36)
                stockStat("بالتكلفة", Money.lyd(costValue))
                Divider().frame(height: 36)
                stockStat("بسعر البيع", Money.lyd(sellValue))
            }
            Text(String(format: "قيمة التكلفة ≈ %.0f دولار • %d صنف", costValue / rate, store.products.count))
                .font(.system(.caption))
                .foregroundColor(SalfordTheme.textMuted)
        }
        .padding(SalfordSpacing.l)
        .salfordCard()
    }

    private func stockStat(_ title: String, _ value: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(.subheadline, weight: .heavy))
                .foregroundColor(SalfordTheme.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(title)
                .font(.system(.caption))
                .foregroundColor(SalfordTheme.textMuted)
        }
        .frame(maxWidth: .infinity)
    }
}

/// Icon above the title — used for the dashboard's quick-action buttons.
struct VerticalLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        VStack(spacing: 4) {
            configuration.icon.font(.system(.title3))
            configuration.title.font(.system(.caption, weight: .bold)).lineLimit(1).minimumScaleFactor(0.8)
        }
        .padding(.vertical, 6)
    }
}
