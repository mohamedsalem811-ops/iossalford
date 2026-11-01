import SwiftUI

/// Management tab: everything that isn't selling, grouped the way a shop owner thinks about it.
struct MoreManagementHubView: View {
    @EnvironmentObject var store: POSDataStore

    var body: some View {
        List {
            Section("المبيعات والزبائن") {
                hubLink(SalesHistoryView(), title: "سجل المبيعات", subtitle: "كل العمليات، الفاتورة، والحذف عند الخطأ",
                        badge: "\(store.sales.count)", icon: "list.bullet.rectangle.portrait.fill", color: .blue)
                hubLink(DebtsView(), title: "الديون والتحصيل", subtitle: "من عليه دين (آجل) وتسجيل الدفعات",
                        badge: store.totalOutstanding > 0 ? Money.lyd(store.totalOutstanding) : nil,
                        badgeColor: SalfordTheme.dangerRed, icon: "creditcard.fill", color: .red)
                hubLink(CustomersManagementView(), title: "الزبائن", subtitle: "بيانات الزبائن ومشترياتهم",
                        badge: "\(store.customers.count)", icon: "person.2.fill", color: .green)
                hubLink(BrandsManagementView(), title: "الماركات", subtitle: "قائمة الماركات التي تعمل بها",
                        badge: "\(store.brands.count)", icon: "seal.fill", color: .yellow)
                hubLink(SetsManagementView(), title: "الأطقم", subtitle: "أطقم بقطع محددة وخصم خاص",
                        badge: "\(store.sets.count)", icon: "sparkles", color: .orange)
            }

            Section("المال والتقارير") {
                hubLink(ExpensesAndReturnsView(), title: "المصاريف والمرتجعات", subtitle: "مصاريف المحل وإرجاع القطع للمخزن",
                        badge: nil, icon: "arrow.left.arrow.right", color: .pink)
                hubLink(MonthlyComparisonChartView(), title: "مقارنة الأشهر", subtitle: "المبيعات وصافي الربح شهراً بشهر",
                        badge: nil, icon: "chart.xyaxis.line", color: .teal)
                hubLink(QuarterlyClosingView(), title: "الإقفال الربع سنوي", subtitle: "اعتماد نتائج كل ثلاثة أشهر",
                        badge: "\(store.closings.count)", icon: "checkmark.seal.fill", color: .indigo)
            }

            Section("النظام") {
                hubLink(SettingsAndBackupView(), title: "الإعدادات والنسخ الاحتياطي", subtitle: "سعر الصرف، رمز الدخول، حفظ واستعادة البيانات",
                        badge: store.isUsingDefaultPin ? "غيّر الرمز" : nil, badgeColor: SalfordTheme.warningAmber,
                        icon: "gearshape.fill", color: .gray)
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("الإدارة")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func hubLink<Destination: View>(
        _ destination: Destination,
        title: String,
        subtitle: String,
        badge: String?,
        badgeColor: Color = SalfordTheme.textMuted,
        icon: String,
        color: Color
    ) -> some View {
        NavigationLink {
            destination
        } label: {
            HStack(spacing: SalfordSpacing.m) {
                Image(systemName: icon)
                    .font(.system(.body, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(width: 34, height: 34)
                    .background(color.gradient)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(.body, weight: .semibold))
                        .foregroundColor(SalfordTheme.textPrimary)
                    Text(subtitle)
                        .font(.system(.caption))
                        .foregroundColor(SalfordTheme.textMuted)
                        .lineLimit(2)
                }
                Spacer(minLength: 4)
                if let badge {
                    Text(badge)
                        .font(.system(.footnote, weight: .bold))
                        .foregroundColor(badgeColor)
                }
            }
            .padding(.vertical, 4)
        }
        .listRowBackground(SalfordTheme.bgCard)
    }
}
