import Foundation
import SwiftUI
import os

@MainActor
final class POSDataStore: ObservableObject {
    @Published var isAuthenticated: Bool = false
    @Published var pin: String = "01020304"
    @Published var exchangeRate: Double = 7.00

    @Published var products: [Product] = []
    @Published var customers: [Customer] = []
    @Published var sets: [JewelrySet] = []
    @Published var sales: [SaleRecord] = []
    @Published var returns: [ReturnRecord] = []
    @Published var expenses: [ExpenseRecord] = []
    @Published var closings: [QuarterlyClosing] = []

    // Multi-item unified cart
    @Published var cart: [CartItem] = []

    // Active Gift Receipt Studio payload
    @Published var showGiftReceiptStudio: Bool = false
    @Published var activeReceiptItems: [ReceiptLineItem] = []
    @Published var activeReceiptNo: String = "GR-2026-001"
    @Published var activeReceiptCustomer: String = "Salford Libya"
    @Published var activeReceiptDate: String = ""
    @Published var activeReceiptTime: String = ""
    @Published var activeReceiptTemplate: ReceiptTemplate = .salfordRoyal
    @Published var showRealPricesInReceipt: Bool = false

    static let categories = ["خواتم", "أساور", "قلادات", "أقراط", "دبابيس", "ساعات", "أطقم", "أخرى"]

    /// Set when loading or saving the database had a problem; shown to the user as an alert.
    @Published var storageAlertMessage: String? = nil

    /// True when an unreadable database could not be copied to safety; saving is then refused
    /// so the original file is never overwritten.
    private var savingBlocked = false

    private static let log = Logger(subsystem: "com.salfordjewelry.pos", category: "storage")

