import SwiftUI
import UIKit

struct ProductsView: View {
    @EnvironmentObject var store: POSDataStore
    @State private var searchText: String = ""
    @State private var selectedCategory: String = "الكل"
    @State private var showAddSheet: Bool = false
    @State private var editingProduct: Product? = nil
    @State private var previewingProduct: Product? = nil

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
                LazyVStack(spacing: 12) {
                    // Quick Add Product Banner Button at top of list
                    Button {
                        showAddSheet = true
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "camera.viewfinder")
                                .font(.system(size: 18, weight: .bold))
                            Text("إضافة قطعة جديدة مع تصوير أو رفع صورة")
                                .font(.system(size: 13.5, weight: .heavy))
                            Spacer()
                            Image(systemName: "plus.circle.fill")
                                .font(.system(size: 18))
                        }
                        .padding(13)
                        .background(SalfordTheme.silverGradient)
                        .foregroundColor(SalfordTheme.bgPrimary)
                        .cornerRadius(14)
                    }

                    ForEach(filteredProducts) { prod in
                        HStack(spacing: 12) {
                            // Tappable 74x74 Clear Product Photo Thumbnail
                            Button {
                                if prod.imageBase64 != nil {
                                    previewingProduct = prod
                                } else {
                                    editingProduct = prod
                                }
                            } label: {
                                SalfordProductThumbnailView(
                                    imageBase64: prod.imageBase64,
                                    size: 74,
                                    cornerRadius: 14,
                                    showZoomBadge: prod.imageBase64 != nil
                                )
                            }
                            .buttonStyle(.plain)

                            VStack(alignment: .leading, spacing: 5) {
                                HStack(spacing: 6) {
                                    Text(prod.name)
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundColor(.white)
                                        .lineLimit(1)
                                    if prod.isOutOfStock {
                                        Text("نفد المخزون")
                                            .font(.system(size: 9.5, weight: .bold))
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2)
                                            .background(SalfordTheme.dangerRed.opacity(0.25))
                                            .foregroundColor(SalfordTheme.dangerRed)
                                            .cornerRadius(5)
                                    } else if prod.isLowStock {
                                        Text("مخزون منخفض")
                                            .font(.system(size: 9.5, weight: .bold))
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2)
                                            .background(SalfordTheme.warningAmber.opacity(0.25))
                                            .foregroundColor(SalfordTheme.warningAmber)
                                            .cornerRadius(5)
                                    }
                                }

                                Text("الكود: \(prod.sku) • \(prod.category) • \(prod.color ?? "بدون لون")" + (prod.size.map { " • المقاس: \($0)" } ?? ""))
                                    .font(.system(size: 11.5))
                                    .foregroundColor(SalfordTheme.textMuted)

                                HStack(spacing: 10) {
                                    Text(String(format: "التكلفة: %.0f د.ل", prod.costPrice))
                                        .font(.system(size: 11.5, weight: .semibold))
                                        .foregroundColor(SalfordTheme.silverAccent)

                                    Text(String(format: "البيع: %.0f د.ل", prod.sellPrice))
                                        .font(.system(size: 12, weight: .bold))
                                        .foregroundColor(SalfordTheme.emeraldSuccess)

                                    Text("المخزون: \(prod.stock)")
                                        .font(.system(size: 11.5, weight: .bold))
                                        .foregroundColor(prod.stock > 0 ? SalfordTheme.goldLight : SalfordTheme.dangerRed)
                                }
                            }
                            Spacer()

                            VStack(spacing: 8) {
                                Button {
                                    editingProduct = prod
                                } label: {
                                    Image(systemName: "pencil.circle.fill")
                                        .font(.system(size: 22))
                                        .foregroundColor(SalfordTheme.silverLight)
                                }

                                Menu {
                                    Button {
                                        editingProduct = prod
                                    } label: {
                                        Label("تعديل بيانات وصورة القطعة", systemImage: "camera.fill")
                                    }
                                    if prod.imageBase64 != nil {
                                        Button {
                                            previewingProduct = prod
                                        } label: {
                                            Label("تكبير صورة القطعة", systemImage: "arrow.up.left.and.arrow.down.right")
                                        }
                                    }
                                    Button {
                                        store.openReceiptStudio(
                                            saleId: prod.id,
                                            items: [ReceiptLineItem(name: prod.name, color: prod.color ?? "", code: prod.sku, qty: 1, price: prod.sellPrice)],
                                            customer: "Salford Libya"
                                        )
                                    } label: {
                                        Label("إصدار فاتورة هدية", systemImage: "gift.fill")
                                    }
                                    Button(role: .destructive) {
                                        store.deleteProduct(id: prod.id)
                                    } label: {
                                        Label("حذف القطعة", systemImage: "trash.fill")
                                    }
                                } label: {
                                    Image(systemName: "ellipsis.circle.fill")
                                        .font(.system(size: 22))
                                        .foregroundColor(SalfordTheme.silverAccent)
                                }
                            }
                        }
                        .salfordCard()
                    }
                }
                .padding(14)
            }
        }
        .background(SalfordTheme.bgPrimary)
        .searchable(text: $searchText, prompt: "ابحث باسم القطعة أو الكود...")
        .navigationTitle("إدارة المنتجات")
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
                .environment(\.layoutDirection, .rightToLeft)
                .environment(\.locale, Locale(identifier: "ar_LY"))
        }
        .sheet(item: $editingProduct) { prod in
            ProductFormSheet(product: prod)
                .environment(\.layoutDirection, .rightToLeft)
                .environment(\.locale, Locale(identifier: "ar_LY"))
        }
        .sheet(item: $previewingProduct) { prod in
            ProductPhotoLightboxSheet(product: prod) {
                previewingProduct = nil
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                    editingProduct = prod
                }
            }
            .environment(\.layoutDirection, .rightToLeft)
            .environment(\.locale, Locale(identifier: "ar_LY"))
        }
    }
}

