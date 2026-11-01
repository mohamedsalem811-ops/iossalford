import SwiftUI

/// The two separate systems in the app. Each has its own database file, customers, brands,
/// expenses, receipts, reports and login.
enum BusinessLine: String, CaseIterable, Identifiable {
    case jewelry
    case scarves

    var id: String { rawValue }

    var title: String {
        switch self {
        case .jewelry: return "المجوهرات"
        case .scarves: return "الأوشحة"
        }
    }

    var subtitle: String {
        switch self {
        case .jewelry: return "الدخول بالوجه (Face ID)"
        case .scarves: return "الدخول برمز الأوشحة"
        }
    }

    var icon: String {
        switch self {
        case .jewelry: return "sparkles"
        case .scarves: return "wind"
        }
    }

    /// Accent colour so it's always obvious which system is open.
    var accent: Color {
        switch self {
        case .jewelry: return SalfordTheme.gold
        case .scarves: return SalfordTheme.adaptive(
            light: UIColor(red: 176/255, green: 62/255, blue: 104/255, alpha: 1),
            dark: UIColor(red: 232/255, green: 128/255, blue: 166/255, alpha: 1))
        }
    }

    /// Database file. Jewelry keeps the original file name so existing data is used as-is.
    var databaseFileName: String {
        switch self {
        case .jewelry: return "salford_jewelry_native_db_v610.json"
        case .scarves: return "salford_scarves_db_v1.json"
        }
    }

    var lastGoodFileName: String {
        switch self {
        case .jewelry: return "salford_jewelry_native_db_v610.lastgood.json"
        case .scarves: return "salford_scarves_db_v1.lastgood.json"
        }
    }

    /// Prefix of photo files, so each system only ever cleans up its own photos.
    var imagePrefix: String {
        switch self {
        case .jewelry: return ""
        case .scarves: return "scarf-"
        }
    }

    /// Receipt numbers: GR-2026-0001 (jewelry), SC-2026-0001 (scarves).
    var receiptPrefix: String {
        switch self {
        case .jewelry: return "GR"
        case .scarves: return "SC"
        }
    }

    var pinVault: PinVault {
        switch self {
        case .jewelry: return .jewelry
        case .scarves: return .scarves
        }
    }

    /// Jewelry opens with Face ID / Touch ID (PIN as backup); scarves opens with its own code only.
    var usesBiometrics: Bool { self == .jewelry }

    var categories: [String] {
        switch self {
        case .jewelry: return ["خواتم", "أساور", "قلادات", "أقراط", "دبابيس", "ساعات", "أطقم", "أخرى"]
        case .scarves: return ["حرير", "كشمير", "صوف", "قطن", "فيسكوز", "شيفون", "ساتان", "أخرى"]
        }
    }

    /// Brands suggested in a brand-new database.
    var defaultBrands: [String] {
        switch self {
        case .jewelry: return ["Swarovski", "Tiffany & Co.", "Pandora"]
        case .scarves: return []
        }
    }
}
