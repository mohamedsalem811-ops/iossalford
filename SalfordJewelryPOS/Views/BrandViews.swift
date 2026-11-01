import SwiftUI

/// Small brand label shown on product cards and rows.
struct BrandTag: View {
    let name: String

    var body: some View {
        HStack(spacing: 4) {
            BrandBadgeView(brand: name, size: 16)
            Text(name)
                .font(.system(.caption2, weight: .bold))
                .lineLimit(1)
        }
            .padding(.leading, 2)
            .padding(.trailing, 7)
            .padding(.vertical, 2)
            .background(SalfordTheme.gold.opacity(0.15))
            .foregroundColor(SalfordTheme.goldLight)
            .clipShape(Capsule())
    }
}

/// Filter buttons: الكل • each brand • بدون ماركة.
struct BrandChips: View {
    let brands: [String]
    @Binding var selected: String

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: SalfordSpacing.s) {
                ForEach(["الكل"] + brands + [POSDataStore.noBrandLabel], id: \.self) { b in
                    let isSelected = selected == b
                    Button {
                        selected = b
                    } label: {
                        HStack(spacing: 4) {
                            if b != "الكل" && b != POSDataStore.noBrandLabel {
                                Image(systemName: "seal.fill").font(.system(.caption2))
                            }
                            Text(b)
                        }
                        .font(.system(.subheadline, weight: .semibold))
                        .padding(.horizontal, SalfordSpacing.m)
                        .frame(minHeight: 34)
                        .background(isSelected ? SalfordTheme.gold : SalfordTheme.bgCard)
                        .foregroundColor(isSelected ? .white : SalfordTheme.textPrimary)
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(SalfordTheme.gold.opacity(isSelected ? 0 : 0.35), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(b == "الكل" ? "كل الماركات" : b)
                    .accessibilityAddTraits(isSelected ? .isSelected : [])
                }
            }
        }
        .textCase(nil)
    }
}

/// Type any brand; existing brands are suggested while typing (tap to use the same spelling).
struct BrandField: View {
    @EnvironmentObject var store: POSDataStore
    @Binding var brand: String
    @FocusState private var focused: Bool

    private var suggestions: [String] {
        let q = brand.trimmingCharacters(in: .whitespaces)
        let list = q.isEmpty ? store.brands : store.brands.filter { $0.localizedCaseInsensitiveContains(q) }
        return Array(list.filter { $0.caseInsensitiveCompare(q) != .orderedSame }.prefix(10))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: SalfordSpacing.s) {
            HStack {
                Image(systemName: "seal.fill")
                    .foregroundColor(SalfordTheme.gold)
                TextField("الماركة — اكتب أي ماركة (اختياري)", text: $brand)
                    .autocorrectionDisabled()
                    .focused($focused)
                if !brand.isEmpty {
                    Button {
                        brand = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(SalfordTheme.textMuted)
                    }
                    .buttonStyle(.borderless)
                    .accessibilityLabel("بدون ماركة")
                }
            }
            if focused || brand.isEmpty, !suggestions.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: SalfordSpacing.s) {
                        ForEach(suggestions, id: \.self) { s in
                            Button {
                                brand = s
                                focused = false
                            } label: {
                                Text(s)
                                    .font(.system(.footnote, weight: .semibold))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(SalfordTheme.royalNavyMid)
                                    .foregroundColor(SalfordTheme.textPrimary)
                                    .clipShape(Capsule())
                            }
                            .buttonStyle(.borderless)
                        }
                    }
                }
            }
            if let canonical = store.canonicalBrand(brand), !store.brands.contains(canonical) {
                Text("ماركة جديدة — ستُضاف للقائمة عند الحفظ")
                    .font(.system(.caption2))
                    .foregroundColor(SalfordTheme.textMuted)
            }
        }
    }
}

/// Management → Brands: the shop's own list. Add, rename (updates every piece) and delete.
struct BrandsManagementView: View {
    @EnvironmentObject var store: POSDataStore
    @State private var newBrand: String = ""
    @State private var renaming: String? = nil
    @State private var renameText: String = ""
    @State private var brandToDelete: String? = nil
    @State private var message: String? = nil

