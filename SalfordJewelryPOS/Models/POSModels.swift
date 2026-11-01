import Foundation

struct Product: Identifiable, Codable, Equatable {
    var id: Int
    var sku: String
    var name: String
    var category: String
    var costPrice: Double
    var sellPrice: Double
    var stock: Int
    var lowStockAlert: Int
    var size: String?
    var color: String?
    /// Legacy / backups only: older versions kept the photo inside the database as Base64.
    /// It is moved into its own file on load (see `imageFile`) and only filled again inside backups.
    var imageBase64: String?
    var costRate: Double?
    var costUSD: Double?
    var createdAt: String

    /// File name of the product photo in Documents/ProductImages.
    var imageFile: String? = nil
    /// Brand typed by the shop (e.g. "Pandora"); nil = no brand / own pieces.
    var brand: String? = nil
    /// Scarves: every size of one design is its own item (own price, cost, stock) and they share
    /// this id. nil for jewelry and for single items.
    var designId: String? = nil

    var hasImage: Bool { imageFile != nil || !(imageBase64 ?? "").isEmpty }

    var isLowStock: Bool { stock <= lowStockAlert && stock > 0 }
    var isOutOfStock: Bool { stock <= 0 }
    var marginPercent: Double {
        guard sellPrice > 0 else { return 0 }
        return ((sellPrice - costPrice) / sellPrice) * 100.0
    }
}

struct Customer: Identifiable, Codable, Equatable {
    var id: Int
    var name: String
    var phone: String?
    var area: String?
    var notes: String?
    var createdAt: String
}

struct SetItem: Identifiable, Codable, Equatable {
    var id: Int
    var productId: Int
    var quantity: Int
}

struct JewelrySet: Identifiable, Codable, Equatable {
    var id: Int
    var name: String
    var description: String?
    var discount: Double
    var items: [SetItem]
    var createdAt: String
}

struct SaleRecord: Identifiable, Codable, Equatable {
    var id: Int
    var productId: Int
    var productName: String
    var sku: String?
    var color: String?
    var quantity: Int
    var costPrice: Double
    var sellPrice: Double
    var actualPrice: Double
    var totalSell: Double
    var totalCost: Double
    var profit: Double
    var saleRate: Double
    var totalSellUSD: Double
    var totalCostUSD: Double
    var profitUSD: Double
    var paymentMethod: String
    var customerId: Int?
    var customerName: String?
    var setId: Int?
    var note: String?
    var saleDate: String
    var monthYear: String
    /// Brand of the piece at the time of sale (for "sales by brand").
    var brand: String? = nil
    /// Scarves: size sold (for "sales by size").
    var size: String? = nil
}

struct CartItem: Identifiable, Equatable {
    var id = UUID()
    var product: Product
    var quantity: Int
    var unitPrice: Double
    /// Set when this line is part of a bundle sold together; all lines of one bundle share `bundleGroup`.
    var setId: Int? = nil
    var setName: String? = nil
    var bundleGroup: UUID? = nil

    var subtotal: Double { Double(quantity) * unitPrice }
    var totalCost: Double { Double(quantity) * product.costPrice }
    var profit: Double { subtotal - totalCost }
}

struct ReturnRecord: Identifiable, Codable, Equatable {
    var id: Int
    var productId: Int
    var productName: String
    var quantity: Int
    var refundAmount: Double
    /// Cost of the returned pieces (they go back into stock). Missing on returns recorded by older versions.
    var costAmount: Double? = nil
    /// The sale this return belongs to. nil for returns without an invoice (or recorded by older versions).
    var saleId: Int? = nil
    var reason: String?
    var returnDate: String
    var monthYear: String
}

struct ExpenseRecord: Identifiable, Codable, Equatable {
    var id: Int
    var description: String
    var amount: Double
    var monthYear: String
    var expenseDate: String
}

struct QuarterlyClosing: Identifiable, Codable, Equatable {
    var id: Int
    var quarterKey: String
    /// Machine key of the closed period, e.g. "2026-Q4". Missing on closings made by older versions.
    var periodKey: String? = nil
    var totalSales: Double
    var totalCost: Double
    var totalExpenses: Double
    var totalRefunds: Double
    var totalProfit: Double
    var totalTransactions: Int
    var itemsSold: Int
    var notes: String?
    var closedAt: String
}

