import SwiftUI
import UIKit

enum SalfordTheme {
    /// A color that follows the iPhone's Light / Dark setting.
    static func adaptive(light: UIColor, dark: UIColor) -> Color {
        Color(UIColor { $0.userInterfaceStyle == .dark ? dark : light })
    }

    private static func rgb(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat, _ a: CGFloat = 1) -> UIColor {
        UIColor(red: r / 255, green: g / 255, blue: b / 255, alpha: a)
    }

    // Core Brand Palette (SALFORD Monogram Scheme). Fixed brand colors, same in both modes.
    static let midnight       = Color(red: 7/255.0, green: 7/255.0, blue: 15/255.0)
    static let navy           = adaptive(light: rgb(226, 232, 244), dark: rgb(11, 21, 48))
    static let royalNavy      = adaptive(light: rgb(205, 215, 235), dark: rgb(18, 36, 82))
    static let violet         = Color(red: 43/255.0, green: 25/255.0, blue: 84/255.0)
    static let crystal        = adaptive(light: rgb(52, 74, 122), dark: rgb(200, 216, 240))
    static let ice            = adaptive(light: rgb(18, 36, 82), dark: rgb(232, 240, 255))
    static let gold           = adaptive(light: rgb(138, 104, 46), dark: rgb(184, 150, 90))
    static let goldLight      = adaptive(light: rgb(150, 112, 50), dark: rgb(212, 175, 122))
    static let goldDark       = Color(red: 138/255.0, green: 110/255.0, blue: 62/255.0)
    static let blueGlow       = Color(red: 106/255.0, green: 163/255.0, blue: 255/255.0)
    static let emerald        = Color(red: 29/255.0, green: 184/255.0, blue: 122/255.0)
    static let crimson        = Color(red: 224/255.0, green: 59/255.0, blue: 90/255.0)
    static let muted          = adaptive(light: rgb(88, 100, 126), dark: rgb(140, 158, 192))
    static let cardBg         = adaptive(light: rgb(255, 255, 255), dark: rgb(13, 25, 56, 0.92))
    static let border         = adaptive(light: rgb(18, 36, 82, 0.14), dark: rgb(200, 216, 240, 0.16))

    // Semantic UI Tokens used across all Views (all adapt to Light / Dark)
    static let bgPrimary      = adaptive(light: rgb(246, 245, 241), dark: rgb(7, 7, 15))
    static let bgSecondary    = adaptive(light: rgb(236, 236, 232), dark: rgb(11, 21, 48))
    static let bgCard         = cardBg
    static let bgElevated     = adaptive(light: rgb(240, 241, 245), dark: rgb(20, 39, 88))
    static let royalNavyTop   = royalNavy
    static let royalNavyMid   = adaptive(light: rgb(227, 233, 245), dark: rgb(25, 48, 106))
    static let silverLight    = ice
    static let silverAccent   = crystal
    static let textMuted      = muted
    static let borderSubtle   = border
    static let emeraldSuccess = adaptive(light: rgb(4, 135, 86), dark: rgb(52, 211, 153))
    static let dangerRed      = adaptive(light: rgb(200, 30, 30), dark: rgb(239, 68, 68))
    static let warningAmber   = adaptive(light: rgb(176, 98, 0), dark: rgb(245, 158, 11))
    static let infoBlue       = adaptive(light: rgb(30, 100, 200), dark: rgb(96, 165, 250))

    /// Main text color: near-white in Dark, deep navy in Light.
    static let textPrimary    = adaptive(light: rgb(14, 22, 44), dark: rgb(255, 255, 255))
    /// Text/icons drawn on top of the primary (silver / navy) buttons.
    static let onPrimary      = adaptive(light: rgb(255, 255, 255), dark: rgb(7, 7, 15))
    /// Text on the colored success / warning buttons.
    static let onColored      = adaptive(light: rgb(255, 255, 255), dark: rgb(0, 0, 0))
    /// Background of text fields.
    static let fieldBg        = adaptive(light: rgb(240, 241, 245), dark: rgb(20, 39, 88))

