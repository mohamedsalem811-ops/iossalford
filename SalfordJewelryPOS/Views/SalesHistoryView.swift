import SwiftUI

struct SalesHistoryView: View {
    @EnvironmentObject var store: POSDataStore
    @State private var saleToDelete: SaleRecord? = nil
    @State private var search: String = ""
    @State private var payment: String = "الكل"

    private var filteredSales: [SaleRecord] {
        let q = NumberInput.latinDigits(search).trimmingCharacters(in: .whitespaces)
        return store.sales.filter { s in
            (payment == "الكل" || s.paymentMethod == payment)
                && (q.isEmpty
                    || s.productName.localizedCaseInsensitiveContains(q)
                    || (s.customerName ?? "").localizedCaseInsensitiveContains(q)
                    || (s.sku ?? "").localizedCaseInsensitiveContains(q)
                    || "\(s.id)" == q.replacingOccurrences(of: "#", with: ""))
        }
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 10) {
                Picker("طريقة الدفع", selection: $payment) {
                    ForEach(["الكل", "كاش", "بطاقة", "تحويل", "آجل"], id: \.self) { Text($0).tag($0) }
                }
                .pickerStyle(.segmented)

                if store.sales.isEmpty {
                    SalfordEmptyState(icon: "cart", title: "لا توجد مبيعات بعد", message: "تظهر هنا كل عملية بيع مع فاتورتها.")
                } else if filteredSales.isEmpty {
                    SalfordEmptyState(icon: "magnifyingglass", title: "لا توجد نتائج", message: "ابحث بالقطعة أو الزبون أو رقم البيعة.")
                } else {
                    Text("\(filteredSales.count) عملية • \(Money.lyd(filteredSales.reduce(0) { $0 + $1.totalSell }))")
                        .font(.system(.footnote, weight: .semibold))
                        .foregroundColor(SalfordTheme.textMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                ForEach(filteredSales) { sale in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("#\(sale.id) \(sale.productName)")
                                .font(.system(.subheadline, weight: .bold))
                                .foregroundColor(SalfordTheme.textPrimary)
                            Spacer()
                            Text(Money.lyd(sale.totalSell))
                                .font(.system(.subheadline, weight: .heavy))
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
                        .font(.system(.caption))
                        .foregroundColor(SalfordTheme.textMuted)

                        HStack {
                            HStack(spacing: 8) {
                                Text(String(format: "الربح: %@ د.ل", Money.plain(sale.profit)))
                                    .font(.system(.caption, weight: .bold))
                                    .foregroundColor(SalfordTheme.emeraldSuccess)
                                Text(String(format: "المعادل: %.1f دولار", sale.totalSellUSD))
                                    .font(.system(.caption, weight: .semibold))
                                    .foregroundColor(SalfordTheme.goldLight)
                            }
                            Spacer()
                            Button {
                                store.openReceiptForSale(sale)
                            } label: {
                                Label("فاتورة", systemImage: "printer.fill")
                                    .font(.system(.caption, weight: .bold))
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
                                    .font(.system(.footnote))
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
        .searchable(text: $search, prompt: "القطعة أو الزبون أو رقم البيعة")
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