enum ReceiptTemplate: String, CaseIterable, Identifiable, Codable {
    case salfordRoyal = "salford_dark"
    case salfordWhite = "salford_light"
    case swarovskiLondon = "swarovski"
    case scarvesLibya = "scarves_libya"
    case scarvesSalford = "scarves_salford"

    var id: String { rawValue }

    /// Templates offered in each system: jewelry keeps its three, scarves has its own two.
    static func available(for line: BusinessLine) -> [ReceiptTemplate] {
        switch line {
        case .jewelry: return [.salfordRoyal, .salfordWhite, .swarovskiLondon]
        case .scarves: return [.scarvesLibya, .scarvesSalford]
        }
    }

    /// Store name printed on the receipt.
    var storeName: String {
        switch self {
        case .salfordRoyal, .salfordWhite: return "SALFORD Jewelry — Libya"
        case .swarovskiLondon: return "Swarovski London"
        case .scarvesLibya: return "SALFORD Libya"
        case .scarvesSalford: return "SALFORD Scarves"
        }
    }

    var title: String {
        switch self {
        case .salfordRoyal: return "✨ SALFORD الملكي (ثيم الشعار)"
        case .salfordWhite: return "🤍 SALFORD الرسمي (أبيض)"
        case .swarovskiLondon: return "🦢 Swarovski London"
        case .scarvesLibya: return "SALFORD Libya"
        case .scarvesSalford: return "SALFORD Scarves"
        }
    }

    /// Short name for the template picker cards.
    var shortName: String {
        switch self {
        case .salfordRoyal: return "SALFORD الملكي"
        case .salfordWhite: return "SALFORD الرسمي"
        case .swarovskiLondon: return "Swarovski London"
        case .scarvesLibya: return "SALFORD Libya"
        case .scarvesSalford: return "SALFORD Scarves"
        }
    }

    var subtitle: String {
        switch self {
        case .salfordRoyal: return "ترويسة داكنة بشعار SJ"
        case .salfordWhite: return "أبيض كلاسيكي"
        case .swarovskiLondon: return "قالب Covent Garden"
        case .scarvesLibya: return "أبيض — SALFORD Libya"
        case .scarvesSalford: return "ترويسة وردية — SALFORD Scarves"
        }
    }
}

struct ReceiptLineItem: Identifiable, Codable, Equatable {
    var id = UUID()
    var name: String
    var color: String
    var code: String
    var qty: Int
    var price: Double
    var brand: String? = nil

    /// "Pandora — Moments Bracelet (Silver)"; brand and colour only when present.
    var fullTitle: String {
        let trimmedColor = color.trimmingCharacters(in: .whitespacesAndNewlines)
        let base = trimmedColor.isEmpty ? name : "\(name) (\(trimmedColor))"
        guard let b = brand?.trimmingCharacters(in: .whitespacesAndNewlines), !b.isEmpty else { return base }
        return "\(b) — \(base)"
    }
}

struct POSDatabaseState: Codable {
    /// Legacy only: older versions stored the PIN here in plain text. It is read once to migrate
    /// into the Keychain (see PinVault) and is never written again.
    var pin: String?
    var exchangeRate: Double
    var products: [Product]
    var customers: [Customer]
    var sets: [JewelrySet]
    var sales: [SaleRecord]
    var returns: [ReturnRecord]
    var expenses: [ExpenseRecord]
    var closings: [QuarterlyClosing]
    var receipts: [IssuedReceipt] = []
    var payments: [CustomerPayment] = []
    /// Last receipt number handed out; receipt numbers are never reused.
    var receiptCounter: Int = 0
    /// Brands the shop works with (typed by the user). nil in files from older versions.
    var brands: [String]? = nil
}

/// Money a customer paid toward what they owe from credit (آجل) sales.
struct CustomerPayment: Identifiable, Codable, Equatable {
    var id: Int
    var customerId: Int
    var amount: Double
    var method: String
    var note: String?
    var paymentDate: String
    var monthYear: String
}

