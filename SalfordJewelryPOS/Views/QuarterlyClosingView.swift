import SwiftUI

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
                        Text("\(sum.transactions) عملية بيع • \(sum.itemsSold) قطعة مباعة • مبالغ مستردة \(Money.lyd(sum.refunds))")
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
                            Text(String(format: "الصافي: %@ د.ل", Money.plain(cls.totalProfit)))
                                .font(.system(size: 13, weight: .heavy))
                                .foregroundColor(SalfordTheme.emeraldSuccess)
                        }
                        Text(String(format: "المبيعات: %@ د.ل • المرتجعات: %@ د.ل • المصاريف: %@ د.ل • القطع المباعة: %d", Money.plain(cls.totalSales), Money.plain(cls.totalRefunds), Money.plain(cls.totalExpenses), cls.itemsSold))
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
            Text(Money.lyd(value))
                .font(.system(size: 12.5, weight: bold ? .heavy : .semibold))
                .foregroundColor(color)
        }
    }
}