    static let bgGradient = LinearGradient(
        colors: [royalNavyTop, bgSecondary, bgPrimary],
        startPoint: .top,
        endPoint: .bottom
    )

    /// Primary button fill: silver in Dark, royal navy in Light (text uses `onPrimary`).
    static let silverGradient = LinearGradient(
        colors: [
            adaptive(light: rgb(24, 46, 100), dark: rgb(232, 240, 255)),
            adaptive(light: rgb(14, 28, 66), dark: rgb(200, 216, 240))
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static func formatLYD(_ val: Double) -> String {
        Money.lyd(val)
    }

    static func formatUSD(_ val: Double) -> String {
        String(format: "$%.2f", val)
    }
}

/// Official Vector SALFORD Jewelry Monogram Logo (SJ + 4-Point Diamond Stars + SALFORD jewelry)
struct SalfordMonogramLogoView: View {
    var size: CGFloat = 84
    var showWordmark: Bool = true
    var darkText: Bool = false

    private var scale: CGFloat {
        size / 84.0
    }

    var body: some View {
        let primary = darkText ? Color(red: 9/255.0, green: 10/255.0, blue: 20/255.0) : SalfordTheme.textPrimary
        let secondary = darkText ? Color(red: 30/255.0, green: 40/255.0, blue: 65/255.0) : SalfordTheme.ice
        let subColor = darkText ? Color.gray : SalfordTheme.crystal

        VStack(spacing: 2 * scale) {
            ZStack {
                DiamondStarShape()
                    .fill(primary)
                    .frame(width: 18 * scale, height: 18 * scale)
                    .offset(x: -88 * scale, y: 14 * scale)

                HStack(spacing: -14 * scale) {
                    Text("S")
                        .font(.system(size: 64 * scale, weight: .black, design: .serif))
                        .foregroundColor(primary)
                    Text("J")
                        .font(.system(size: 54 * scale, weight: .bold, design: .serif))
                        .foregroundColor(secondary)
                        .offset(y: 5 * scale)
                }

                DiamondStarShape()
                    .fill(primary)
                    .frame(width: 26 * scale, height: 26 * scale)
                    .offset(x: 88 * scale, y: 8 * scale)
            }

            if showWordmark {
                Text("SALFORD")
                    .font(.system(size: 30 * scale, weight: .bold, design: .serif))
                    .tracking(3 * scale)
                    .foregroundColor(primary)

                Text("jewelry")
                    .font(.system(size: 13 * scale, weight: .regular, design: .serif))
                    .tracking(2 * scale)
                    .foregroundColor(subColor)
            }
        }
        .environment(\.layoutDirection, .leftToRight)
    }
}

struct DiamondStarShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let cx = rect.midX
        let cy = rect.midY
        let rx = rect.width / 2
        let ry = rect.height / 2
        let ir = min(rx, ry) * 0.24

        path.move(to: CGPoint(x: cx, y: cy - ry))
        path.addLine(to: CGPoint(x: cx + ir, y: cy - ir))
        path.addLine(to: CGPoint(x: cx + rx, y: cy))
        path.addLine(to: CGPoint(x: cx + ir, y: cy + ir))
        path.addLine(to: CGPoint(x: cx, y: cy + ry))
        path.addLine(to: CGPoint(x: cx - ir, y: cy + ir))
        path.addLine(to: CGPoint(x: cx - rx, y: cy))
        path.addLine(to: CGPoint(x: cx - ir, y: cy - ir))
        path.closeSubpath()
        return path
    }
}

struct SalfordCardModifier: ViewModifier {
    var borderColor: Color = SalfordTheme.border
    func body(content: Content) -> some View {
        content
            .padding(14)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(SalfordTheme.cardBg)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(borderColor, lineWidth: 1)
            )
    }
}

