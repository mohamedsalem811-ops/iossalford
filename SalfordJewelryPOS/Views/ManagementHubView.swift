import SwiftUI

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
                        ReceiptsHistoryView()
                    } label: {
                        ManagementRowCard(
                            title: "سجل الفواتير",
                            subtitle: "البحث عن أي فاتورة صادرة وإعادة طباعتها أو مشاركتها",
                            badgeText: "\(store.receipts.count) فاتورة",
                            icon: "doc.text.magnifyingglass",
                            accent: SalfordTheme.goldLight
                        )
                    }

                    NavigationLink {
                        DebtsView()
                    } label: {
                        ManagementRowCard(
                            title: "الديون والتحصيل (آجل)",
                            subtitle: "من عليه دين، وتسجيل الدفعات المستلمة من الزبائن",
                            badgeText: Money.lyd(store.totalOutstanding),
                            icon: "creditcard.and.123",
                            accent: SalfordTheme.dangerRed
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
                            badgeText: Money.lyd(store.exchangeRate),
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
