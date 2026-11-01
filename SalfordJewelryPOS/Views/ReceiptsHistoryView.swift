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
                if filtered.isEmpty {
                    if store.receipts.isEmpty {
                        SalfordEmptyState(icon: "doc.text", title: "لم تصدر أي فاتورة بعد",
                                          message: "تُحفظ فاتورة كل بيعة هنا تلقائياً. لإصدار فاتورة هدية اضغط ＋ في الأعلى.")
                    } else {
                        SalfordEmptyState(icon: "magnifyingglass", title: "لا توجد نتائج", message: "جرّب رقم الفاتورة أو اسم الزبون أو القطعة")
                    }
                }

                ForEach(filtered) { r in
                    Button {
                        store.openReceipt(r)
                    } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(r.receiptNo)
                                    .font(.system(.subheadline, design: .monospaced, weight: .heavy))
                                    .foregroundColor(SalfordTheme.textPrimary)
                                Spacer()
                                Text(Money.lyd(r.total))
                                    .font(.system(.subheadline, weight: .heavy))
                                    .foregroundColor(SalfordTheme.silverLight)
                            }
                            Text("\(r.customer) • \(r.date) \(r.time) • \(r.items.count) سطر")
                                .font(.system(.caption))
                                .foregroundColor(SalfordTheme.textMuted)
                            Text(r.items.map(\.fullTitle).joined(separator: "، "))
                                .font(.system(.caption))
                                .foregroundColor(SalfordTheme.silverAccent)
                                .lineLimit(2)
                            HStack(spacing: 6) {
                                Text(r.saleIds.isEmpty ? "فاتورة هدية يدوية" : "بيعة " + r.saleIds.map { "#\($0)" }.joined(separator: " "))
                                Text("•")
                                Text(r.showRealPrices ? "بالأسعار" : "بدون أسعار")
                                Text("•")
                                Text(r.template.title)
                            }
                            .font(.system(.caption))
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
        .navigationTitle("الفواتير")
        .searchable(text: $search, prompt: "رقم الفاتورة أو الزبون أو القطعة")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    store.openNewDraftReceipt(items: [])
                } label: {
                    Label("فاتورة جديدة", systemImage: "plus")
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
    }
}