extension View {
    func salfordCard(borderColor: Color = SalfordTheme.border) -> some View {
        modifier(SalfordCardModifier(borderColor: borderColor))
    }
}

struct KPIStatCard: View {
    let title: String
    let value: String
    var subtitle: String? = nil
    let icon: String
    var accentColor: Color = SalfordTheme.silverLight

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: icon)
                    .font(.system(.callout, weight: .bold))
                    .foregroundColor(accentColor)
                Spacer()
                Circle()
                    .fill(accentColor.opacity(0.25))
                    .frame(width: 8, height: 8)
            }
            Text(value)
                .font(.system(.headline, weight: .heavy))
                .foregroundColor(accentColor)
                .lineLimit(1)
                .minimumScaleFactor(0.75)

            if let sub = subtitle, !sub.isEmpty {
                Text(sub)
                    .font(.system(.caption, weight: .bold))
                    .foregroundColor(SalfordTheme.goldLight)
                    .lineLimit(1)
            }

            Text(title)
                .font(.system(.caption, weight: .medium))
                .foregroundColor(SalfordTheme.textMuted)
                .lineLimit(1)
        }
        .padding(13)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [SalfordTheme.royalNavy.opacity(0.65), SalfordTheme.navy.opacity(0.9)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(accentColor.opacity(0.3), lineWidth: 1)
        )
    }
}


// MARK: - Product Image Utilities & Reusable Views (Camera & Photo Library Support)
enum ProductImageHelper {
    /// Decodes a Base64 string (with or without data:image prefix) into a UIImage
    static func image(from base64String: String?) -> UIImage? {
        guard let raw = base64String, !raw.isEmpty else { return nil }
        let cleanBase64: String
        if let commaIndex = raw.firstIndex(of: ",") {
            cleanBase64 = String(raw[raw.index(after: commaIndex)...])
        } else {
            cleanBase64 = raw
        }
        guard let data = Data(base64Encoded: cleanBase64, options: .ignoreUnknownCharacters) else {
            return nil
        }
        return UIImage(data: data)
    }

    /// Resizes to maxDimension (720px) and compresses as JPEG.
    static func jpegData(_ image: UIImage, maxDimension: CGFloat = 720, quality: CGFloat = 0.78) -> Data? {
        let size = image.size
        guard size.width > 0 && size.height > 0 else { return nil }
        let ratio = min(maxDimension / size.width, maxDimension / size.height, 1.0)
        let targetSize = CGSize(width: round(size.width * ratio), height: round(size.height * ratio))

        let format = UIGraphicsImageRendererFormat()
        format.scale = 1.0
        let renderer = UIGraphicsImageRenderer(size: targetSize, format: format)
        let resized = renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: targetSize))
        }
        return resized.jpegData(compressionQuality: quality)
    }

    // MARK: Photo files (Documents/ProductImages)

    private static let cache = NSCache<NSString, UIImage>()

    static var folderURL: URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        return docs.appendingPathComponent("ProductImages", isDirectory: true)
    }

    static func fileURL(_ name: String) -> URL {
        folderURL.appendingPathComponent(name)
    }

    /// Writes photo data to a new encrypted file and returns its name.
    static func storeImageData(_ data: Data) -> String? {
        do {
            try FileManager.default.createDirectory(at: folderURL, withIntermediateDirectories: true)
            let name = UUID().uuidString + ".jpg"
            try data.write(to: fileURL(name), options: [.atomic, .completeFileProtection])
            return name
        } catch {
            return nil
        }
    }

    /// Resizes, compresses and stores a picked photo. Returns the new file name.
    static func storeImage(_ image: UIImage) -> String? {
        guard let data = jpegData(image) else { return nil }
        return storeImageData(data)
    }

    static func image(named name: String?) -> UIImage? {
        guard let name, !name.isEmpty else { return nil }
        if let cached = cache.object(forKey: name as NSString) { return cached }
        guard let data = try? Data(contentsOf: fileURL(name)), let img = UIImage(data: data) else { return nil }
        cache.setObject(img, forKey: name as NSString)
        return img
    }

    /// The product's photo, from its file (or from legacy Base64 data if not migrated yet).
    static func image(for product: Product) -> UIImage? {
        image(named: product.imageFile) ?? image(from: product.imageBase64)
    }

    static func deleteImage(named name: String?) {
        guard let name, !name.isEmpty else { return }
        cache.removeObject(forKey: name as NSString)
        try? FileManager.default.removeItem(at: fileURL(name))
    }

    /// Removes photo files that no product refers to any more (e.g. a photo picked and then cancelled).
    static func removeUnusedImages(keeping used: Set<String>) {
        guard let files = try? FileManager.default.contentsOfDirectory(atPath: folderURL.path) else { return }
        for f in files where !used.contains(f) {
            deleteImage(named: f)
        }
    }
}