/// A receipt that was issued (saved), so it can be found and reprinted later.
struct IssuedReceipt: Identifiable, Codable, Equatable {
    var id: Int
    var receiptNo: String
    var date: String   // dd/MM/yyyy
    var time: String   // HH:mm
    var customer: String
    var items: [ReceiptLineItem]
    var template: ReceiptTemplate
    var showRealPrices: Bool
    /// Sales this receipt was issued for (empty for a gift receipt made by hand).
    var saleIds: [Int]
    var createdAt: String
    var updatedAt: String?

    var total: Double { items.reduce(0) { $0 + $1.price * Double($1.qty) } }
}

extension POSDatabaseState {
    enum CodingKeys: String, CodingKey {
        case pin, exchangeRate, products, customers, sets, sales, returns, expenses, closings
        case receipts, receiptCounter, payments, brands
    }

    static let defaultExchangeRate = 7.0

    static var empty: POSDatabaseState {
        POSDatabaseState(
            pin: nil,
            exchangeRate: defaultExchangeRate,
            products: [], customers: [], sets: [], sales: [], returns: [], expenses: [], closings: []
        )
    }

    /// Tolerant decoding: a section that is missing from the file (older/newer app version)
    /// falls back to its default instead of making the whole database unreadable.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        pin = try c.decodeIfPresent(String.self, forKey: .pin)
        exchangeRate = try c.decodeIfPresent(Double.self, forKey: .exchangeRate) ?? Self.defaultExchangeRate
        products = try c.decodeIfPresent([Product].self, forKey: .products) ?? []
        customers = try c.decodeIfPresent([Customer].self, forKey: .customers) ?? []
        sets = try c.decodeIfPresent([JewelrySet].self, forKey: .sets) ?? []
        sales = try c.decodeIfPresent([SaleRecord].self, forKey: .sales) ?? []
        returns = try c.decodeIfPresent([ReturnRecord].self, forKey: .returns) ?? []
        expenses = try c.decodeIfPresent([ExpenseRecord].self, forKey: .expenses) ?? []
        closings = try c.decodeIfPresent([QuarterlyClosing].self, forKey: .closings) ?? []
        receipts = try c.decodeIfPresent([IssuedReceipt].self, forKey: .receipts) ?? []
        receiptCounter = try c.decodeIfPresent(Int.self, forKey: .receiptCounter) ?? 0
        payments = try c.decodeIfPresent([CustomerPayment].self, forKey: .payments) ?? []
        brands = try c.decodeIfPresent([String].self, forKey: .brands)
    }
}

/// A calendar quarter, e.g. Q4 2026 = months 2026-10, 2026-11, 2026-12.
struct QuarterPeriod: Hashable, Identifiable {
    var year: Int
    var quarter: Int // 1...4

    var id: String { key }
    var key: String { "\(year)-Q\(quarter)" }

    var monthKeys: [String] {
        let first = (quarter - 1) * 3 + 1
        return (first...(first + 2)).map { String(format: "%04d-%02d", year, $0) }
    }

    var title: String {
        let names = ["الأول", "الثاني", "الثالث", "الرابع"]
        return "الربع \(names[quarter - 1]) \(year)"
    }

    static func containing(_ date: Date = Date()) -> QuarterPeriod {
        let cal = Calendar(identifier: .gregorian)
        let comps = cal.dateComponents([.year, .month], from: date)
        return QuarterPeriod(year: comps.year ?? 2026, quarter: ((comps.month ?? 1) - 1) / 3 + 1)
    }
}

/// Financial totals for a set of months. Every report uses this so the numbers always agree.
struct PeriodSummary: Equatable {
    var grossSales: Double = 0      // sales before refunds
    var costOfSales: Double = 0
    var grossProfit: Double = 0     // sales profit before refunds and expenses
    var refunds: Double = 0         // money given back to customers
    var returnedCost: Double = 0    // cost of returned pieces (back in stock)
    var expenses: Double = 0
    var transactions: Int = 0
    var itemsSold: Int = 0
    var itemsReturned: Int = 0

    var netSales: Double { grossSales - refunds }
    /// Profit lost to returns: the refund, minus the cost of the piece that came back into stock.
    var returnsProfitImpact: Double { refunds - returnedCost }
    var netProfit: Double { grossProfit - returnsProfitImpact - expenses }
}
