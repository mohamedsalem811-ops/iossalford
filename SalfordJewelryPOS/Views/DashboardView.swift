import SwiftUI
import Charts

struct DashboardView: View {
    @EnvironmentObject var store: POSDataStore
    @Binding var selectedTab: AppTab
    @State private var selectedMonth: String = ""

    private var activeMonth: String {
        selectedMonth.isEmpty ? store.currentMonthYear() : selectedMonth
    }

    private var monthSales: [SaleRecord] {
        store.sales.filter { $0.monthYear == activeMonth }
    }

    private var monthReturns: [ReturnRecord] {
        store.returns.filter { $0.monthYear == activeMonth }
    }

    private var monthExpenses: [ExpenseRecord] {
        store.expenses.filter { $0.monthYear == activeMonth }
    }

    private var stockAlertText: String {
        let out = lowStockProducts.filter(\.isOutOfStock).count
        let low = lowStockProducts.count - out
        var parts: [String] = []
        if out > 0 { parts.append("\(out) نفدت") }
        if low > 0 { parts.append("\(low) قاربت على النفاد") }
        return "تنبيه المخزون: " + parts.joined(separator: " • ")
    }

    private var lowStockProducts: [Product] {
        // Out-of-stock pieces matter most, so they are included (and listed first).
        store.products.filter { $0.isLowStock || $0.isOutOfStock }
            .sorted { ($0.isOutOfStock ? 0 : 1, $0.stock) < ($1.isOutOfStock ? 0 : 1, $1.stock) }
    }

    var body: some View {
        let monthSummary = store.summary(forMonth: activeMonth)
        let revenue = monthSummary.grossSales
        let grossProfit = monthSummary.grossProfit
        let totalExpenses = monthSummary.expenses
        // Net profit now also subtracts what returns cost the shop (refund minus the piece's cost).
        let netProfit = monthSummary.netProfit
        let rate = store.exchangeRate > 0 ? store.exchangeRate : 7.0
        let totalStockUnits = store.products.reduce(0) { $0 + $1.stock }
        let stockCostValue = store.products.reduce(0.0) { $0 + ($1.costPrice * Double($1.stock)) }
        let marginPct = revenue > 0 ? Int((grossProfit / revenue) * 100.0) : 0

        let columns = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]

        ScrollView {
            VStack(spacing: 14) {
                if !lowStockProducts.isEmpty {
                    Button {
                        selectedTab = .products
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(SalfordTheme.warningAmber)
                            Text(stockAlertText)
                                .font(.system(.footnote, weight: .bold))
                                .foregroundColor(SalfordTheme.textPrimary)
                            Spacer()
                            Image(systemName: "chevron.left")
                                .font(.system(.footnote, weight: .bold))
                                .foregroundColor(SalfordTheme.silverAccent)
                        }
                        .padding(12)
                        .background(SalfordTheme.warningAmber.opacity(0.18))
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(SalfordTheme.warningAmber.opacity(0.5), lineWidth: 1)
                        )
                    }
                }

                // 2x2 Primary KPI Grid (Pure Arabic BiDi-safe subtitles)
                LazyVGrid(columns: columns, spacing: 10) {
                    KPIStatCard(
                        title: "إجمالي المبيعات",
                        value: Money.lyd(revenue),
                        subtitle: String(format: "%.1f دولار • %d عملية", revenue / rate, monthSales.count),
                        icon: "banknote.fill",
                        accentColor: SalfordTheme.silverAccent
                    )
                    KPIStatCard(
                        title: "إجمالي الربح",
                        value: Money.lyd(grossProfit),
                        subtitle: String(format: "%.1f دولار • الهامش %d بالمئة", grossProfit / rate, marginPct),
                        icon: "chart.line.uptrend.xyaxis",
                        accentColor: SalfordTheme.emeraldSuccess
                    )
                    KPIStatCard(
                        title: "إجمالي المصاريف",
                        value: Money.lyd(totalExpenses),
                        subtitle: "\(monthExpenses.count) بند مصروفات",
                        icon: "arrow.down.right.circle.fill",
                        accentColor: SalfordTheme.dangerRed
                    )
                    KPIStatCard(
                        title: "صافي الربح",
                        value: Money.lyd(netProfit),
                        subtitle: String(format: "%.1f دولار صافي", netProfit / rate),
                        icon: "crown.fill",
                        accentColor: netProfit >= 0 ? SalfordTheme.emeraldSuccess : SalfordTheme.dangerRed
                    )
                }

                // 2x2 Secondary KPI Strip
                LazyVGrid(columns: columns, spacing: 10) {
                    KPIStatCard(
                        title: "إجمالي القطع بالمخزن",
                        value: "\(totalStockUnits) قطعة",
                        subtitle: "\(store.products.count) صنف مسجل",
                        icon: "cube.box.fill",
                        accentColor: SalfordTheme.infoBlue
                    )
                    KPIStatCard(
                        title: "قيمة المخزون بالتكلفة",
                        value: Money.lyd(stockCostValue),
                        subtitle: String(format: "%.0f دولار بسعر الصرف", stockCostValue / rate),
                        icon: "shield.lefthalf.filled",
                        accentColor: SalfordTheme.silverLight
                    )
                }

