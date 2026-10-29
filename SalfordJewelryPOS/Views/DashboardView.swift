import SwiftUI
import Charts

struct DashboardView: View {
    @EnvironmentObject var store: POSDataStore
    @Binding var selectedTab: Int
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

    private var lowStockProducts: [Product] {
        store.products.filter { $0.isLowStock }
    }

    var body: some View {
        let revenue = monthSales.reduce(0.0) { $0 + $1.totalSell }
        let grossProfit = monthSales.reduce(0.0) { $0 + $1.profit }
        let totalExpenses = monthExpenses.reduce(0.0) { $0 + $1.amount }
        let netProfit = grossProfit - totalExpenses
        let rate = store.exchangeRate > 0 ? store.exchangeRate : 7.0
        let totalStockUnits = store.products.reduce(0) { $0 + $1.stock }
        let stockCostValue = store.products.reduce(0.0) { $0 + ($1.costPrice * Double($1.stock)) }
        let marginPct = revenue > 0 ? Int((grossProfit / revenue) * 100.0) : 0

        let columns = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]

        ScrollView {
            VStack(spacing: 14) {
                // Low-stock alert banner if any
                if !lowStockProducts.isEmpty {
                    Button {
                        selectedTab = 3
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(SalfordTheme.warningAmber)
                            Text("تنبيه المخزون: \(lowStockProducts.count) منتجات قاربت على النفاد")
                                .font(.system(size: 12.5, weight: .bold))
                                .foregroundColor(.white)
                            Spacer()
                            Image(systemName: "chevron.left")
                                .font(.system(size: 12, weight: .bold))
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

                // 2x2 Primary KPI Grid
                LazyVGrid(columns: columns, spacing: 10) {
                    KPIStatCard(
                        title: "إجمالي المبيعات",
                        value: String(format: "%.0f د.ل", revenue),
                        subtitle: String(format: "$%.1f • %d عملية", revenue / rate, monthSales.count),
                        icon: "banknote.fill",
                        accentColor: SalfordTheme.silverAccent
                    )
                    KPIStatCard(
                        title: "إجمالي الربح",
                        value: String(format: "%.0f د.ل", grossProfit),
                        subtitle: String(format: "$%.1f • هامش %d%%", grossProfit / rate, marginPct),
                        icon: "chart.line.uptrend.xyaxis",
                        accentColor: SalfordTheme.emeraldSuccess
                    )
                    KPIStatCard(
                        title: "المصاريف",
                        value: String(format: "%.0f د.ل", totalExpenses),
                        subtitle: "\(monthExpenses.count) بند مصروفات",
                        icon: "arrow.down.right.circle.fill",
                        accentColor: SalfordTheme.dangerRed
                    )
                    KPIStatCard(
                        title: "صافي الربح",
                        value: String(format: "%.0f د.ل", netProfit),
                        subtitle: String(format: "$%.1f صافي", netProfit / rate),
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
                        title: "قيمة المخزون (تكلفة)",
                        value: String(format: "%.0f د.ل", stockCostValue),
                        subtitle: String(format: "$%.0f بسعر الصرف", stockCostValue / rate),
                        icon: "shield.lefthalf.filled",
                        accentColor: SalfordTheme.silverLight
                    )
                }

                // Quick Action Bar
                HStack(spacing: 10) {
                    Button {
                        selectedTab = 1
                    } label: {
                        Label("تسجيل بيعة جديدة", systemImage: "plus.circle.fill")
                            .font(.system(size: 13, weight: .bold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 11)
                            .background(SalfordTheme.silverGradient)
                            .foregroundColor(SalfordTheme.bgPrimary)
                            .cornerRadius(12)
                    }

                    Button {
                        store.openReceiptStudio(saleId: store.sales.first?.id ?? 1, items: [], customer: "Salford Libya")
                    } label: {
                        Label("إصدار فاتورة هدية", systemImage: "gift.fill")
                            .font(.system(size: 13, weight: .bold))
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
                        Text("أداء المبيعات والربح للعمليات (\(activeMonth))")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(SalfordTheme.silverLight)
                        Spacer()
                    }

                    if monthSales.isEmpty {
                        Text("لا توجد مبيعات مسجلة في هذا الشهر حتى الآن")
                            .font(.system(size: 12))
                            .foregroundColor(SalfordTheme.textMuted)
                            .frame(maxWidth: .infinity, minHeight: 140)
                    } else {
                        Chart {
                            ForEach(monthSales.prefix(8).reversed()) { sale in
                                BarMark(
                                    x: .value("المنتج", String(sale.productName.prefix(10))),
                                    y: .value("المبيعات", sale.totalSell)
                                )
                                .foregroundStyle(SalfordTheme.silverAccent.gradient)
                                .cornerRadius(5)

                                LineMark(
                                    x: .value("المنتج", String(sale.productName.prefix(10))),
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
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(SalfordTheme.silverLight)
                        Spacer()
                    }

                    let catTotals = categoryBreakdown()
                    ForEach(catTotals, id: \.category) { item in
                        HStack {
                            Text(item.category)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(.white)
                            Spacer()
                            Text(String(format: "%.0f د.ل", item.total))
                                .font(.system(size: 13, weight: .bold))
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
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(SalfordTheme.silverLight)
                        Spacer()
                    }

                    ForEach(monthSales.prefix(6)) { sale in
                        HStack(spacing: 10) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(sale.productName)
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundColor(.white)
                                Text("\(sale.customerName ?? "زبون نقدي") • \(sale.paymentMethod) • \(sale.quantity)x")
                                    .font(.system(size: 11))
                                    .foregroundColor(SalfordTheme.textMuted)
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 3) {
                                Text(String(format: "%.0f د.ل", sale.totalSell))
                                    .font(.system(size: 13, weight: .heavy))
                                    .foregroundColor(SalfordTheme.silverLight)
                                Text(String(format: "ربح: +%.0f", sale.profit))
                                    .font(.system(size: 10.5, weight: .bold))
                                    .foregroundColor(SalfordTheme.emeraldSuccess)
                            }
                            Button {
                                store.openReceiptStudio(
                                    saleId: sale.id,
                                    items: [
                                        ReceiptLineItem(
                                            name: sale.productName,
                                            color: sale.color ?? "",
                                            code: sale.sku ?? "SFD-\(sale.productId)",
                                            qty: sale.quantity,
                                            price: sale.actualPrice
                                        )
                                    ],
                                    customer: sale.customerName ?? "Salford Libya"
                                )
                            } label: {
                                Image(systemName: "printer.fill")
                                    .font(.system(size: 13))
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
            ToolbarItem(placement: .topBarLeading) {
                HStack(spacing: 6) {
                    Text("SJ")
                        .font(.system(size: 13, weight: .black, design: .serif))
                        .foregroundColor(SalfordTheme.silverLight)
                        .padding(5)
                        .background(SalfordTheme.bgPrimary.opacity(0.6))
                        .clipShape(Circle())
                    Text(String(format: "$1 = %.2f د.ل", store.exchangeRate))
                        .font(.system(size: 11.5, weight: .bold))
                        .foregroundColor(SalfordTheme.emeraldSuccess)
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    withAnimation {
                        store.isAuthenticated = false
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