    var body: some View {
        List {
            Section {
                HStack {
                    TextField("اسم ماركة جديدة", text: $newBrand)
                        .autocorrectionDisabled()
                        .onSubmit(add)
                    Button("إضافة", action: add)
                        .font(.system(.body, weight: .bold))
                        .disabled(newBrand.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            } footer: {
                Text("يمكنك أيضاً كتابة أي ماركة مباشرة عند إضافة قطعة، وستُضاف هنا تلقائياً. اضغط على صورة الماركة لتغييرها.")
            }
            .listRowBackground(SalfordTheme.bgCard)

            Section("الماركات (\(store.brands.count))") {
                if store.brands.isEmpty {
                    SalfordEmptyState(icon: "seal", title: "لا توجد ماركات بعد")
                }
                ForEach(store.brands, id: \.self) { b in
                    HStack(spacing: SalfordSpacing.m) {
                        BrandPhotoMenu(brand: b)
                        Text(b)
                            .font(.system(.body, weight: .semibold))
                            .foregroundColor(SalfordTheme.textPrimary)
                        Spacer()
                        Text("\(store.productCount(forBrand: b)) قطعة")
                            .font(.system(.footnote))
                            .foregroundColor(SalfordTheme.textMuted)
                    }
                    .frame(minHeight: SalfordSpacing.touch)
                    .swipeActions(edge: .trailing) {
                        Button(role: .destructive) {
                            brandToDelete = b
                        } label: {
                            Label("حذف", systemImage: "trash")
                        }
                        Button {
                            renameText = b
                            renaming = b
                        } label: {
                            Label("تعديل", systemImage: "pencil")
                        }
                        .tint(SalfordTheme.gold)
                    }
                    .contextMenu {
                        Button {
                            renameText = b
                            renaming = b
                        } label: { Label("تعديل الاسم", systemImage: "pencil") }
                        Button(role: .destructive) { brandToDelete = b } label: { Label("حذف", systemImage: "trash") }
                    }
                }
            }
            .listRowBackground(SalfordTheme.bgCard)
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(SalfordTheme.bgPrimary)
        .navigationTitle("الماركات")
        .navigationBarTitleDisplayMode(.inline)
        .alert("تعديل اسم الماركة", isPresented: Binding(get: { renaming != nil }, set: { if !$0 { renaming = nil } })) {
            TextField("الاسم", text: $renameText)
            Button("حفظ") {
                if let old = renaming { message = store.renameBrand(old, to: renameText) }
                renaming = nil
            }
            Button("إلغاء", role: .cancel) { renaming = nil }
        } message: {
            Text("يتغير الاسم في كل القطع التي تحمل هذه الماركة.")
        }
        .confirmDelete(
            $brandToDelete,
            title: { "حذف الماركة «\($0)»؟" },
            message: { b in
                let n = store.productCount(forBrand: b)
                return n > 0
                    ? "\(n) قطعة تحمل هذه الماركة وستصبح «بدون ماركة». المبيعات السابقة تحتفظ باسم الماركة."
                    : "لا توجد قطع بهذه الماركة."
            },
            perform: { store.deleteBrand($0) }
        )
        .alert("تنبيه", isPresented: Binding(get: { message != nil }, set: { if !$0 { message = nil } })) {
            Button("حسناً", role: .cancel) {}
        } message: {
            Text(message ?? "")
        }
    }

    private func add() {
        guard store.addBrand(newBrand) != nil else { return }
        newBrand = ""
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
}

/// Brand filter pinned at the top of the selling and products screens: one tap shows only that
/// brand's pieces, tapping it again goes back to all. Each brand shows how many items it has.
struct BrandFilterBar: View {
    @EnvironmentObject var store: POSDataStore
    @Binding var selected: String

    private var counts: [(name: String, count: Int)] {
        store.brands
            .map { b in (b, store.products.filter { $0.brand == b }.count) }
            .filter { $0.1 > 0 }
    }

    private var noBrandCount: Int { store.products.filter { $0.brand == nil }.count }

    var body: some View {
        VStack(spacing: 0) {
            if counts.isEmpty {
                Label("لتظهر الماركات هنا للفلترة: افتح القطعة واكتب ماركتها", systemImage: "seal")
                    .font(.system(.caption, weight: .semibold))
                    .foregroundColor(SalfordTheme.textMuted)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, SalfordSpacing.l)
                    .padding(.vertical, SalfordSpacing.s)
            } else {
                ScrollViewReader { proxy in
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: SalfordSpacing.s) {
                            chip("الكل", count: store.products.count, icon: "square.grid.2x2")
                            ForEach(counts, id: \.name) { item in
                                chip(item.name, count: item.count, icon: nil, badge: true)
                            }
                            if noBrandCount > 0 {
                                chip(POSDataStore.noBrandLabel, count: noBrandCount, icon: nil)
                            }
                        }
                        .padding(.horizontal, SalfordSpacing.l)
                        .padding(.vertical, SalfordSpacing.s)
                    }
                    .onAppear { proxy.scrollTo(selected, anchor: .center) }
                }
            }
            Divider()
        }
        .background(.bar)
        // If the chosen brand no longer has pieces, go back to all.
        .onChange(of: counts.map(\.name)) { names in
            if selected != "الكل" && selected != POSDataStore.noBrandLabel && !names.contains(selected) {
                selected = "الكل"
            }
        }
    }

    private func chip(_ name: String, count: Int, icon: String?, badge: Bool = false) -> some View {
        let isSelected = selected == name
        return Button {
            UISelectionFeedbackGenerator().selectionChanged()
            // Tapping the selected brand again returns to all brands.
            selected = (isSelected && name != "الكل") ? "الكل" : name
        } label: {
            HStack(spacing: 6) {
                if badge {
                    BrandBadgeView(brand: name, size: 26)
                } else if let icon {
                    Image(systemName: icon).font(.system(.caption))
                }
                Text(name)
                    .font(.system(.subheadline, weight: .bold))
                    .lineLimit(1)
                Text("\(count)")
                    .font(.system(.caption2, weight: .heavy))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 1)
                    .background((isSelected ? Color.white : store.line.accent).opacity(isSelected ? 0.25 : 0.15))
                    .clipShape(Capsule())
            }
            .padding(.leading, badge ? 4 : SalfordSpacing.m)
            .padding(.trailing, SalfordSpacing.m)
            .frame(minHeight: 38)
            .background(isSelected ? store.line.accent : SalfordTheme.bgCard)
            .foregroundColor(isSelected ? .white : SalfordTheme.textPrimary)
            .clipShape(Capsule())
            .overlay(Capsule().stroke(store.line.accent.opacity(isSelected ? 0 : 0.4), lineWidth: 1))
        }
        .buttonStyle(.plain)
        .id(name)
        .accessibilityLabel(name == "الكل" ? "كل الماركات، \(count) قطعة" : "\(name)، \(count) قطعة")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

/// Round brand picture: the shop's own photo if set, otherwise a built-in badge
/// (original lettering in the brand's colours, not the official logo files), otherwise initials.
struct BrandBadgeView: View {
    @EnvironmentObject var store: POSDataStore
    let brand: String
    var size: CGFloat = 32

    private struct Style {
        let background: Color
        let foreground: Color
        let text: String
        let serif: Bool
    }

    /// Built-in looks for the main brands, recognised by name.
    private var builtIn: Style? {
        let n = brand.lowercased()
        if n.contains("swarovski") {
            return Style(background: .black, foreground: .white, text: "SWAROVSKI", serif: false)
        }
        if n.contains("tiffany") {
            return Style(background: Color(red: 129/255, green: 216/255, blue: 208/255), foreground: .black, text: "T&Co.", serif: true)
        }
        if n.contains("pandora") {
            return Style(background: .white, foreground: .black, text: "PANDORA", serif: true)
        }
        return nil
    }

    /// A stable colour per brand name for the initials badge.
    private var initialsColor: Color {
        let palette: [Color] = [.indigo, .teal, .orange, .pink, .purple, .brown, .mint, .cyan, .red, .blue]
        let sum = brand.unicodeScalars.reduce(0) { $0 + Int($1.value) }
        return palette[sum % palette.count]
    }

    private var initials: String {
        let words = brand.split(separator: " ").filter { !$0.isEmpty }
        let letters = words.prefix(2).compactMap { $0.first }.map { String($0) }
        return letters.joined().uppercased()
    }

    var body: some View {
        ZStack {
            if let file = store.brandImages[brand], let img = ProductImageHelper.image(named: file) {
                Image(uiImage: img).resizable().scaledToFill()
            } else if let style = builtIn {
                style.background
                Text(style.text)
                    .font(.system(size: size * (style.text.count > 6 ? 0.17 : 0.3), weight: .bold, design: style.serif ? .serif : .default))
                    .kerning(style.text.count > 6 ? 0.3 : 0)
                    .foregroundColor(style.foreground)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                    .padding(.horizontal, size * 0.08)
            } else {
                Circle().fill(initialsColor.gradient)
                Text(initials)
                    .font(.system(size: size * 0.38, weight: .bold))
                    .foregroundColor(.white)
                    .minimumScaleFactor(0.5)
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay(Circle().stroke(Color.black.opacity(0.12), lineWidth: 1))
        .accessibilityHidden(true)
    }
}

/// Lets the shop set its own photo for a brand (e.g. a picture of the logo from the box).
struct BrandPhotoMenu: View {
    @EnvironmentObject var store: POSDataStore
    let brand: String
    @State private var showCamera = false
    @State private var showLibrary = false

    var body: some View {
        Menu {
            Button { showLibrary = true } label: { Label("اختيار صورة من الألبوم", systemImage: "photo.on.rectangle") }
            Button { showCamera = true } label: { Label("تصوير بالكاميرا", systemImage: "camera") }
            if store.brandImages[brand] != nil {
                Button(role: .destructive) { store.removeBrandImage(for: brand) } label: {
                    Label("إزالة الصورة (الرجوع للشارة)", systemImage: "trash")
                }
            }
        } label: {
            ZStack(alignment: .bottomTrailing) {
                BrandBadgeView(brand: brand, size: 44)
                Image(systemName: "camera.circle.fill")
                    .font(.system(.footnote))
                    .foregroundColor(store.line.accent)
                    .background(Circle().fill(SalfordTheme.bgCard))
                    .offset(x: 3, y: 3)
            }
        }
        .accessibilityLabel("صورة ماركة \(brand)")
        .sheet(isPresented: $showLibrary) {
            NativeImagePickerSheet(sourceType: .photoLibrary) { img in store.setBrandImage(img, for: brand) }
                .ignoresSafeArea()
        }
        .sheet(isPresented: $showCamera) {
            NativeImagePickerSheet(sourceType: .camera) { img in store.setBrandImage(img, for: brand) }
                .ignoresSafeArea()
        }
    }
}
