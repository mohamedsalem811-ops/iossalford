import SwiftUI

struct ProductsView: View {
    @EnvironmentObject var store: POSDataStore
    @State private var searchText: String = ""
    @State private var selectedCategory: String = "الكل"
    @State private var showAddSheet: Bool = false
    @State private var editingProduct: Product? = nil

    var filteredProducts: [Product] {
        store.products.filter { prod in
            let matchesCat = (selectedCategory == "الكل") || (prod.category == selectedCategory)
            let matchesSearch = searchText.isEmpty ||
                prod.name.localizedCaseInsensitiveContains(searchText) ||
                prod.sku.localizedCaseInsensitiveContains(searchText)
            return matchesCat && matchesSearch
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Category Filter Strip
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(["الكل"] + POSDataStore.categories, id: \.self) { cat in
                        Button {
                            selectedCategory = cat
                        } label: {
                            Text(cat)
                                .font(.system(size: 12, weight: .bold))
                                .padding(.horizontal, 14)
                                .padding(.vertical, 7)
                                .background(selectedCategory == cat ? SalfordTheme.silverLight : SalfordTheme.bgCard)
                                .foregroundColor(selectedCategory == cat ? SalfordTheme.bgPrimary : SalfordTheme.silverLight)
                                .clipShape(Capsule())
                        }
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
            }
            .background(SalfordTheme.bgSecondary)

            ScrollView {
                LazyVStack(spacing: 10) {
                    ForEach(filteredProducts) { prod in
                        HStack(spacing: 12) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(SalfordTheme.royalNavyMid)
                                    .frame(width: 50, height: 50)
                                Image(systemName: "sparkles")
                                    .foregroundColor(SalfordTheme.silverLight)
                            }

                            VStack(alignment: .leading, spacing: 3) {
                                HStack {
                                    Text(prod.name)
                                        .font(.system(size: 13.5, weight: .bold))
                                        .foregroundColor(.white)
                                    if prod.isLowStock {
                                        Text("مخزون منخفض")
                                            .font(.system(size: 9.5, weight: .bold))
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2)
                                            .background(SalfordTheme.warningAmber.opacity(0.25))
                                            .foregroundColor(SalfordTheme.warningAmber)
                                            .cornerRadius(5)
                                    }
                                }
                                Text("\(prod.sku) • \(prod.category) • \(prod.color ?? "-")")
                                    .font(.system(size: 11))
                                    .foregroundColor(SalfordTheme.textMuted)
                                Text(String(format: "تكلفة: %.0f د.ل | بيع: %.0f د.ل | مخزون: %d", prod.costPrice, prod.sellPrice, prod.stock))
                                    .font(.system(size: 11.5, weight: .semibold))
                                    .foregroundColor(SalfordTheme.silverAccent)
                            }
                            Spacer()

                            Menu {
                                Button {
                                    editingProduct = prod
                                } label: {
                                    Label("تعديل الصنف", systemImage: "pencil")
                                }
                                Button {
                                    store.openReceiptStudio(
                                        saleId: prod.id,
                                        items: [ReceiptLineItem(name: prod.name, color: prod.color ?? "", code: prod.sku, qty: 1, price: prod.sellPrice)],
                                        customer: "Salford Libya"
                                    )
                                } label: {
                                    Label("فاتورة هدية", systemImage: "gift")
                                }
                                Button(role: .destructive) {
                                    store.deleteProduct(id: prod.id)
                                } label: {
                                    Label("حذف", systemImage: "trash")
                                }
                            } label: {
                                Image(systemName: "ellipsis.circle.fill")
                                    .font(.system(size: 20))
                                    .foregroundColor(SalfordTheme.silverAccent)
                            }
                        }
                        .salfordCard()
                    }
                }
                .padding(14)
            }
        }
        .background(SalfordTheme.bgPrimary)
        .searchable(text: $searchText, prompt: "ابحث بالاسم أو الكود SKU...")
        .navigationTitle("إدارة المنتجات (\(store.products.count))")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    showAddSheet = true
                } label: {
                    Label("إضافة منتج", systemImage: "plus.circle.fill")
                        .foregroundColor(SalfordTheme.silverLight)
                }
            }
        }
        .sheet(isPresented: $showAddSheet) {
            ProductFormSheet(product: nil)
        }
        .sheet(item: $editingProduct) { prod in
            ProductFormSheet(product: prod)
        }
    }
}

struct ProductFormSheet: View {
    @EnvironmentObject var store: POSDataStore
    @Environment(\.dismiss) private var dismiss
    let product: Product?

    @State private var name: String = ""
    @State private var sku: String = ""
    @State private var category: String = "خواتم"
    @State private var color: String = "فضي"
    @State private var costPrice: String = ""
    @State private var sellPrice: String = ""
    @State private var stock: String = "5"

    var body: some View {
        NavigationStack {
            Form {
                Section("بيانات القطعة الأساسية") {
                    TextField("اسم القطعة", text: $name)
                    TextField("الكود (يُولّد تلقائياً إن تُرك فارغاً)", text: $sku)
                    Picker("الفئة", selection: $category) {
                        ForEach(POSDataStore.categories, id: \.self) { cat in
                            Text(cat).tag(cat)
                        }
                    }
                    TextField("اللون (ذهبي، فضي، روز جولد...)", text: $color)
                }
                Section("التسعير والمخزون") {
                    TextField("سعر التكلفة (د.ل)", text: $costPrice)
                        .keyboardType(.decimalPad)
                    TextField("سعر البيع (د.ل)", text: $sellPrice)
                        .keyboardType(.decimalPad)
                    TextField("الكمية المتوفرة بالمخزن", text: $stock)
                        .keyboardType(.numberPad)
                }
            }
            .navigationTitle(product == nil ? "إضافة قطعة جديدة" : "تعديل القطعة")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("إلغاء") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("حفظ") {
                        let cost = Double(costPrice) ?? 0
                        let sell = Double(sellPrice) ?? 0
                        let stk = Int(stock) ?? 1
                        let rate = store.exchangeRate > 0 ? store.exchangeRate : 7.0
                        let newProd = Product(
                            id: product?.id ?? 0,
                            sku: sku,
                            name: name.isEmpty ? "قطعة سالفورد" : name,
                            category: category,
                            costPrice: cost,
                            sellPrice: sell,
                            stock: stk,
                            lowStockAlert: 3,
                            size: nil,
                            color: color,
                            imageBase64: nil,
                            costRate: rate,
                            costUSD: cost / rate,
                            createdAt: store.nowTimestamp()
                        )
                        store.saveProduct(newProd)
                        dismiss()
                    }
                }
            }
            .onAppear {
                if let p = product {
                    name = p.name
                    sku = p.sku
                    category = p.category
                    color = p.color ?? ""
                    costPrice = String(format: "%.0f", p.costPrice)
                    sellPrice = String(format: "%.0f", p.sellPrice)
                    stock = "\(p.stock)"
                }
            }
        }
    }
}