/// Full-Screen Clear Photo Lightbox when tapping a product image in إدارة المنتجات
struct ProductPhotoLightboxSheet: View {
    let product: Product
    var onEditRequested: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var zoomScale: CGFloat = 1.0

    var body: some View {
        NavigationStack {
            ZStack {
                SalfordTheme.bgPrimary.ignoresSafeArea()

                VStack(spacing: 16) {
                    if let uiImg = ProductImageHelper.image(from: product.imageBase64) {
                        Image(uiImage: uiImg)
                            .resizable()
                            .scaledToFit()
                            .frame(maxWidth: .infinity, maxHeight: 380)
                            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 20, style: .continuous)
                                    .stroke(SalfordTheme.goldLight.opacity(0.6), lineWidth: 1.5)
                            )
                            .scaleEffect(zoomScale)
                            .gesture(
                                MagnificationGesture()
                                    .onChanged { val in
                                        zoomScale = max(1.0, min(val, 3.0))
                                    }
                                    .onEnded { _ in
                                        withAnimation(.spring()) {
                                            zoomScale = 1.0
                                        }
                                    }
                            )
                            .padding(.horizontal, 16)
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(product.name)
                                .font(.system(size: 18, weight: .heavy))
                                .foregroundColor(.white)
                            Spacer()
                            Text(product.category)
                                .font(.system(size: 12, weight: .bold))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 4)
                                .background(SalfordTheme.royalNavyMid)
                                .foregroundColor(SalfordTheme.goldLight)
                                .clipShape(Capsule())
                        }

                        Text("الكود: \(product.sku) • اللون: \(product.color ?? "غير محدد")")
                            .font(.system(size: 13))
                            .foregroundColor(SalfordTheme.textMuted)

                        Divider().background(SalfordTheme.borderSubtle)

                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("سعر التكلفة")
                                    .font(.system(size: 11.5))
                                    .foregroundColor(SalfordTheme.textMuted)
                                Text(String(format: "%.0f د.ل", product.costPrice))
                                    .font(.system(size: 15, weight: .bold))
                                    .foregroundColor(SalfordTheme.silverLight)
                            }
                            Spacer()
                            VStack(alignment: .leading, spacing: 4) {
                                Text("سعر البيع")
                                    .font(.system(size: 11.5))
                                    .foregroundColor(SalfordTheme.textMuted)
                                Text(String(format: "%.0f د.ل", product.sellPrice))
                                    .font(.system(size: 15, weight: .heavy))
                                    .foregroundColor(SalfordTheme.emeraldSuccess)
                            }
                            Spacer()
                            VStack(alignment: .leading, spacing: 4) {
                                Text("المخزون المتوفر")
                                    .font(.system(size: 11.5))
                                    .foregroundColor(SalfordTheme.textMuted)
                                Text("\(product.stock) قطع")
                                    .font(.system(size: 15, weight: .bold))
                                    .foregroundColor(SalfordTheme.goldLight)
                            }
                        }
                    }
                    .salfordCard()
                    .padding(.horizontal, 16)

                    Button {
                        onEditRequested()
                    } label: {
                        Label("تغيير الصورة أو تعديل بيانات القطعة", systemImage: "camera.rotate.fill")
                            .font(.system(size: 14, weight: .bold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                            .background(SalfordTheme.silverGradient)
                            .foregroundColor(SalfordTheme.bgPrimary)
                            .cornerRadius(12)
                    }
                    .padding(.horizontal, 16)

                    Spacer()
                }
                .padding(.top, 14)
            }
            .navigationTitle("صورة وتفاصيل القطعة")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("إغلاق") {
                        dismiss()
                    }
                    .foregroundColor(SalfordTheme.silverLight)
                }
            }
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
    @State private var size: String = ""
    @State private var lowStockAlert: String = "3"
    @State private var imageBase64: String? = nil

    @State private var showCameraPicker: Bool = false
    @State private var showLibraryPicker: Bool = false
    @State private var formError: String? = nil

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    // 1. Prominent Product Photo Upload & Camera Capture Card
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Image(systemName: "camera.fill")
                                .foregroundColor(SalfordTheme.goldLight)
                            Text("صورة القطعة (التقاط بالكاميرا أو رفع من الألبوم)")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(SalfordTheme.silverLight)
                            Spacer()
                            if imageBase64 != nil {
                                Button(role: .destructive) {
                                    imageBase64 = nil
                                } label: {
                                    Label("حذف الصورة", systemImage: "trash")
                                        .font(.system(size: 11.5, weight: .bold))
                                        .foregroundColor(SalfordTheme.dangerRed)
                                }
                            }
                        }

                        // Large Clear Preview Box
                        ZStack {
                            if let uiImg = ProductImageHelper.image(from: imageBase64) {
                                Image(uiImage: uiImg)
                                    .resizable()
                                    .scaledToFill()
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 195)
                                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                                            .stroke(SalfordTheme.goldLight, lineWidth: 1.5)
                                    )
                            } else {
                                RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .fill(SalfordTheme.bgElevated)
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 155)
                                    .overlay(
                                        VStack(spacing: 8) {
                                            Image(systemName: "camera.viewfinder")
                                                .font(.system(size: 38))
                                                .foregroundColor(SalfordTheme.goldLight)
                                            Text("لم يتم إرفاق صورة للقطعة بعد")
                                                .font(.system(size: 13, weight: .bold))
                                                .foregroundColor(.white)
                                            Text("اضغط على أحد الزرين بالأسفل لتصوير القطعة أو اختيار صورتها")
                                                .font(.system(size: 11))
                                                .foregroundColor(SalfordTheme.textMuted)
                                        }
                                    )
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                                            .stroke(SalfordTheme.borderSubtle, lineWidth: 1)
                                    )
                            }
                        }

                        // Camera & Photo Library Buttons
                        HStack(spacing: 10) {
                            Button {
                                showCameraPicker = true
                            } label: {
                                Label("التقاط بالكاميرا", systemImage: "camera.fill")
                                    .font(.system(size: 13, weight: .heavy))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 12)
                                    .background(SalfordTheme.silverGradient)
                                    .foregroundColor(SalfordTheme.bgPrimary)
                                    .cornerRadius(11)
                            }

                            Button {
                                showLibraryPicker = true
                            } label: {
                                Label("رفع من الألبوم", systemImage: "photo.on.rectangle.angled")
                                    .font(.system(size: 13, weight: .bold))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 12)
                                    .background(SalfordTheme.royalNavyMid)
                                    .foregroundColor(SalfordTheme.silverLight)
                                    .cornerRadius(11)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 11)
                                            .stroke(SalfordTheme.silverAccent.opacity(0.45), lineWidth: 1)
                                    )
                            }
                        }
                    }
                    .salfordCard()

                    // 2. Basic Piece Info Card
                    VStack(alignment: .leading, spacing: 10) {
                        Text("بيانات القطعة الأساسية")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(SalfordTheme.silverLight)

                        VStack(alignment: .leading, spacing: 4) {
                            Text("اسم القطعة")
                                .font(.system(size: 11.5))
                                .foregroundColor(SalfordTheme.textMuted)
                            TextField("مثال: خاتم سوليتير ألماس ملكي", text: $name)
                                .padding(10)
                                .background(SalfordTheme.bgElevated)
                                .foregroundColor(.white)
                                .cornerRadius(10)
                        }

                        HStack(spacing: 10) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("الفئة")
                                    .font(.system(size: 11.5))
                                    .foregroundColor(SalfordTheme.textMuted)
                                Picker("الفئة", selection: $category) {
                                    ForEach(POSDataStore.categories, id: \.self) { cat in
                                        Text(cat).tag(cat)
                                    }
                                }
                                .pickerStyle(.menu)
                                .padding(6)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(SalfordTheme.bgElevated)
                                .cornerRadius(10)
                            }

                            VStack(alignment: .leading, spacing: 4) {
                                Text("اللون")
                                    .font(.system(size: 11.5))
                                    .foregroundColor(SalfordTheme.textMuted)
                                TextField("ذهبي، فضي، روز جولد", text: $color)
                                    .padding(10)
                                    .background(SalfordTheme.bgElevated)
                                    .foregroundColor(.white)
                                    .cornerRadius(10)
                            }
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            Text("كود القطعة (يُولّد تلقائياً إذا تُرك فارغاً)")
                                .font(.system(size: 11.5))
                                .foregroundColor(SalfordTheme.textMuted)
                            TextField("RNG-SFD01", text: $sku)
                                .padding(10)
                                .background(SalfordTheme.bgElevated)
                                .foregroundColor(.white)
                                .cornerRadius(10)
                        }
                    }
                    .salfordCard()

                    // 3. Pricing & Stock Card
                    VStack(alignment: .leading, spacing: 10) {
                        Text("التسعير والمخزون")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(SalfordTheme.silverLight)

                        HStack(spacing: 10) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("سعر التكلفة بالدينار")
                                    .font(.system(size: 11.5))
                                    .foregroundColor(SalfordTheme.textMuted)
                                TextField("0", text: $costPrice)
                                    .numericInput($costPrice, .decimal)
                                    .padding(10)
                                    .background(SalfordTheme.bgElevated)
                                    .foregroundColor(.white)
                                    .cornerRadius(10)
                            }

                            VStack(alignment: .leading, spacing: 4) {
                                Text("سعر البيع بالدينار")
                                    .font(.system(size: 11.5))
                                    .foregroundColor(SalfordTheme.emeraldSuccess)
                                TextField("0", text: $sellPrice)
                                    .numericInput($sellPrice, .decimal)
                                    .padding(10)
                                    .background(SalfordTheme.bgElevated)
                                    .foregroundColor(.white)
                                    .cornerRadius(10)
                            }
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            Text("الكمية المتوفرة في المخزن")
                                .font(.system(size: 11.5))
                                .foregroundColor(SalfordTheme.textMuted)
                            TextField("5", text: $stock)
                                .numericInput($stock, .integer)
                                .padding(10)
                                .background(SalfordTheme.bgElevated)
                                .foregroundColor(.white)
                                .cornerRadius(10)
                        }

                        HStack(spacing: 10) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("المقاس (اختياري)")
                                    .font(.system(size: 11.5))
                                    .foregroundColor(SalfordTheme.textMuted)
                                TextField("مثال: 7 أو M", text: $size)
                                    .padding(10)
                                    .background(SalfordTheme.bgElevated)
                                    .foregroundColor(.white)
                                    .cornerRadius(10)
                            }

                            VStack(alignment: .leading, spacing: 4) {
                                Text("تنبيه عند وصول المخزون إلى")
                                    .font(.system(size: 11.5))
                                    .foregroundColor(SalfordTheme.textMuted)
                                TextField("3", text: $lowStockAlert)
                                    .numericInput($lowStockAlert, .integer)
                                    .padding(10)
                                    .background(SalfordTheme.bgElevated)
                                    .foregroundColor(.white)
                                    .cornerRadius(10)
                            }
                        }

                        Button {
                            savePiece()
                        } label: {
                            Label(product == nil ? "حفظ وإضافة القطعة للمخزون" : "حفظ التعديلات على القطعة", systemImage: "checkmark.circle.fill")
                                .font(.system(size: 14, weight: .heavy))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 13)
                                .background(SalfordTheme.emeraldSuccess)
                                .foregroundColor(.black)
                                .cornerRadius(12)
                        }
                        .padding(.top, 4)
                    }
                    .salfordCard()
                }
                .padding(14)
            }
            .background(SalfordTheme.bgPrimary)
            .navigationTitle(product == nil ? "إضافة قطعة جديدة" : "تعديل بيانات وصورة القطعة")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("إلغاء") { dismiss() }
                        .foregroundColor(SalfordTheme.silverLight)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("حفظ") {
                        savePiece()
                    }
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(SalfordTheme.emeraldSuccess)
                }
            }
            .onAppear {
                if let p = product {
                    name = p.name
                    sku = p.sku
                    category = p.category
                    color = p.color ?? ""
                    costPrice = NumberInput.editable(p.costPrice)
                    sellPrice = NumberInput.editable(p.sellPrice)
                    stock = "\(p.stock)"
                    size = p.size ?? ""
                    lowStockAlert = "\(p.lowStockAlert)"
                    imageBase64 = p.imageBase64
                }
            }
            .alert("لم يتم الحفظ", isPresented: Binding(get: { formError != nil }, set: { if !$0 { formError = nil } })) {
                Button("حسناً", role: .cancel) {}
            } message: {
                Text(formError ?? "")
            }
            .sheet(isPresented: $showCameraPicker) {
                NativeImagePickerSheet(sourceType: .camera) { pickedImage in
                    if let encoded = ProductImageHelper.encodeToBase64(pickedImage) {
                        imageBase64 = encoded
                    }
                }
                .ignoresSafeArea()
            }
            .sheet(isPresented: $showLibraryPicker) {
                NativeImagePickerSheet(sourceType: .photoLibrary) { pickedImage in
                    if let encoded = ProductImageHelper.encodeToBase64(pickedImage) {
                        imageBase64 = encoded
                    }
                }
                .ignoresSafeArea()
            }
        }
    }

    private func savePiece() {
        // Never save a price that was left empty or mistyped as 0.
        guard let sell = NumberInput.decimal(sellPrice), sell > 0 else {
            formError = "يرجى إدخال سعر البيع (أرقام 0-9 فقط)"
            return
        }
        guard let cost = NumberInput.decimal(costPrice) else {
            formError = "يرجى إدخال سعر التكلفة (أرقام 0-9 فقط). أدخل 0 إذا كانت التكلفة غير معروفة."
            return
        }
        guard let stk = NumberInput.integer(stock) else {
            formError = "يرجى إدخال الكمية المتوفرة في المخزن"
            return
        }
        let alertLevel = NumberInput.integer(lowStockAlert) ?? 3

        // The USD cost records the exchange rate on the day the piece was bought.
        // Keep it on edit unless the cost price itself was changed.
        let costRate: Double?
        let costUSD: Double?
        if let p = product, abs(p.costPrice - cost) < 0.0005 {
            costRate = p.costRate
            costUSD = p.costUSD
        } else {
            let rate = store.exchangeRate > 0 ? store.exchangeRate : 7.0
            costRate = rate
            costUSD = cost / rate
        }

        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedColor = color.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedSize = size.trimmingCharacters(in: .whitespacesAndNewlines)

        let newProd = Product(
            id: product?.id ?? 0,
            sku: sku.trimmingCharacters(in: .whitespacesAndNewlines),
            name: trimmedName.isEmpty ? "قطعة سالفورد" : trimmedName,
            category: category,
            costPrice: cost,
            sellPrice: sell,
            stock: stk,
            lowStockAlert: alertLevel,
            size: trimmedSize.isEmpty ? nil : trimmedSize,
            color: trimmedColor.isEmpty ? nil : trimmedColor,
            imageBase64: imageBase64,
            costRate: costRate,
            costUSD: costUSD,
            createdAt: product?.createdAt ?? store.nowTimestamp()
        )
        store.saveProduct(newProd)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        dismiss()
    }
}
