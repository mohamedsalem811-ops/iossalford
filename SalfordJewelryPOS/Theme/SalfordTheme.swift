import SwiftUI
import UIKit

enum SalfordTheme {
    // Core Brand Palette (SALFORD Monogram Scheme)
    static let midnight       = Color(red: 7/255.0, green: 7/255.0, blue: 15/255.0)
    static let navy           = Color(red: 11/255.0, green: 21/255.0, blue: 48/255.0)
    static let royalNavy      = Color(red: 18/255.0, green: 36/255.0, blue: 82/255.0)
    static let violet         = Color(red: 43/255.0, green: 25/255.0, blue: 84/255.0)
    static let crystal        = Color(red: 200/255.0, green: 216/255.0, blue: 240/255.0)
    static let ice            = Color(red: 232/255.0, green: 240/255.0, blue: 255/255.0)
    static let gold           = Color(red: 184/255.0, green: 150/255.0, blue: 90/255.0)
    static let goldLight      = Color(red: 212/255.0, green: 175/255.0, blue: 122/255.0)
    static let goldDark       = Color(red: 138/255.0, green: 110/255.0, blue: 62/255.0)
    static let blueGlow       = Color(red: 106/255.0, green: 163/255.0, blue: 255/255.0)
    static let emerald        = Color(red: 29/255.0, green: 184/255.0, blue: 122/255.0)
    static let crimson        = Color(red: 224/255.0, green: 59/255.0, blue: 90/255.0)
    static let muted          = Color(red: 140/255.0, green: 158/255.0, blue: 192/255.0)
    static let cardBg         = Color(red: 13/255.0, green: 25/255.0, blue: 56/255.0).opacity(0.92)
    static let border         = Color(red: 200/255.0, green: 216/255.0, blue: 240/255.0).opacity(0.16)

    // Semantic UI Tokens used across all Views
    static let bgPrimary      = midnight
    static let bgSecondary    = navy
    static let bgCard         = cardBg
    static let bgElevated     = Color(red: 20/255.0, green: 39/255.0, blue: 88/255.0)
    static let royalNavyTop   = royalNavy
    static let royalNavyMid   = Color(red: 25/255.0, green: 48/255.0, blue: 106/255.0)
    static let silverLight    = ice
    static let silverAccent   = crystal
    static let textMuted      = muted
    static let borderSubtle   = border
    static let emeraldSuccess = Color(red: 52/255.0, green: 211/255.0, blue: 153/255.0)
    static let dangerRed      = Color(red: 239/255.0, green: 68/255.0, blue: 68/255.0)
    static let warningAmber   = Color(red: 245/255.0, green: 158/255.0, blue: 11/255.0)
    static let infoBlue       = Color(red: 96/255.0, green: 165/255.0, blue: 250/255.0)

    static let bgGradient = LinearGradient(
        colors: [royalNavyTop, bgSecondary, bgPrimary],
        startPoint: .top,
        endPoint: .bottom
    )

    static let silverGradient = LinearGradient(
        colors: [silverLight, silverAccent],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static func formatLYD(_ val: Double) -> String {
        String(format: "%.2f د.ل", val)
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
        let primary = darkText ? Color(red: 9/255.0, green: 10/255.0, blue: 20/255.0) : Color.white
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
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(accentColor)
                Spacer()
                Circle()
                    .fill(accentColor.opacity(0.25))
                    .frame(width: 8, height: 8)
            }
            Text(value)
                .font(.system(size: 17, weight: .heavy))
                .foregroundColor(accentColor)
                .lineLimit(1)
                .minimumScaleFactor(0.75)

            if let sub = subtitle, !sub.isEmpty {
                Text(sub)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(SalfordTheme.goldLight)
                    .lineLimit(1)
            }

            Text(title)
                .font(.system(size: 11, weight: .medium))
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

    /// Resizes UIImage to maxDimension (720px) and encodes as compressed JPEG Base64 string
    static func encodeToBase64(_ image: UIImage, maxDimension: CGFloat = 720, quality: CGFloat = 0.78) -> String? {
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
        guard let jpegData = resized.jpegData(compressionQuality: quality) else { return nil }
        return jpegData.base64EncodedString()
    }
}

/// Reusable Thumbnail View that clearly displays a Product's captured/uploaded photo or a luxury fallback icon
struct SalfordProductThumbnailView: View {
    let imageBase64: String?
    var size: CGFloat = 72
    var cornerRadius: CGFloat = 14
    var showZoomBadge: Bool = false

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            if let uiImg = ProductImageHelper.image(from: imageBase64) {
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
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(.white)
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
                                    .font(.system(size: 8.5, weight: .bold))
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