/// Reusable Thumbnail View that clearly displays a Product's captured/uploaded photo or a luxury fallback icon
struct SalfordProductThumbnailView: View {
    let image: UIImage?
    var size: CGFloat = 72
    var cornerRadius: CGFloat = 14
    var showZoomBadge: Bool = false

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            if let uiImg = image {
                Image(uiImage: uiImg)
                    .resizable()
                    .scaledToFill()
                    .frame(width: size, height: size)
                    .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                            .stroke(SalfordTheme.goldLight.opacity(0.6), lineWidth: 1.3)
                    )

                if showZoomBadge {
                    Image(systemName: "magnifyingglass.circle.fill")
                        .font(.system(.callout, weight: .bold))
                        .foregroundColor(SalfordTheme.textPrimary)
                        .background(Circle().fill(Color.black.opacity(0.6)))
                        .padding(4)
                }
            } else {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(SalfordTheme.royalNavyMid)
                    .frame(width: size, height: size)
                    .overlay(
                        VStack(spacing: 3) {
                            Image(systemName: "camera.fill")
                                .font(.system(size: size * 0.30, weight: .semibold))
                                .foregroundColor(SalfordTheme.silverLight.opacity(0.85))
                            if size >= 64 {
                                Text("بدون صورة")
                                    .font(.system(.caption2, weight: .bold))
                                    .foregroundColor(SalfordTheme.textMuted)
                            }
                        }
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                            .stroke(SalfordTheme.borderSubtle, lineWidth: 1)
                    )
            }
        }
    }
}

