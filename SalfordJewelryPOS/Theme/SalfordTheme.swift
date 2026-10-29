import SwiftUI

enum SalfordTheme {
    static let midnight  = Color(red: 7/255.0, green: 7/255.0, blue: 15/255.0)
    static let navy      = Color(red: 11/255.0, green: 21/255.0, blue: 48/255.0)
    static let royalNavy = Color(red: 18/255.0, green: 36/255.0, blue: 82/255.0)
    static let violet    = Color(red: 43/255.0, green: 25/255.0, blue: 84/255.0)
    static let crystal   = Color(red: 200/255.0, green: 216/255.0, blue: 240/255.0)
    static let ice       = Color(red: 232/255.0, green: 240/255.0, blue: 255/255.0)
    static let gold      = Color(red: 184/255.0, green: 150/255.0, blue: 90/255.0)
    static let goldLight = Color(red: 212/255.0, green: 175/255.0, blue: 122/255.0)
    static let goldDark  = Color(red: 138/255.0, green: 110/255.0, blue: 62/255.0)
    static let blueGlow  = Color(red: 106/255.0, green: 163/255.0, blue: 255/255.0)
    static let emerald   = Color(red: 29/255.0, green: 184/255.0, blue: 122/255.0)
    static let crimson   = Color(red: 224/255.0, green: 59/255.0, blue: 90/255.0)
    static let muted     = Color(red: 106/255.0, green: 122/255.0, blue: 154/255.0)
    static let cardBg    = Color(red: 13/255.0, green: 25/255.0, blue: 56/255.0).opacity(0.88)
    static let border    = Color(red: 200/255.0, green: 216/255.0, blue: 240/255.0).opacity(0.14)

    static func formatLYD(_ val: Double) -> String {
        String(format: "%.2f د.ل", val)
    }

    static func formatUSD(_ val: Double) -> String {
        String(format: "$%.2f", val)
    }
}

/// Official Vector SALFORD Jewelry Monogram Logo (SJ + 4-Point Diamond Stars + SALFORD jewelry)
struct SalfordMonogramLogoView: View {
    var scale: CGFloat = 1.0
    var darkText: Bool = false

    var body: some View {
        let primary = darkText ? Color(red: 9/255, green: 10/255, blue: 20/255) : Color.white
        let secondary = darkText ? Color(red: 30/255, green: 40/255, blue: 65/255) : SalfordTheme.ice
        let subColor = darkText ? Color.gray : SalfordTheme.crystal

        VStack(spacing: 2 * scale) {
            ZStack {
                // Left 4-Point Diamond Starburst
                DiamondStarShape()
                    .fill(primary)
                    .frame(width: 18 * scale, height: 18 * scale)
                    .offset(x: -88 * scale, y: 14 * scale)

                // Interlocked SJ Monogram
                HStack(spacing: -14 * scale) {
                    Text("S")
                        .font(.system(size: 64 * scale, weight: .black, design: .serif))
                        .foregroundColor(primary)
                    Text("J")
                        .font(.system(size: 54 * scale, weight: .bold, design: .serif))
                        .foregroundColor(secondary)
                        .offset(y: 5 * scale)
                }

                // Right Large 4-Point Diamond Starburst
                DiamondStarShape()
                    .fill(primary)
                    .frame(width: 26 * scale, height: 26 * scale)
                    .offset(x: 88 * scale, y: 8 * scale)
            }

            Text("SALFORD")
                .font(.system(size: 30 * scale, weight: .bold, design: .serif))
                .tracking(3 * scale)
                .foregroundColor(primary)

            Text("jewelry")
                .font(.system(size: 13 * scale, weight: .regular, design: .serif))
                .tracking(2 * scale)
                .foregroundColor(subColor)
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
    let icon: String
    let title: String
    let value: String
    var subValue: String? = nil
    var accent: Color = SalfordTheme.goldLight

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(icon)
                    .font(.system(size: 18))
                Spacer()
                Circle()
                    .fill(accent.opacity(0.25))
                    .frame(width: 8, height: 8)
            }
            Text(value)
                .font(.system(size: 17, weight: .heavy, design: .rounded))
                .foregroundColor(accent)
                .lineLimit(1)
                .minimumScaleFactor(0.75)

            if let sub = subValue, !sub.isEmpty {
                Text(sub)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(SalfordTheme.gold)
                    .lineLimit(1)
            }

            Text(title)
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(SalfordTheme.muted)
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
                .stroke(accent.opacity(0.3), lineWidth: 1)
        )
    }
}
