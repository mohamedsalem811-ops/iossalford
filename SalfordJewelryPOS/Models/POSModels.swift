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
    var imageBase64: String?
    var costRate: Double?
    var costUSD: Double?
    var createdAt: String

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
    var saleRate: Double?
    var totalSellUSD: Double?
    var totalCostUSD: Double?
    var profitUSD: Double?
    var paymentMethod: String
    var customerId: Int?
    var customerName: String?
    var setId: Int?
    var note: String?
    var saleDate: String
    var monthYear: String
}

struct CartItem: Identifiable, Equatable {
    var id = UUID()
    var product: Product
    var quantity: Int
    var unitPrice: Double

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

    var id: String { rawValue }

    var title: String {
        switch self {
        case .salfordRoyal: return "✨ SALFORD الملكي (ثيم الشعار)"
        case .salfordWhite: return "🤍 SALFORD الرسمي (أبيض)"
        case .swarovskiLondon: return "🦢 Swarovski London"
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

    var fullTitle: String {
        let trimmedColor = color.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmedColor.isEmpty ? name : "\(name) (\(trimmedColor))"
    }
}

struct POSDatabaseState: Codable {
    var pin: String
    var exchangeRate: Double
    var products: [Product]
    var customers: [Customer]
    var sets: [JewelrySet]
    var sales: [SaleRecord]
    var returns: [ReturnRecord]
    var expenses: [ExpenseRecord]
    var closings: [QuarterlyClosing]
}