/// Native iOS UIImagePickerController wrapper supporting both Camera capture and Photo Library upload
struct NativeImagePickerSheet: UIViewControllerRepresentable {
    var sourceType: UIImagePickerController.SourceType
    var onImagePicked: (UIImage) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        if sourceType == .camera && UIImagePickerController.isSourceTypeAvailable(.camera) {
            picker.sourceType = .camera
            picker.cameraCaptureMode = .photo
        } else {
            picker.sourceType = .photoLibrary
        }
        picker.allowsEditing = true
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    final class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate {
        let parent: NativeImagePickerSheet
        init(_ parent: NativeImagePickerSheet) {
            self.parent = parent
        }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) {
            if let edited = info[.editedImage] as? UIImage {
                parent.onImagePicked(edited)
            } else if let original = info[.originalImage] as? UIImage {
                parent.onImagePicked(original)
            }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}

extension View {
    /// Asks before deleting. Set `item` to show the dialog; `perform` runs only on confirm.
    func confirmDelete<Item>(
        _ item: Binding<Item?>,
        title: @escaping (Item) -> String,
        message: @escaping (Item) -> String,
        confirmLabel: String = "حذف نهائي",
        perform: @escaping (Item) -> Void
    ) -> some View {
        confirmationDialog(
            item.wrappedValue.map(title) ?? "",
            isPresented: Binding(get: { item.wrappedValue != nil }, set: { if !$0 { item.wrappedValue = nil } }),
            titleVisibility: .visible,
            presenting: item.wrappedValue
        ) { value in
            Button(confirmLabel, role: .destructive) {
                perform(value)
                item.wrappedValue = nil
            }
            Button("إلغاء", role: .cancel) { item.wrappedValue = nil }
        } message: { value in
            Text(message(value))
        }
    }
}

// MARK: - Design system building blocks (used by the redesigned screens)

enum SalfordSpacing {
    static let xs: CGFloat = 4
    static let s: CGFloat = 8
    static let m: CGFloat = 12
    static let l: CGFloat = 16
    static let xl: CGFloat = 24
    /// Minimum height of anything tappable (Apple's 44pt guideline).
    static let touch: CGFloat = 44
}

extension View {
    /// Standard text field look: filled, rounded, readable in Light and Dark.
    func salfordField() -> some View {
        self
            .font(.body)
            .padding(.horizontal, SalfordSpacing.m)
            .frame(minHeight: SalfordSpacing.touch)
            .background(SalfordTheme.fieldBg)
            .foregroundColor(SalfordTheme.textPrimary)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

/// One button style for the whole app. Text scales with the phone's text size.
struct SalfordButtonStyle: ButtonStyle {
    enum Kind { case primary, secondary, success, warning, destructive }
    var kind: Kind = .primary
    var fullWidth: Bool = true

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(.subheadline, weight: .bold))
            .multilineTextAlignment(.center)
            .padding(.horizontal, SalfordSpacing.l)
            .frame(maxWidth: fullWidth ? .infinity : nil, minHeight: SalfordSpacing.touch)
            .background(background)
            .foregroundColor(foreground)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(kind == .secondary ? SalfordTheme.borderSubtle : .clear, lineWidth: 1)
            )
            .opacity(configuration.isPressed ? 0.75 : 1)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }

    @ViewBuilder private var background: some View {
        switch kind {
        case .primary: SalfordTheme.silverGradient
        case .secondary: SalfordTheme.royalNavyMid
        case .success: SalfordTheme.emeraldSuccess
        case .warning: SalfordTheme.warningAmber
        case .destructive: SalfordTheme.dangerRed.opacity(0.15)
        }
    }

    private var foreground: Color {
        switch kind {
        case .primary: return SalfordTheme.onPrimary
        case .secondary: return SalfordTheme.textPrimary
        case .success, .warning: return SalfordTheme.onColored
        case .destructive: return SalfordTheme.dangerRed
        }
    }
}

extension ButtonStyle where Self == SalfordButtonStyle {
    static var salfordPrimary: SalfordButtonStyle { SalfordButtonStyle(kind: .primary) }
    static var salfordSecondary: SalfordButtonStyle { SalfordButtonStyle(kind: .secondary) }
    static var salfordSuccess: SalfordButtonStyle { SalfordButtonStyle(kind: .success) }
}

/// Section heading with an optional icon, used at the top of cards.
struct SalfordSectionTitle: View {
    let title: String
    var icon: String? = nil
    var color: Color = SalfordTheme.silverLight

    var body: some View {
        HStack(spacing: SalfordSpacing.s) {
            if let icon {
                Image(systemName: icon)
                    .foregroundColor(SalfordTheme.goldLight)
            }
            Text(title)
                .font(.system(.headline, weight: .bold))
                .foregroundColor(color)
            Spacer(minLength: 0)
        }
        .accessibilityAddTraits(.isHeader)
    }
}

/// Friendly placeholder for empty lists.
struct SalfordEmptyState: View {
    let icon: String
    let title: String
    var message: String? = nil

    var body: some View {
        VStack(spacing: SalfordSpacing.s) {
            Image(systemName: icon)
                .font(.system(.largeTitle))
                .foregroundColor(SalfordTheme.textMuted)
            Text(title)
                .font(.system(.headline))
                .foregroundColor(SalfordTheme.textPrimary)
            if let message {
                Text(message)
                    .font(.system(.subheadline))
                    .foregroundColor(SalfordTheme.textMuted)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, SalfordSpacing.xl)
    }
}
