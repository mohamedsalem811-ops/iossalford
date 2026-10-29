import SwiftUI

struct GiftReceiptStudioView: View {
    @EnvironmentObject var store: POSDataStore
    var isModalSheet: Bool = false
    @Environment(\.dismiss) private var dismiss
    @State private var generatedPDFURL: URL? = nil

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                // Template & Price Mode Controls
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Image(systemName: "wand.and.stars")
                            .foregroundColor(SalfordTheme.silverAccent)
                        Text("تخصيص قالب الفاتورة والأسعار")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(SalfordTheme.silverLight)
                        Spacer()
                    }

                    Picker("قالب الفاتورة", selection: $store.activeReceiptTemplate) {
                        ForEach(ReceiptTemplate.allCases) { tpl in
                            Text(tpl.title).tag(tpl)
                        }
                    }
                    .pickerStyle(.segmented)

                    Toggle(isOn: $store.showRealPricesInReceipt) {
                        Text(store.showRealPricesInReceipt ? "إظهار الأسعار الفعلية (فاتورة رسمية)" : "إخفاء الأسعار (Price: XXX — فاتورة هدية)")
                            .font(.system(size: 12.5, weight: .bold))
                            .foregroundColor(SalfordTheme.silverLight)
                    }
                    .tint(SalfordTheme.emeraldSuccess)

                    HStack(spacing: 10) {
                        TextField("رقم الفاتورة", text: $store.activeReceiptNo)
                            .padding(9)
                            .background(SalfordTheme.bgElevated)
                            .foregroundColor(.white)
                            .cornerRadius(9)

                        TextField("اسم الزبون", text: $store.activeReceiptCustomer)
                            .padding(9)
                            .background(SalfordTheme.bgElevated)
                            .foregroundColor(.white)
                            .cornerRadius(9)
                    }

                    // Line Items Editor
                    ForEach($store.activeReceiptItems) { $item in
                        VStack(spacing: 8) {
                            HStack(spacing: 8) {
                                TextField("اسم القطعة", text: $item.name)
                                    .font(.system(size: 12))
                                    .padding(8)
                                    .background(SalfordTheme.bgElevated)
                                    .foregroundColor(.white)
                                    .cornerRadius(8)

                                TextField("اللون", text: $item.color)
                                    .font(.system(size: 12))
                                    .frame(width: 85)
                                    .padding(8)
                                    .background(SalfordTheme.bgElevated)
                                    .foregroundColor(.white)
                                    .cornerRadius(8)

                                TextField("الكود", text: $item.code)
                                    .font(.system(size: 12))
                                    .frame(width: 90)
                                    .padding(8)
                                    .background(SalfordTheme.bgElevated)
                                    .foregroundColor(.white)
                                    .cornerRadius(8)
                            }
                        }
                    }

                    Button {
                        store.activeReceiptItems.append(
                            ReceiptLineItem(name: "قطعة مجوهرات إضافية", color: "فضي", code: "SFD-NEW", qty: 1, price: 500)
                        )
                    } label: {
                        Label("إضافة سطر منتج للفاتورة", systemImage: "plus.circle")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(SalfordTheme.silverAccent)
                    }
                }
                .salfordCard()

                // Action Buttons: Native PDF Export, ShareLink & AirPrint
                HStack(spacing: 10) {
                    Button {
                        if let url = buildPDF() {
                            NativePDFGenerator.printPDF(url: url, jobName: "SALFORD Receipt \(store.activeReceiptNo)")
                        }
                    } label: {
                        Label("طباعة AirPrint", systemImage: "printer.fill")
                            .font(.system(size: 13, weight: .bold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(SalfordTheme.royalNavyMid)
                            .foregroundColor(.white)
                            .cornerRadius(11)
                    }

                    if let pdfURL = generatedPDFURL ?? buildPDF() {
                        ShareLink(item: pdfURL, preview: SharePreview("فاتورة SALFORD \(store.activeReceiptNo)")) {
                            Label("تصدير ومشاركة PDF", systemImage: "square.and.arrow.up.fill")
                                .font(.system(size: 13, weight: .heavy))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(SalfordTheme.silverGradient)
                                .foregroundColor(SalfordTheme.bgPrimary)
                                .cornerRadius(11)
                        }
                    }
                }

                // Live Interactive Paper Preview matching Invoice swarovski.pdf & SALFORD Royal
                VStack(spacing: 0) {
                    if store.activeReceiptTemplate == .salfordRoyal {
                        VStack(spacing: 4) {
                            Text("SJ")
                                .font(.system(size: 34, weight: .black, design: .serif))
                                .foregroundColor(.white)
                            Text("SALFORD")
                                .font(.system(size: 16, weight: .bold, design: .serif))
                                .kerning(5)
                                .foregroundColor(.white)
                            Text("jewelry")
                                .font(.system(size: 9, weight: .medium))
                                .kerning(4)
                                .foregroundColor(SalfordTheme.silverAccent)
                            Text("✦ FINE JEWELRY & LUXURY CREATIONS • TRIPOLI, LIBYA ✦")
                                .font(.system(size: 8.5, weight: .semibold))
                                .foregroundColor(SalfordTheme.silverAccent)
                                .padding(.top, 2)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 18)
                        .background(
                            LinearGradient(
                                colors: [Color(red: 0.17, green: 0.10, blue: 0.33), Color(red: 0.04, green: 0.04, blue: 0.09)],
                                startPoint: .topTrailing,
                                endPoint: .bottomLeading
                            )
                        )
                    } else if store.activeReceiptTemplate == .salfordWhite {
                        VStack(spacing: 3) {
                            Text("SJ")
                                .font(.system(size: 32, weight: .black, design: .serif))
                                .foregroundColor(.black)
                            Text("SALFORD JEWELRY — LIBYA")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(.black)
                        }
                        .padding(.top, 20)
                    } else {
                        VStack(spacing: 2) {
                            Text("SWAROVSKI")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(.black)
                            Text("London – Covent Garden")
                                .font(.system(size: 10.5))
                                .foregroundColor(.black)
                            Text("20–21 James Street, Covent Garden")
                                .font(.system(size: 10.5))
                                .foregroundColor(.black)
                            Text("London, WC2E 8NS")
                                .font(.system(size: 10.5))
                                .foregroundColor(.black)
                            Text("Tel: +44 20 7946 0000")
                                .font(.system(size: 10.5))
                                .foregroundColor(.black)
                        }
                        .padding(.top, 20)
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        Text(store.showRealPricesInReceipt ? "OFFICIAL INVOICE / RECEIPT" : "GIFT RECEIPT")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.black)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.vertical, 6)

                        VStack(alignment: .leading, spacing: 4) {
                            Text("Date: \(store.activeReceiptDate)")
                            Text("Time: \(store.activeReceiptTime)")
                            Text("Receipt No: \(store.activeReceiptNo)")
                            Text("Store: \(store.activeReceiptTemplate == .swarovskiLondon ? "Swarovski London" : "SALFORD Jewelry — Libya")")
                        }
                        .font(.system(size: 11))
                        .foregroundColor(.black)

                        Divider().background(Color.black)

                        ForEach(store.activeReceiptItems) { item in
                            VStack(alignment: .leading, spacing: 3) {
                                HStack {
                                    Text(item.fullTitle)
                                        .font(.system(size: 11, weight: .bold))
                                        .foregroundColor(.black)
                                    Spacer()
                                    Text("Qty: \(item.qty)")
                                        .font(.system(size: 11))
                                        .foregroundColor(.black)
                                    Text(store.showRealPricesInReceipt ? String(format: "%.0f LYD", item.price * Double(item.qty)) : "XXX")
                                        .font(.system(size: 11, weight: .bold))
                                        .foregroundColor(.black)
                                        .frame(width: 65, alignment: .trailing)
                                }
                                Text("Item Code: \(item.code)")
                                    .font(.system(size: 10))
                                    .foregroundColor(.gray)
                            }
                            .padding(.vertical, 4)
                            Divider()
                        }

                        HStack {
                            Text("Total")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.black)
                            Spacer()
                            let grandTotal = store.activeReceiptItems.reduce(0.0) { $0 + ($1.price * Double($1.qty)) }
                            Text(store.showRealPricesInReceipt ? String(format: "%.2f LYD", grandTotal) : "XXX")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.black)
                        }
                        .padding(.vertical, 4)

                        Text("Customer: \(store.activeReceiptCustomer)")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(.black)
                            .padding(.top, 4)

                        Text("This is a gift receipt. Original receipt is required for returns or exchanges.\nReturns are subject to store policy.")
                            .font(.system(size: 9.5))
                            .foregroundColor(.gray)
                            .padding(.top, 4)
                    }
                    .padding(20)
                    .environment(\.layoutDirection, .leftToRight)
                }
                .background(Color.white)
                .cornerRadius(14)
                .shadow(color: .black.opacity(0.4), radius: 10, x: 0, y: 4)
            }
            .padding(14)
        }
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("استوديو الفاتورة الملكية")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if isModalSheet {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("إغلاق") {
                        dismiss()
                    }
                    .foregroundColor(SalfordTheme.silverLight)
                }
            }
        }
        .onAppear {
            if store.activeReceiptItems.isEmpty {
                store.openReceiptStudio(saleId: 1, items: [], customer: "Salford Libya")
            }
        }
    }

    private func buildPDF() -> URL? {
        let url = NativePDFGenerator.generateGiftReceiptPDF(
            template: store.activeReceiptTemplate,
            showRealPrices: store.showRealPricesInReceipt,
            receiptNo: store.activeReceiptNo,
            dateStr: store.activeReceiptDate,
            timeStr: store.activeReceiptTime,
            customer: store.activeReceiptCustomer,
            items: store.activeReceiptItems
        )
        return url
    }
}
