import SwiftUI
import Charts

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
                        .font(.system(.subheadline, weight: .bold))
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
                                .font(.system(.subheadline, weight: .bold))
                                .foregroundColor(SalfordTheme.textPrimary)
                            Spacer()
                            Text(String(format: "المبيعات: %@ \(unitLabel)", Money.plain(item.sales)))
                                .font(.system(.subheadline, weight: .bold))
                                .foregroundColor(SalfordTheme.silverLight)
                        }
                        HStack {
                            Text(String(format: "إجمالي الربح: %@ \(unitLabel)", Money.plain(item.profit)))
                                .font(.system(.footnote))
                                .foregroundColor(SalfordTheme.goldLight)
                            Spacer()
                            Text(String(format: "صافي الربح: %@ \(unitLabel)", Money.plain(item.netProfit)))
                                .font(.system(.footnote, weight: .bold))
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