    private var documentsURL: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
    }

    private var dbFileURL: URL {
        documentsURL.appendingPathComponent("salford_jewelry_native_db_v610.json")
    }

    /// Copy of the last database file that was loaded successfully (refreshed on every launch).
    private var lastGoodFileURL: URL {
        documentsURL.appendingPathComponent("salford_jewelry_native_db_v610.lastgood.json")
    }

    private var recoveryFolderURL: URL {
        documentsURL.appendingPathComponent("Recovery", isDirectory: true)
    }

    init() {
        loadFromDisk()
    }

    func verifyPin(_ input: String) -> Bool {
        if input == pin {
            withAnimation(.easeInOut(duration: 0.25)) {
                isAuthenticated = true
            }
            return true
        }
        return false
    }

    func currentMonthYear() -> String {
        let df = DateFormatter()
        df.locale = Locale(identifier: "en_US_POSIX")
        df.dateFormat = "yyyy-MM"
        return df.string(from: Date())
    }

    func nowTimestamp() -> String {
        let df = DateFormatter()
        df.locale = Locale(identifier: "en_US_POSIX")
        df.dateFormat = "yyyy-MM-dd HH:mm:ss"
        return df.string(from: Date())
    }

    // MARK: - Persistence

    private func decodeState(from url: URL) throws -> POSDatabaseState {
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(POSDatabaseState.self, from: data)
    }

    private func apply(_ state: POSDatabaseState) {
        self.pin = state.pin
        self.exchangeRate = state.exchangeRate
        self.products = state.products
        self.customers = state.customers
        self.sets = state.sets
        self.sales = state.sales
        self.returns = state.returns
        self.expenses = state.expenses
        self.closings = state.closings
    }

    /// Loads the database. Demo data is only created on a true first launch (no database file at all).
    /// An existing file that cannot be read is NEVER overwritten: it is copied to Documents/Recovery first,
    /// and the app falls back to the last good copy if one exists.
    func loadFromDisk() {
        let fm = FileManager.default

        guard fm.fileExists(atPath: dbFileURL.path) else {
            // First launch, or upgrading from a build that had no database: also check the last good copy.
            if fm.fileExists(atPath: lastGoodFileURL.path), let state = try? decodeState(from: lastGoodFileURL) {
                apply(state)
                saveToDisk()
                storageAlertMessage = "لم يتم العثور على قاعدة البيانات الرئيسية، وتمت استعادة آخر نسخة سليمة محفوظة تلقائياً."
                return
            }
            seedDemoData()
            return
        }

        do {
            let state = try decodeState(from: dbFileURL)
            apply(state)
            refreshLastGoodCopy()
        } catch {
            Self.log.error("Failed to load database: \(error.localizedDescription, privacy: .public)")
            guard let recoveryName = preserveUnreadableDatabase() else {
                // Could not make a safe copy: leave the original file untouched and refuse all saves.
                savingBlocked = true
                apply(POSDatabaseState.empty)
                storageAlertMessage = """
                تعذّرت قراءة قاعدة البيانات وتعذّر حفظ نسخة منها. لحماية بياناتك تم إيقاف الحفظ تماماً — \
                لا تسجّل أي عمليات الآن. حرّر مساحة على الجهاز ثم أعد تشغيل التطبيق، أو تواصل مع الدعم.
                """
                return
            }

            if fm.fileExists(atPath: lastGoodFileURL.path), let state = try? decodeState(from: lastGoodFileURL) {
                apply(state)
                saveToDisk()
                storageAlertMessage = """
                تعذّرت قراءة قاعدة البيانات، فتمت استعادة آخر نسخة سليمة (من آخر تشغيل ناجح للتطبيق). \
                قد تكون آخر العمليات مفقودة. حُفظ الملف الأصلي دون حذف في: Recovery/\(recoveryName)
                """
            } else {
                // Start empty (not demo data) so nothing fake mixes with the shop's records.
                apply(POSDatabaseState.empty)
                saveToDisk()
                storageAlertMessage = """
                تعذّرت قراءة قاعدة البيانات ولا توجد نسخة سليمة سابقة. لم يُحذف شيء: \
                حُفظ الملف الأصلي في Recovery/\(recoveryName). \
                يمكنك استعادة نسخة احتياطية من الإعدادات، أو التواصل مع الدعم لاسترجاع الملف.
                """
            }
        }
    }

    /// Copies the unreadable database into Documents/Recovery with a timestamp. Returns the file name.
    private func preserveUnreadableDatabase() -> String? {
        let fm = FileManager.default
        let df = DateFormatter()
        df.locale = Locale(identifier: "en_US_POSIX")
        df.dateFormat = "yyyyMMdd-HHmmss"
        let name = "unreadable-db-\(df.string(from: Date())).json"
        do {
            try fm.createDirectory(at: recoveryFolderURL, withIntermediateDirectories: true)
            try fm.copyItem(at: dbFileURL, to: recoveryFolderURL.appendingPathComponent(name))
            return name
        } catch {
            Self.log.error("Failed to preserve unreadable database: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }

    private func refreshLastGoodCopy() {
        let fm = FileManager.default
        do {
            if fm.fileExists(atPath: lastGoodFileURL.path) {
                try fm.removeItem(at: lastGoodFileURL)
            }
            try fm.copyItem(at: dbFileURL, to: lastGoodFileURL)
        } catch {
            Self.log.error("Failed to refresh last good copy: \(error.localizedDescription, privacy: .public)")
        }
    }

    @discardableResult
    func saveToDisk() -> Bool {
        guard !savingBlocked else {
            storageAlertMessage = "الحفظ متوقف لحماية قاعدة البيانات الأصلية. أعد تشغيل التطبيق بعد تحرير مساحة على الجهاز."
            return false
        }
        let state = POSDatabaseState(
            pin: pin,
            exchangeRate: exchangeRate,
            products: products,
            customers: customers,
            sets: sets,
            sales: sales,
            returns: returns,
            expenses: expenses,
            closings: closings
        )
        do {
            let data = try JSONEncoder().encode(state)
            try data.write(to: dbFileURL, options: .atomic)
            return true
        } catch {
            Self.log.error("Failed to save database: \(error.localizedDescription, privacy: .public)")
            storageAlertMessage = "⚠️ فشل حفظ البيانات على الجهاز: \(error.localizedDescription). تأكد من توفر مساحة تخزين، ولا تغلق التطبيق قبل أخذ نسخة احتياطية."
            return false
        }
    }

    /// Saves, then writes a dated copy of the database to a temporary file for sharing.
    /// The live database file itself is never handed to the share sheet.
    func exportBackupJSON() -> URL? {
        guard saveToDisk() else { return nil }
        let df = DateFormatter()
        df.locale = Locale(identifier: "en_US_POSIX")
        df.dateFormat = "yyyy-MM-dd_HHmm"
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("SALFORD_Jewelry_Backup_\(df.string(from: Date())).json")
        do {
            if FileManager.default.fileExists(atPath: url.path) {
                try FileManager.default.removeItem(at: url)
            }
            try FileManager.default.copyItem(at: dbFileURL, to: url)
            return url
        } catch {
            Self.log.error("Failed to prepare backup: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }

    func importBackupJSON(from url: URL) -> Bool {
        let secured = url.startAccessingSecurityScopedResource()
        defer { if secured { url.stopAccessingSecurityScopedResource() } }
        let decoded: POSDatabaseState
        do {
            decoded = try decodeState(from: url)
        } catch {
            Self.log.error("Failed to import backup: \(error.localizedDescription, privacy: .public)")
            return false
        }
        // Keep a copy of the current data before replacing it with the imported backup.
        if FileManager.default.fileExists(atPath: dbFileURL.path) {
            refreshLastGoodCopy()
        }
        apply(decoded)
        return saveToDisk()
    }

    func seedDemoData() {
        let now = nowTimestamp()
        let curMY = currentMonthYear()

        self.pin = "01020304"
        self.exchangeRate = 7.00
        self.customers = [
            Customer(id: 1, name: "سارة المهدي", phone: "0912345678", area: "طرابلس — حي الأندلس", notes: "عميلة مميزة — تفضل الذهب الأبيض والألماس", createdAt: now),
            Customer(id: 2, name: "نور الهدى العبيدي", phone: "0923456789", area: "بنغازي — فينيسيا", notes: "مهتمة بالأطقم الملكية والهدايا", createdAt: now),
            Customer(id: 3, name: "مريم السنوسي", phone: "0918765432", area: "مصراتة", notes: "خواتم وأساور", createdAt: now)
        ]
        self.products = [
            Product(id: 1, sku: "RNG-SFD01", name: "خاتم سوليتير ألماس ملكي", category: "خواتم", costPrice: 850, sellPrice: 1250, stock: 8, lowStockAlert: 3, size: "7", color: "ذهبي أبيض", imageBase64: nil, costRate: 7.0, costUSD: 121.43, createdAt: now),
            Product(id: 2, sku: "BRC-SFD02", name: "سوار تنس كريستال فاخر", category: "أساور", costPrice: 620, sellPrice: 950, stock: 6, lowStockAlert: 3, size: "M", color: "فضي", imageBase64: nil, costRate: 7.0, costUSD: 88.57, createdAt: now),
            Product(id: 3, sku: "NCK-SFD03", name: "قلادة اللؤلؤ والذهب الوردي", category: "قلادات", costPrice: 700, sellPrice: 1100, stock: 5, lowStockAlert: 2, size: nil, color: "روز جولد", imageBase64: nil, costRate: 7.0, costUSD: 100.00, createdAt: now),
            Product(id: 4, sku: "EAR-SFD04", name: "أقراط قطرة الماس الكلاسيكية", category: "أقراط", costPrice: 420, sellPrice: 680, stock: 2, lowStockAlert: 3, size: nil, color: "فضي", imageBase64: nil, costRate: 7.0, costUSD: 60.00, createdAt: now),
            Product(id: 5, sku: "WCH-SFD05", name: "ساعة سالفورد الملكية المرصعة", category: "ساعات", costPrice: 1400, sellPrice: 2100, stock: 4, lowStockAlert: 2, size: nil, color: "ذهبي", imageBase64: nil, costRate: 7.0, costUSD: 200.00, createdAt: now),
            Product(id: 6, sku: "PIN-SFD06", name: "بروش التاج المرصع بالزركون", category: "دبابيس", costPrice: 280, sellPrice: 450, stock: 10, lowStockAlert: 3, size: nil, color: "ذهبي", imageBase64: nil, costRate: 7.0, costUSD: 40.00, createdAt: now)
        ]
        self.sets = [
            JewelrySet(id: 1, name: "طقم العروس الملكي الكامل", description: "خاتم سوليتير + سوار تنس + قلادة اللؤلؤ بخصم خاص", discount: 200, items: [
                SetItem(id: 1, productId: 1, quantity: 1),
                SetItem(id: 2, productId: 2, quantity: 1)
            ], createdAt: now),
            JewelrySet(id: 2, name: "طقم السهرة الماسي", description: "قلادة اللؤلؤ + أقراط قطرة الماس", discount: 100, items: [
                SetItem(id: 3, productId: 3, quantity: 1),
                SetItem(id: 4, productId: 4, quantity: 1)
            ], createdAt: now)
        ]
        self.sales = [
            SaleRecord(id: 1, productId: 1, productName: "خاتم سوليتير ألماس ملكي", sku: "RNG-SFD01", color: "ذهبي أبيض", quantity: 1, costPrice: 850, sellPrice: 1250, actualPrice: 1250, totalSell: 1250, totalCost: 850, profit: 400, saleRate: 7.0, totalSellUSD: 178.57, totalCostUSD: 121.43, profitUSD: 57.14, paymentMethod: "كاش", customerId: 1, customerName: "سارة المهدي", setId: nil, note: "تغليف هدايا فاخر", saleDate: now, monthYear: curMY),
            SaleRecord(id: 2, productId: 5, productName: "ساعة سالفورد الملكية المرصعة", sku: "WCH-SFD05", color: "ذهبي", quantity: 1, costPrice: 1400, sellPrice: 2100, actualPrice: 2050, totalSell: 2050, totalCost: 1400, profit: 650, saleRate: 7.0, totalSellUSD: 292.86, totalCostUSD: 200.00, profitUSD: 92.86, paymentMethod: "بطاقة", customerId: 2, customerName: "نور الهدى العبيدي", setId: nil, note: "خصم خاص للعميلة", saleDate: now, monthYear: curMY),
            SaleRecord(id: 3, productId: 3, productName: "قلادة اللؤلؤ والذهب الوردي", sku: "NCK-SFD03", color: "روز جولد", quantity: 1, costPrice: 700, sellPrice: 1100, actualPrice: 1100, totalSell: 1100, totalCost: 700, profit: 400, saleRate: 7.0, totalSellUSD: 157.14, totalCostUSD: 100.00, profitUSD: 57.14, paymentMethod: "تحويل", customerId: 3, customerName: "مريم السنوسي", setId: nil, note: nil, saleDate: now, monthYear: curMY)
        ]
        self.returns = []
        self.expenses = [
            ExpenseRecord(id: 1, description: "علب مخملية وأكياس تغليف سالفورد", amount: 180, monthYear: curMY, expenseDate: now),
            ExpenseRecord(id: 2, description: "إعلانات ممولة وتصوير منتجات", amount: 220, monthYear: curMY, expenseDate: now)
        ]
        self.closings = []
        saveToDisk()
    }

    func generateSKU(for category: String) -> String {
        let prefixMap = ["خواتم": "RNG", "أساور": "BRC", "قلادات": "NCK", "أقراط": "EAR", "دبابيس": "PIN", "ساعات": "WCH", "أطقم": "SET"]
        let prefix = prefixMap[category] ?? "PRD"
        let rand = String(Int(Date().timeIntervalSince1970) % 100000, radix: 16).uppercased()
        return "\(prefix)-\(rand)"
    }

    // MARK: - Products CRUD
    func saveProduct(_ prod: Product) {
        if let idx = products.firstIndex(where: { $0.id == prod.id }) {
            products[idx] = prod
        } else {
            var newProd = prod
            newProd.id = (products.map(\.id).max() ?? 0) + 1
            if newProd.sku.trimmingCharacters(in: .whitespaces).isEmpty {
                newProd.sku = generateSKU(for: newProd.category)
            }
            products.insert(newProd, at: 0)
        }
        saveToDisk()
    }

    func deleteProduct(id: Int) {
        products.removeAll { $0.id == id }
        saveToDisk()
    }

    // MARK: - Sales & Multi-Item Cart
    func recordSingleSale(
        product: Product,
        quantity: Int,
        actualPrice: Double,
        saleRate: Double,
        paymentMethod: String,
        customerName: String,
        customerPhone: String,
        customerArea: String,
        note: String
    ) {
        guard let idx = products.firstIndex(where: { $0.id == product.id }), products[idx].stock >= quantity else { return }
        products[idx].stock -= quantity

        let custId = ensureCustomer(name: customerName, phone: customerPhone, area: customerArea)
        let totalSell = actualPrice * Double(quantity)
        let totalCost = product.costPrice * Double(quantity)
        let profit = totalSell - totalCost
        let rate = saleRate > 0 ? saleRate : (exchangeRate > 0 ? exchangeRate : 7.0)

        let newId = (sales.map(\.id).max() ?? 0) + 1
        let rec = SaleRecord(
            id: newId,
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            color: product.color,
            quantity: quantity,
            costPrice: product.costPrice,
            sellPrice: product.sellPrice,
            actualPrice: actualPrice,
            totalSell: totalSell,
            totalCost: totalCost,
            profit: profit,
            saleRate: rate,
            totalSellUSD: totalSell / rate,
            totalCostUSD: totalCost / rate,
            profitUSD: profit / rate,
            paymentMethod: paymentMethod,
            customerId: custId,
            customerName: customerName.isEmpty ? nil : customerName,
            setId: nil,
            note: note.isEmpty ? nil : note,
            saleDate: nowTimestamp(),
            monthYear: currentMonthYear()
        )
        sales.insert(rec, at: 0)
        saveToDisk()

        // Automatically open Gift Receipt Studio for this sale
        openReceiptStudio(
            saleId: newId,
            items: [
                ReceiptLineItem(
                    name: product.name,
                    color: product.color ?? "",
                    code: product.sku,
                    qty: quantity,
                    price: actualPrice
                )
            ],
            customer: customerName.isEmpty ? "Salford Libya" : customerName
        )
    }

    func checkoutCart(
        saleRate: Double,
        paymentMethod: String,
        customerName: String,
        customerPhone: String,
        customerArea: String,
        note: String
    ) {
        guard !cart.isEmpty else { return }
        let custId = ensureCustomer(name: customerName, phone: customerPhone, area: customerArea)
        let rate = saleRate > 0 ? saleRate : (exchangeRate > 0 ? exchangeRate : 7.0)
        var receiptLines: [ReceiptLineItem] = []
        var firstSaleId: Int = (sales.map(\.id).max() ?? 0) + 1

        for (i, item) in cart.enumerated() {
            guard let pIdx = products.firstIndex(where: { $0.id == item.product.id }),
                  products[pIdx].stock >= item.quantity else { continue }
            products[pIdx].stock -= item.quantity

            let newId = (sales.map(\.id).max() ?? 0) + 1
            if i == 0 { firstSaleId = newId }
            let totalSell = item.subtotal
            let totalCost = item.totalCost
            let profit = item.profit

            let rec = SaleRecord(
                id: newId,
                productId: item.product.id,
                productName: item.product.name,
                sku: item.product.sku,
                color: item.product.color,
                quantity: item.quantity,
                costPrice: item.product.costPrice,
                sellPrice: item.product.sellPrice,
                actualPrice: item.unitPrice,
                totalSell: totalSell,
                totalCost: totalCost,
                profit: profit,
                saleRate: rate,
                totalSellUSD: totalSell / rate,
                totalCostUSD: totalCost / rate,
                profitUSD: profit / rate,
                paymentMethod: paymentMethod,
                customerId: custId,
                customerName: customerName.isEmpty ? nil : customerName,
                setId: nil,
                note: note.isEmpty ? "سلة مبيعات موحدة" : "\(note) (سلة موحدة)",
                saleDate: nowTimestamp(),
                monthYear: currentMonthYear()
            )
            sales.insert(rec, at: 0)
            receiptLines.append(
                ReceiptLineItem(
                    name: item.product.name,
                    color: item.product.color ?? "",
                    code: item.product.sku,
                    qty: item.quantity,
                    price: item.unitPrice
                )
            )
        }

        cart.removeAll()
        saveToDisk()

        if !receiptLines.isEmpty {
            openReceiptStudio(
                saleId: firstSaleId,
                items: receiptLines,
                customer: customerName.isEmpty ? "Salford Libya" : customerName
            )
        }
    }

    private func ensureCustomer(name: String, phone: String, area: String) -> Int? {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        if let existing = customers.first(where: { $0.name.lowercased() == trimmed.lowercased() }) {
            return existing.id
        }
        let newId = (customers.map(\.id).max() ?? 0) + 1
        let c = Customer(
            id: newId,
            name: trimmed,
            phone: phone.isEmpty ? nil : phone,
            area: area.isEmpty ? nil : area,
            notes: "تمت الإضافة تلقائياً من نافذة البيع",
            createdAt: nowTimestamp()
        )
        customers.append(c)
        return newId
    }

    func openReceiptStudio(saleId: Int, items: [ReceiptLineItem], customer: String) {
        let now = Date()
        let dfDate = DateFormatter()
        dfDate.locale = Locale(identifier: "en_GB")
        dfDate.dateFormat = "dd/MM/yyyy"
        let dfTime = DateFormatter()
        dfTime.locale = Locale(identifier: "en_GB")
        dfTime.dateFormat = "HH:mm"
        let year = Calendar.current.component(.year, from: now)

        self.activeReceiptDate = dfDate.string(from: now)
        self.activeReceiptTime = dfTime.string(from: now)
        self.activeReceiptNo = String(format: "GR-%d-%03d", year, saleId)
        self.activeReceiptCustomer = customer.isEmpty ? "Salford Libya" : customer
        self.activeReceiptItems = items.isEmpty ? [
            ReceiptLineItem(name: "خاتم سوليتير ألماس ملكي", color: "ذهبي أبيض", code: "RNG-SFD01", qty: 1, price: 1250)
        ] : items
        self.showGiftReceiptStudio = true
    }

    func deleteSale(_ sale: SaleRecord) {
        if let pIdx = products.firstIndex(where: { $0.id == sale.productId }) {
            products[pIdx].stock += sale.quantity
        }
        sales.removeAll { $0.id == sale.id }
        saveToDisk()
    }

    func addExpense(description: String, amount: Double, monthYear: String) {
        let newId = (expenses.map(\.id).max() ?? 0) + 1
        expenses.insert(
            ExpenseRecord(id: newId, description: description, amount: amount, monthYear: monthYear, expenseDate: nowTimestamp()),
            at: 0
        )
        saveToDisk()
    }

    func deleteExpense(id: Int) {
        expenses.removeAll { $0.id == id }
        saveToDisk()
    }

    func addReturn(product: Product, quantity: Int, reason: String) {
        if let pIdx = products.firstIndex(where: { $0.id == product.id }) {
            products[pIdx].stock += quantity
        }
        let newId = (returns.map(\.id).max() ?? 0) + 1
        returns.insert(
            ReturnRecord(
                id: newId,
                productId: product.id,
                productName: product.name,
                quantity: quantity,
                refundAmount: product.sellPrice * Double(quantity),
                reason: reason.isEmpty ? nil : reason,
                returnDate: nowTimestamp(),
                monthYear: currentMonthYear()
            ),
            at: 0
        )
        saveToDisk()
    }

    // MARK: - Customer Management
    func addOrUpdateCustomer(id: Int = 0, name: String, phone: String, area: String, notes: String) {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        if id > 0, let idx = customers.firstIndex(where: { $0.id == id }) {
            customers[idx].name = trimmed
            customers[idx].phone = phone.isEmpty ? nil : phone
            customers[idx].area = area.isEmpty ? nil : area
            customers[idx].notes = notes.isEmpty ? nil : notes
        } else {
            let newId = (customers.map(\.id).max() ?? 0) + 1
            customers.insert(
                Customer(
                    id: newId,
                    name: trimmed,
                    phone: phone.isEmpty ? nil : phone,
                    area: area.isEmpty ? nil : area,
                    notes: notes.isEmpty ? nil : notes,
                    createdAt: nowTimestamp()
                ),
                at: 0
            )
        }
        saveToDisk()
    }

    func deleteCustomer(id: Int) {
        customers.removeAll { $0.id == id }
        saveToDisk()
    }

    // MARK: - Sets Management
    func addSet(name: String, description: String, discount: Double, items: [SetItem]) {
        let newId = (sets.map(\.id).max() ?? 0) + 1
        sets.insert(
            JewelrySet(
                id: newId,
                name: name,
                description: description.isEmpty ? nil : description,
                discount: discount,
                items: items,
                createdAt: nowTimestamp()
            ),
            at: 0
        )
        saveToDisk()
    }

    func deleteSet(id: Int) {
        sets.removeAll { $0.id == id }
        saveToDisk()
    }

    // MARK: - Quarterly Closing
    func createQuarterlyClosing(quarterKey: String, notes: String) {
        let totalSales = sales.reduce(0.0) { $0 + $1.totalSell }
        let totalCost = sales.reduce(0.0) { $0 + $1.totalCost }
        let totalExpenses = expenses.reduce(0.0) { $0 + $1.amount }
        let totalRefunds = returns.reduce(0.0) { $0 + $1.refundAmount }
        let grossProfit = sales.reduce(0.0) { $0 + $1.profit }
        let netProfit = grossProfit - totalExpenses
        let itemsSold = sales.reduce(0) { $0 + $1.quantity }
        let newId = (closings.map(\.id).max() ?? 0) + 1

        let closing = QuarterlyClosing(
            id: newId,
            quarterKey: quarterKey,
            totalSales: totalSales,
            totalCost: totalCost,
            totalExpenses: totalExpenses,
            totalRefunds: totalRefunds,
            totalProfit: netProfit,
            totalTransactions: sales.count,
            itemsSold: itemsSold,
            notes: notes.isEmpty ? nil : notes,
            closedAt: nowTimestamp()
        )
        closings.insert(closing, at: 0)
        saveToDisk()
    }
}
