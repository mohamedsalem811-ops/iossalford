import SwiftUI

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
                            Text(Money.lyd(sale.totalSell))
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
                                Text(String(format: "الربح: %@ د.ل", Money.plain(sale.profit)))
                                    .font(.system(size: 11.5, weight: .bold))
                                    .foregroundColor(SalfordTheme.emeraldSuccess)
                                Text(String(format: "المعادل: %.1f دولار", sale.totalSellUSD))
                                    .font(.system(size: 11.5, weight: .semibold))
                                    .foregroundColor(SalfordTheme.goldLight)
                            }
                            Spacer()
                            Button {
                                store.openReceiptForSale(sale)
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
