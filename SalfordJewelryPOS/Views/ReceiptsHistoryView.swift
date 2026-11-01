import SwiftUI

/// Every issued receipt, newest first, searchable; tap to reopen and reprint.
struct ReceiptsHistoryView: View {
    @EnvironmentObject var store: POSDataStore
    @State private var search: String = ""

    private var filtered: [IssuedReceipt] {
        guard !search.isEmpty else { return store.receipts }
        let q = NumberInput.latinDigits(search)
        return store.receipts.filter { r in
            r.receiptNo.localizedCaseInsensitiveContains(q)
                || r.customer.localizedCaseInsensitiveContains(q)
                || r.items.contains { $0.name.localizedCaseInsensitiveContains(q) || $0.code.localizedCaseInsensitiveContains(q) }
        }
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 10) {
                TextField("ابحث برقم الفاتورة أو اسم الزبون أو القطعة", text: $search)
                    .padding(10)
                    .background(SalfordTheme.bgElevated)
                    .foregroundColor(.white)
                    .cornerRadius(10)

                if filtered.isEmpty {
                    Text(store.receipts.isEmpty ? "لم تصدر أي فاتورة بعد" : "لا توجد نتائج")
                        .font(.system(size: 13))
                        .foregroundColor(SalfordTheme.textMuted)
                        .padding(.top, 30)
                }

                ForEach(filtered) { r in
                    Button {
                        store.openReceipt(r)
                    } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(r.receiptNo)
                                    .font(.system(size: 13.5, weight: .heavy, design: .monospaced))
                                    .foregroundColor(.white)
                                Spacer()
                                Text(Money.lyd(r.total))
                                    .font(.system(size: 13.5, weight: .heavy))
                                    .foregroundColor(SalfordTheme.silverLight)
                            }
                            Text("\(r.customer) • \(r.date) \(r.time) • \(r.items.count) سطر")
                                .font(.system(size: 11.5))
                                .foregroundColor(SalfordTheme.textMuted)
                            Text(r.items.map(\.fullTitle).joined(separator: "، "))
                                .font(.system(size: 11.5))
                                .foregroundColor(SalfordTheme.silverAccent)
                                .lineLimit(2)
                            HStack(spacing: 6) {
                                Text(r.saleIds.isEmpty ? "فاتورة هدية يدوية" : "بيعة " + r.saleIds.map { "#\($0)" }.joined(separator: " "))
                                Text("•")
                                Text(r.showRealPrices ? "بالأسعار" : "بدون أسعار")
                                Text("•")
                                Text(r.template.title)
                            }
                            .font(.system(size: 10.5))
                            .foregroundColor(SalfordTheme.goldLight)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .salfordCard()
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(14)
        }
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("سجل الفواتير")
        .navigationBarTitleDisplayMode(.inline)
    }
}