                // Quick Action Bar
                HStack(spacing: 10) {
                    Button {
                        selectedTab = .sale
                    } label: {
                        Label("تسجيل بيعة جديدة", systemImage: "plus.circle.fill")
                            .font(.system(.subheadline, weight: .bold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 11)
                            .background(SalfordTheme.silverGradient)
                            .foregroundColor(SalfordTheme.onPrimary)
                            .cornerRadius(12)
                    }

                    Button {
                        store.openNewDraftReceipt(items: [])
                    } label: {
                        Label("إصدار فاتورة هدية", systemImage: "gift.fill")
                            .font(.system(.subheadline, weight: .bold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 11)
                            .background(SalfordTheme.royalNavyMid)
                            .foregroundColor(SalfordTheme.silverLight)
                            .cornerRadius(12)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(SalfordTheme.borderSubtle, lineWidth: 1)
                            )
                    }
                }

                // Native Swift Charts: Sales & Profit Breakdown
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Image(systemName: "chart.bar.fill")
                            .foregroundColor(SalfordTheme.silverAccent)
                        Text("أداء المبيعات والربح للعمليات")
                            .font(.system(.subheadline, weight: .bold))
                            .foregroundColor(SalfordTheme.silverLight)
                        Spacer()
                        Text(activeMonth)
                            .font(.system(.caption, weight: .bold))
                            .foregroundColor(SalfordTheme.goldLight)
                    }

                    if monthSales.isEmpty {
                        Text("لا توجد مبيعات مسجلة في هذا الشهر حتى الآن")
                            .font(.system(.footnote))
                            .foregroundColor(SalfordTheme.textMuted)
                            .frame(maxWidth: .infinity, minHeight: 140)
                    } else {
                        Chart {
                            ForEach(Array(monthSales.prefix(6).reversed())) { sale in
                                BarMark(
                                    x: .value("العملية", "#\(sale.id)"),
                                    y: .value("المبيعات", sale.totalSell)
                                )
                                .foregroundStyle(SalfordTheme.silverAccent)
                                .cornerRadius(5)

                                LineMark(
                                    x: .value("العملية", "#\(sale.id)"),
                                    y: .value("الربح", sale.profit)
                                )
                                .foregroundStyle(SalfordTheme.emeraldSuccess)
                                .symbol(Circle())
                            }
                        }
                        .frame(height: 185)
                        .chartYAxis {
                            AxisMarks(position: .leading)
                        }
                    }
                }
                .salfordCard()

                // Category Revenue Breakdown
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Image(systemName: "chart.pie.fill")
                            .foregroundColor(SalfordTheme.silverAccent)
                        Text("توزيع المبيعات حسب الفئة")
                            .font(.system(.subheadline, weight: .bold))
                            .foregroundColor(SalfordTheme.silverLight)
                        Spacer()
                    }

                    let catTotals = categoryBreakdown()
                    ForEach(catTotals, id: \.category) { item in
                        HStack {
                            Text(item.category)
                                .font(.system(.subheadline, weight: .semibold))
                                .foregroundColor(SalfordTheme.textPrimary)
                            Spacer()
                            Text(Money.lyd(item.total))
                                .font(.system(.subheadline, weight: .bold))
                                .foregroundColor(SalfordTheme.silverLight)
                        }
                        .padding(.vertical, 4)
                    }
                }
                .salfordCard()

                // Recent Sales List with Instant Gift Receipt Action
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Image(systemName: "clock.arrow.circlepath")
                            .foregroundColor(SalfordTheme.silverAccent)
                        Text("آخر المبيعات المسجلة")
                            .font(.system(.subheadline, weight: .bold))
                            .foregroundColor(SalfordTheme.silverLight)
                        Spacer()
                    }

                    ForEach(monthSales.prefix(6)) { sale in
                        HStack(spacing: 10) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(sale.productName)
                                    .font(.system(.subheadline, weight: .bold))
                                    .foregroundColor(SalfordTheme.textPrimary)
                                Text("\(sale.customerName ?? "زبون نقدي") • \(sale.paymentMethod) • الكمية \(sale.quantity)")
                                    .font(.system(.caption))
                                    .foregroundColor(SalfordTheme.textMuted)
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 3) {
                                Text(Money.lyd(sale.totalSell))
                                    .font(.system(.subheadline, weight: .heavy))
                                    .foregroundColor(SalfordTheme.silverLight)
                                Text(String(format: "الربح %@ د.ل", Money.plain(sale.profit)))
                                    .font(.system(.caption, weight: .bold))
                                    .foregroundColor(SalfordTheme.emeraldSuccess)
                            }
                            Button {
                                store.openReceiptForSale(sale)
                            } label: {
                                Image(systemName: "printer.fill")
                                    .font(.system(.subheadline))
                                    .padding(8)
                                    .background(SalfordTheme.royalNavyMid)
                                    .foregroundColor(SalfordTheme.silverLight)
                                    .cornerRadius(8)
                            }
                        }
                        .padding(.vertical, 6)
                        Divider().background(SalfordTheme.borderSubtle)
                    }
                }
                .salfordCard()
            }
            .padding(14)
        }
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("لوحة التحكم")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                HStack(spacing: 6) {
                    Text("SJ")
                        .font(.system(.subheadline, design: .serif, weight: .black))
                        .foregroundColor(SalfordTheme.silverLight)
                        .padding(5)
                        .background(SalfordTheme.bgPrimary.opacity(0.6))
                        .clipShape(Circle())
                    Text(String(format: "الدولار %.2f د.ل", store.exchangeRate))
                        .font(.system(.caption, weight: .bold))
                        .foregroundColor(SalfordTheme.emeraldSuccess)
                }
            }
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    withAnimation {
                        store.lock()
                    }
                } label: {
                    Image(systemName: "lock.fill")
                        .foregroundColor(SalfordTheme.silverLight)
                }
            }
        }
    }

    private func categoryBreakdown() -> [(category: String, total: Double)] {
        var map: [String: Double] = [:]
        for s in monthSales {
            let cat = store.products.first(where: { $0.id == s.productId })?.category ?? "أخرى"
            map[cat, default: 0] += s.totalSell
        }
        return map.map { ($0.key, $0.value) }.sorted { $0.total > $1.total }
    }
}
