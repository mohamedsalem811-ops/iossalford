import Foundation
import SwiftUI
import os

@MainActor
final class POSDataStore: ObservableObject {
    @Published var isAuthenticated: Bool = false
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
    @Published var activeReceiptNo: String = ""
    /// The saved receipt being shown in the studio; nil = a new draft that has no number yet.
    @Published var activeReceiptId: Int? = nil
    @Published var receipts: [IssuedReceipt] = []
    @Published var payments: [CustomerPayment] = []
    /// Brands the shop works with, alphabetical.
    @Published var brands: [String] = []
    private var receiptCounter: Int = 0
    @Published var activeReceiptCustomer: String = "Salford Libya"
    @Published var activeReceiptDate: String = ""
    @Published var activeReceiptTime: String = ""
    @Published var activeReceiptTemplate: ReceiptTemplate = .salfordRoyal
    @Published var showRealPricesInReceipt: Bool = false


    /// Set when loading or saving the database had a problem; shown to the user as an alert.
    @Published var storageAlertMessage: String? = nil

    /// True when an unreadable database could not be copied to safety; saving is then refused
    /// so the original file is never overwritten.
    private var savingBlocked = false

    /// True when the database could not be opened because the phone was still locked
    /// (iOS can start the app in the background before the first unlock). Loading is retried
    /// as soon as the app becomes active; nothing is saved meanwhile.
    private var loadDeferredUntilUnlock = false

    private static let log = Logger(subsystem: "com.salfordjewelry.pos", category: "storage")

    private var documentsURL: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
    }

    /// Which system this store holds (jewelry or scarves). Each has its own database file.
    let line: BusinessLine
    var pinVault: PinVault { line.pinVault }
    var categories: [String] { line.categories }

    private var dbFileURL: URL {
        documentsURL.appendingPathComponent(line.databaseFileName)
    }

    /// Copy of the last database file that was loaded successfully (refreshed on every launch).
    private var lastGoodFileURL: URL {
        documentsURL.appendingPathComponent(line.lastGoodFileName)
    }

    private var recoveryFolderURL: URL {
        documentsURL.appendingPathComponent("Recovery", isDirectory: true)
    }

    init(line: BusinessLine = .jewelry) {
        self.line = line
        loadFromDisk()
        // Jewelry: fresh install gets the default PIN (Face ID is the main way in).
        // Scarves: no default — the user creates the scarves code the first time.
        if line == .jewelry {
            pinVault.bootstrap(legacyPin: nil)
        }
    }

    /// Scarves has no PIN until the user creates one.
    var needsPinSetup: Bool { !pinVault.isConfigured }

    /// Creates this system's PIN the first time. Returns an error message or nil.
    func setupPin(_ pin: String, confirm: String) -> String? {
        let a = PinVault.normalize(pin), b = PinVault.normalize(confirm)
        guard PinVault.isValidFormat(a) else { return "الرمز يجب أن يكون \(PinVault.pinLength) أرقام" }
        guard a == b else { return "الرمزان غير متطابقين — حاول مرة أخرى" }
        guard pinVault.store(pin: a) else { return "تعذر حفظ الرمز في سلسلة المفاتيح الآمنة" }
        objectWillChange.send()
        unlock()
        return nil
    }

    // MARK: - Login / PIN

    enum PinCheckResult: Equatable {
        case success
        case wrong(attemptsLeftBeforeLock: Int)
        case lockedOut(until: Date)
    }

    func verifyPin(_ input: String) -> PinCheckResult {
        if let until = pinVault.lockedUntil {
            return .lockedOut(until: until)
        }
        guard pinVault.verify(input) else {
            pinVault.recordFailure()
            if let until = pinVault.lockedUntil {
                return .lockedOut(until: until)
            }
            return .wrong(attemptsLeftBeforeLock: max(0, PinVault.freeAttempts - pinVault.failedAttempts))
        }
        pinVault.recordSuccess()
        unlock()
        return .success
    }

    /// Called only after LocalAuthentication confirmed the device owner (Face ID / Touch ID).
    func unlockWithBiometrics() {
        pinVault.recordSuccess()
        unlock()
    }

    private func unlock() {
        withAnimation(.easeInOut(duration: 0.25)) {
            isAuthenticated = true
        }
    }

    func lock() {
        isAuthenticated = false
        showGiftReceiptStudio = false
    }

    var isUsingDefaultPin: Bool { pinVault.isUsingDefaultPin }

    enum PinChangeResult: Equatable {
        case success, wrongCurrentPin, invalidNewPin, sameAsDefault, keychainError
    }

    func changePin(current: String, new newPin: String) -> PinChangeResult {
        guard pinVault.verify(current) else { return .wrongCurrentPin }
        let normalized = PinVault.normalize(newPin)
        guard PinVault.isValidFormat(normalized) else { return .invalidNewPin }
        guard normalized != PinVault.defaultPin else { return .sameAsDefault }
        guard pinVault.store(pin: normalized) else { return .keychainError }
        objectWillChange.send() // refresh the "default PIN" warnings
        return .success
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

    /// Encrypts a file with iOS "complete" data protection: unreadable while the phone is locked.
    private func protect(_ url: URL) {
        try? FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: url.path)
    }

    /// Moves photos stored inside the database (Base64, older versions and backups) into their own
    /// files, so the database stays small and fast to save. Returns true if anything was moved.
    @discardableResult
    private func migrateLegacyImages() -> Bool {
        var changed = false
        for i in products.indices {
            guard let b64 = products[i].imageBase64, !b64.isEmpty else { continue }
            let raw = b64.firstIndex(of: ",").map { String(b64[b64.index(after: $0)...]) } ?? b64
            if let data = Data(base64Encoded: raw, options: .ignoreUnknownCharacters),
               let file = ProductImageHelper.storeImageData(data, prefix: line.imagePrefix) {
                products[i].imageFile = file
                products[i].imageBase64 = nil
                changed = true
            }
            // If the photo can't be written it simply stays in the database, as before.
        }
        return changed
    }

    private func apply(_ state: POSDatabaseState) {
        // Older databases carried the PIN in plain text: move it into the Keychain once.
        // If a PIN is already configured this is a no-op, so importing a backup never changes the PIN.
        if line == .jewelry { pinVault.bootstrap(legacyPin: state.pin) }
        self.exchangeRate = state.exchangeRate
        self.products = state.products
        self.customers = state.customers
        self.sets = state.sets
        self.sales = state.sales
        self.returns = state.returns
        self.expenses = state.expenses
        self.closings = state.closings
        self.receipts = state.receipts
        self.payments = state.payments
        // Older files have no brand list: start with the shop's main brands.
        var list = state.brands ?? line.defaultBrands
        for b in state.products.compactMap(\.brand) where !list.contains(where: { $0.caseInsensitiveCompare(b) == .orderedSame }) {
            list.append(b)
        }
        self.brands = list.sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
        // Never hand out a number that already exists, even if the counter was lost.
        self.receiptCounter = max(state.receiptCounter, state.receipts.count)
        imagesNeedSaving = migrateLegacyImages() || imagesNeedSaving
    }

    private var imagesNeedSaving = false

    /// Called when the app becomes active: finishes a load that had to wait for the phone to unlock.
    func retryDeferredLoadIfNeeded() {
        guard loadDeferredUntilUnlock else { return }
        loadDeferredUntilUnlock = false
        savingBlocked = false
        loadFromDisk()
    }

    /// True when the file exists but iOS refuses to open it because the phone is locked.
    private func isLockedByDataProtection(_ url: URL) -> Bool {
        do {
            let handle = try FileHandle(forReadingFrom: url)
            try? handle.close()
            return false
        } catch let error as CocoaError where error.code == .fileReadNoPermission {
            return true
        } catch {
            return false
        }
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
            if line == .jewelry {
                seedDemoData()
            } else {
                // A new system starts empty (no demo pieces).
                apply(POSDatabaseState.empty)
                saveToDisk()
            }
            return
        }

        if isLockedByDataProtection(dbFileURL) {
            // Not damaged — just encrypted while the phone is locked. Wait; never treat it as corrupt.
            loadDeferredUntilUnlock = true
            savingBlocked = true
            Self.log.info("Database locked by data protection; will load after unlock")
            return
        }

        do {
            imagesNeedSaving = false
            let state = try decodeState(from: dbFileURL)
            apply(state)
            if state.pin != nil || imagesNeedSaving {
                // Rewrite immediately so the plain-text PIN / embedded photos leave the file.
                saveToDisk()
                imagesNeedSaving = false
            }
            refreshLastGoodCopy()
            // Delete photo files left behind by cancelled edits or deleted products.
            ProductImageHelper.removeUnusedImages(keeping: Set(products.compactMap(\.imageFile)), prefix: line.imagePrefix)
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
        let name = "unreadable-\(line.rawValue)-db-\(df.string(from: Date())).json"
        do {
            try fm.createDirectory(at: recoveryFolderURL, withIntermediateDirectories: true)
            let dest = recoveryFolderURL.appendingPathComponent(name)
            try fm.copyItem(at: dbFileURL, to: dest)
            protect(dest)
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
            protect(lastGoodFileURL)
        } catch {
            Self.log.error("Failed to refresh last good copy: \(error.localizedDescription, privacy: .public)")
        }
    }

    @discardableResult
    func saveToDisk() -> Bool {
        guard !loadDeferredUntilUnlock else { return false }
        guard !savingBlocked else {
            storageAlertMessage = "الحفظ متوقف لحماية قاعدة البيانات الأصلية. أعد تشغيل التطبيق بعد تحرير مساحة على الجهاز."
            return false
        }
        let state = POSDatabaseState(
            pin: nil,
            exchangeRate: exchangeRate,
            products: products,
            customers: customers,
            sets: sets,
            sales: sales,
            returns: returns,
            expenses: expenses,
            closings: closings,
            receipts: receipts,
            payments: payments,
            receiptCounter: receiptCounter,
            brands: brands
        )
        do {
            let data = try JSONEncoder().encode(state)
            try data.write(to: dbFileURL, options: [.atomic, .completeFileProtection])
            return true
        } catch {
            Self.log.error("Failed to save database: \(error.localizedDescription, privacy: .public)")
            storageAlertMessage = "⚠️ فشل حفظ البيانات على الجهاز: \(error.localizedDescription). تأكد من توفر مساحة تخزين، ولا تغلق التطبيق قبل أخذ نسخة احتياطية."
            return false
        }
    }

    /// Saves, then writes a dated, self-contained backup to a temporary file for sharing:
    /// the database with every product photo embedded, so restoring it brings the photos back.
    /// The live database file itself is never handed to the share sheet.
    func exportBackupJSON() -> URL? {
        guard saveToDisk() else { return nil }
        let df = DateFormatter()
        df.locale = Locale(identifier: "en_US_POSIX")
        df.dateFormat = "yyyy-MM-dd_HHmm"
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("SALFORD_\(line == .jewelry ? "Jewelry" : "Scarves")_Backup_\(df.string(from: Date())).json")

        var backupProducts = products
        for i in backupProducts.indices {
            if let file = backupProducts[i].imageFile,
               let data = try? Data(contentsOf: ProductImageHelper.fileURL(file)) {
                backupProducts[i].imageBase64 = data.base64EncodedString()
            }
            backupProducts[i].imageFile = nil
        }
        let state = POSDatabaseState(
            pin: nil,
            exchangeRate: exchangeRate,
            products: backupProducts,
            customers: customers,
            sets: sets,
            sales: sales,
            returns: returns,
            expenses: expenses,
            closings: closings,
            receipts: receipts,
            payments: payments,
            receiptCounter: receiptCounter,
            brands: brands
        )
        do {
            let data = try JSONEncoder().encode(state)
            try data.write(to: url, options: .atomic)
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

    private static let skuPrefixes = ["خواتم": "RNG", "أساور": "BRC", "قلادات": "NCK", "أقراط": "EAR", "دبابيس": "PIN", "ساعات": "WCH", "أطقم": "SET"]

    func skuInUse(_ sku: String, excludingProductId: Int? = nil) -> Bool {
        let key = sku.trimmingCharacters(in: .whitespaces).uppercased()
        return products.contains { $0.id != excludingProductId && $0.sku.uppercased() == key }
    }

    /// Next free code for the category, e.g. RNG-0007. Sequential and guaranteed unique.
    func generateSKU(for category: String) -> String {
        let prefix = Self.skuPrefixes[category] ?? "PRD"
        let used = products.compactMap { p -> Int? in
            let parts = p.sku.uppercased().split(separator: "-")
            guard parts.count == 2, parts[0] == Substring(prefix) else { return nil }
            return Int(parts[1])
        }
        var n = (used.max() ?? 0) + 1
        var sku = String(format: "%@-%04d", prefix, n)
        while skuInUse(sku) {
            n += 1
            sku = String(format: "%@-%04d", prefix, n)
        }
        return sku
    }

    /// Saves a product. Returns an error message (and saves nothing) if the code belongs to another piece.
    @discardableResult
    func saveProduct(_ input: Product) -> String? {
        var prod = input
        // Use the brand's existing spelling and remember new brands for next time.
        prod.brand = canonicalBrand(prod.brand)
        if let b = prod.brand, !brands.contains(b) {
            brands.append(b)
            brands.sort { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
        }
        let typedSku = prod.sku.trimmingCharacters(in: .whitespaces).uppercased()
        if !typedSku.isEmpty, skuInUse(typedSku, excludingProductId: prod.id) {
            let other = products.first { $0.sku.uppercased() == typedSku && $0.id != prod.id }
            return "الكود \(typedSku) مستخدم للقطعة «\(other?.name ?? "")». اختر كوداً آخر أو اتركه فارغاً ليُولّد تلقائياً."
        }
        if let idx = products.firstIndex(where: { $0.id == prod.id }) {
            var updated = prod
            updated.sku = typedSku
            // An existing piece must never end up without a code (receipts and returns use it).
            if updated.sku.isEmpty {
                updated.sku = products[idx].sku.isEmpty ? generateSKU(for: updated.category) : products[idx].sku
            }
            let oldPhoto = products[idx].imageFile
            products[idx] = updated
            if oldPhoto != updated.imageFile {
                ProductImageHelper.deleteImage(named: oldPhoto) // photo was replaced or removed
            }
        } else {
            var newProd = prod
            newProd.sku = typedSku
            newProd.id = (products.map(\.id).max() ?? 0) + 1
            if newProd.sku.isEmpty {
                newProd.sku = generateSKU(for: newProd.category)
            }
            products.insert(newProd, at: 0)
        }
        saveToDisk()
        return nil
    }

    /// Quick stock correction from the products list (e.g. a new delivery of +3).
    func adjustStock(productId: Int, by delta: Int) {
        guard let idx = products.firstIndex(where: { $0.id == productId }) else { return }
        products[idx].stock = max(0, products[idx].stock + delta)
        saveToDisk()
    }

    /// Deletes a product. Its sales and receipts keep their own copy of the name and price,
    /// so history is not affected. It is also removed from the cart.
    func deleteProduct(id: Int) {
        let photo = products.first { $0.id == id }?.imageFile
        products.removeAll { $0.id == id }
        ProductImageHelper.deleteImage(named: photo)
        cart.removeAll { $0.product.id == id }
        saveToDisk()
    }

    // MARK: - Sales & Multi-Item Cart

    /// Why a sale or cart operation was refused. Nothing is changed when one of these is returned.
    enum SaleProblem: Equatable {
        case emptyCart
        case productMissing(name: String)
        case notEnoughStock(name: String, requested: Int, available: Int)
        case invalidQuantity(name: String)
        case creditNeedsCustomer

        var message: String {
            switch self {
            case .creditNeedsCustomer:
                return "البيع الآجل يحتاج اسم الزبون أو رقم هاتفه لتسجيل الدين عليه"
            case .emptyCart:
                return "السلة فارغة"
            case .productMissing(let name):
                return "القطعة «\(name)» لم تعد موجودة في المخزون (ربما حُذفت)"
            case .notEnoughStock(let name, let requested, let available):
                return "«\(name)»: المطلوب \(requested) والمتوفر \(available) فقط"
            case .invalidQuantity(let name):
                return "«\(name)»: الكمية يجب أن تكون 1 على الأقل"
            }
        }
    }

    /// Total quantity of a product already sitting in the cart.
    func cartQuantity(for productId: Int) -> Int {
        cart.filter { $0.product.id == productId }.reduce(0) { $0 + $1.quantity }
    }

    /// Adds to the cart only if the stock covers what is already in the cart plus this quantity.
    /// The same piece at the same price is merged into one line.
    func addToCart(product: Product, quantity: Int, unitPrice rawUnitPrice: Double) -> SaleProblem? {
        let unitPrice = Money.round(rawUnitPrice)
        guard quantity > 0 else { return .invalidQuantity(name: product.name) }
        guard let current = products.first(where: { $0.id == product.id }) else {
            return .productMissing(name: product.name)
        }
        let alreadyInCart = cartQuantity(for: current.id)
        guard alreadyInCart + quantity <= current.stock else {
            return .notEnoughStock(name: current.name, requested: alreadyInCart + quantity, available: current.stock)
        }
        if let idx = cart.firstIndex(where: { $0.product.id == current.id && $0.unitPrice == unitPrice && $0.bundleGroup == nil }) {
            cart[idx].quantity += quantity
            cart[idx].product = current
        } else {
            cart.append(CartItem(product: current, quantity: quantity, unitPrice: unitPrice))
        }
        return nil
    }

    /// Changes the quantity of a cart line, checking stock across the whole cart.
    /// Bundle lines can't change quantity (the bundle discount is fixed); remove the bundle instead.
    func setCartQuantity(_ itemId: UUID, to quantity: Int) -> SaleProblem? {
        guard let idx = cart.firstIndex(where: { $0.id == itemId }) else { return nil }
        let item = cart[idx]
        guard item.bundleGroup == nil else { return nil }
        guard quantity > 0 else { return .invalidQuantity(name: item.product.name) }
        guard let current = products.first(where: { $0.id == item.product.id }) else {
            return .productMissing(name: item.product.name)
        }
        let others = cartQuantity(for: current.id) - item.quantity
        guard others + quantity <= current.stock else {
            return .notEnoughStock(name: current.name, requested: others + quantity, available: current.stock)
        }
        cart[idx].quantity = quantity
        return nil
    }

    /// Changes the unit price the customer pays for a cart line (e.g. a negotiated price).
    func setCartUnitPrice(_ itemId: UUID, to price: Double) {
        guard let idx = cart.firstIndex(where: { $0.id == itemId }), cart[idx].bundleGroup == nil, price >= 0 else { return }
        cart[idx].unitPrice = Money.round(price)
    }

    var cartTotal: Double { Money.round(cart.reduce(0) { $0 + $1.subtotal }) }
    var cartPieces: Int { cart.reduce(0) { $0 + $1.quantity } }
    var cartProfit: Double { Money.round(cart.reduce(0) { $0 + $1.profit }) }

    /// Checks every cart line against the CURRENT stock (stock may have changed since items were added,
    /// e.g. by a direct sale). Lines for the same product are added together.
    func cartProblems() -> [SaleProblem] {
        guard !cart.isEmpty else { return [.emptyCart] }
        var problems: [SaleProblem] = []
        var checked = Set<Int>()
        for item in cart where !checked.contains(item.product.id) {
            checked.insert(item.product.id)
            guard let current = products.first(where: { $0.id == item.product.id }) else {
                problems.append(.productMissing(name: item.product.name))
                continue
            }
            if cart.contains(where: { $0.product.id == current.id && $0.quantity <= 0 }) {
                problems.append(.invalidQuantity(name: current.name))
                continue
            }
            let requested = cartQuantity(for: current.id)
            if requested > current.stock {
                problems.append(.notEnoughStock(name: current.name, requested: requested, available: current.stock))
            }
        }
        return problems
    }

    private func nextSaleId() -> Int {
        (sales.map(\.id).max() ?? 0) + 1
    }

    private func makeSaleRecord(
        id: Int,
        product: Product,
        quantity: Int,
        unitPrice: Double,
        rate: Double,
        paymentMethod: String,
        customerId: Int?,
        customerName: String,
        note: String?,
        timestamp: String,
        monthYear: String,
        setId: Int? = nil
    ) -> SaleRecord {
        let totalSell = Money.round(unitPrice * Double(quantity))
        let totalCost = Money.round(product.costPrice * Double(quantity))
        let profit = Money.round(totalSell - totalCost)
        return SaleRecord(
            id: id,
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            color: product.color,
            quantity: quantity,
            costPrice: product.costPrice,
            sellPrice: product.sellPrice,
            actualPrice: unitPrice,
            totalSell: totalSell,
            totalCost: totalCost,
            profit: profit,
            saleRate: rate,
            totalSellUSD: totalSell / rate,
            totalCostUSD: totalCost / rate,
            profitUSD: profit / rate,
            paymentMethod: paymentMethod,
            customerId: customerId,
            customerName: customerName.isEmpty ? nil : customerName,
            setId: setId,
            note: note,
            saleDate: timestamp,
            monthYear: monthYear,
            brand: product.brand
        )
    }

    private func effectiveRate(_ saleRate: Double) -> Double {
        saleRate > 0 ? saleRate : (exchangeRate > 0 ? exchangeRate : 7.0)
    }

    /// Sells one product immediately. Returns a problem (and changes nothing) if it cannot be sold.
    @discardableResult
    func recordSingleSale(
        product: Product,
        quantity: Int,
        actualPrice rawActualPrice: Double,
        saleRate: Double,
        paymentMethod: String,
        customerName: String,
        customerPhone: String,
        customerArea: String,
        note: String
    ) -> SaleProblem? {
        let actualPrice = Money.round(rawActualPrice)
        guard quantity > 0 else { return .invalidQuantity(name: product.name) }
        if Self.isCredit(paymentMethod), !hasCustomerIdentity(name: customerName, phone: customerPhone) {
            return .creditNeedsCustomer
        }
        guard let idx = products.firstIndex(where: { $0.id == product.id }) else {
            return .productMissing(name: product.name)
        }
        let current = products[idx]
        guard current.stock >= quantity else {
            return .notEnoughStock(name: current.name, requested: quantity, available: current.stock)
        }

        products[idx].stock -= quantity
        let custId = ensureCustomer(name: customerName, phone: customerPhone, area: customerArea)
        let newId = nextSaleId()
        let rec = makeSaleRecord(
            id: newId,
            product: current,
            quantity: quantity,
            unitPrice: actualPrice,
            rate: effectiveRate(saleRate),
            paymentMethod: paymentMethod,
            customerId: custId,
            customerName: customerName,
            note: note.isEmpty ? nil : note,
            timestamp: nowTimestamp(),
            monthYear: currentMonthYear()
        )
        sales.insert(rec, at: 0)
        saveToDisk()

        // Save the receipt for this sale and open it in the studio
        issueSaleReceipt(
            saleIds: [newId],
            items: [
                ReceiptLineItem(
                    name: current.name,
                    color: current.color ?? "",
                    code: current.sku,
                    qty: quantity,
                    price: actualPrice,
                    brand: current.brand
                )
            ],
            customer: customerName
        )
        return nil
    }

    /// Sells the whole cart, all-or-nothing: if ANY line cannot be sold, nothing is sold,
    /// stock is untouched and the cart is kept so the cashier can fix it.
    /// Returns the list of problems (empty on success).
    @discardableResult
    func checkoutCart(
        saleRate: Double,
        paymentMethod: String,
        customerName: String,
        customerPhone: String,
        customerArea: String,
        note: String
    ) -> [SaleProblem] {
        if Self.isCredit(paymentMethod), !hasCustomerIdentity(name: customerName, phone: customerPhone) {
            return [.creditNeedsCustomer]
        }
        let problems = cartProblems()
        guard problems.isEmpty else { return problems }

        let custId = ensureCustomer(name: customerName, phone: customerPhone, area: customerArea)
        let rate = effectiveRate(saleRate)
        let timestamp = nowTimestamp()
        let monthYear = currentMonthYear()
        let lineNote = note.isEmpty ? "سلة مبيعات موحدة" : "\(note) (سلة موحدة)"
        var soldIds: [Int] = []
        var receiptLines: [ReceiptLineItem] = []

        for item in cart {
            // Validated above, so the product exists and has enough stock.
            guard let pIdx = products.firstIndex(where: { $0.id == item.product.id }) else { continue }
            let current = products[pIdx]
            products[pIdx].stock -= item.quantity

            let rec = makeSaleRecord(
                id: nextSaleId(),
                product: current,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                rate: rate,
                paymentMethod: paymentMethod,
                customerId: custId,
                customerName: customerName,
                note: item.setName.map { "\(lineNote) — طقم: \($0)" } ?? lineNote,
                timestamp: timestamp,
                monthYear: monthYear,
                setId: item.setId
            )
            sales.insert(rec, at: 0)
            soldIds.append(rec.id)
            receiptLines.append(
                ReceiptLineItem(
                    name: current.name,
                    color: current.color ?? "",
                    code: current.sku,
                    qty: item.quantity,
                    price: item.unitPrice,
                    brand: current.brand
                )
            )
        }

        cart.removeAll()
        saveToDisk()

        issueSaleReceipt(saleIds: soldIds, items: receiptLines, customer: customerName)
        return []
    }

    // MARK: - Customer matching

    /// Phone number reduced to its national digits so "0912345678", "+218912345678" and
    /// "00218 91 234 5678" are recognised as the same number.
    static func phoneKey(_ phone: String?) -> String? {
        guard let phone else { return nil }
        var digits = NumberInput.sanitize(phone, kind: .integer)
        if digits.hasPrefix("00218") { digits.removeFirst(5) }
        else if digits.hasPrefix("218") && digits.count > 9 { digits.removeFirst(3) }
        while digits.hasPrefix("0") { digits.removeFirst() }
        return digits.count >= 6 ? digits : nil
    }

    /// Name compared without case or extra spaces.
    static func nameKey(_ name: String) -> String {
        name.lowercased().split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }

    func customer(withPhone phone: String) -> Customer? {
        guard let key = Self.phoneKey(phone) else { return nil }
        return customers.first { Self.phoneKey($0.phone) == key }
    }

    /// Customers whose name or phone contains the text (for suggestions while typing).
    func customerSuggestions(for text: String, limit: Int = 4) -> [Customer] {
        let q = Self.nameKey(NumberInput.latinDigits(text))
        guard q.count >= 2 else { return [] }
        let qDigits = NumberInput.sanitize(q, kind: .integer)
        return customers.filter { c in
            Self.nameKey(c.name).contains(q)
                || (qDigits.count >= 3 && (c.phone.map { NumberInput.sanitize($0, kind: .integer).contains(qDigits) } ?? false))
        }
        .prefix(limit)
        .map { $0 }
    }

    /// Finds the customer for a sale, or creates one.
    /// The phone number decides first; the name is only used when there is no conflicting phone,
    /// so two different customers with the same name are no longer merged.
    private func ensureCustomer(name: String, phone: String, area: String) -> Int? {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedArea = area.trimmingCharacters(in: .whitespacesAndNewlines)
        let phoneKey = Self.phoneKey(phone)
        guard !trimmed.isEmpty || phoneKey != nil else { return nil }

        func fillMissing(_ idx: Int) -> Int {
            if customers[idx].phone == nil, phoneKey != nil { customers[idx].phone = phone }
            if customers[idx].area == nil, !trimmedArea.isEmpty { customers[idx].area = trimmedArea }
            return customers[idx].id
        }

        // 1. Same phone number = same customer.
        if let key = phoneKey, let idx = customers.firstIndex(where: { Self.phoneKey($0.phone) == key }) {
            return fillMissing(idx)
        }

        // 2. Same name, and that customer has no different phone on file.
        if !trimmed.isEmpty {
            let nameKey = Self.nameKey(trimmed)
            let sameName = customers.indices.filter { Self.nameKey(customers[$0].name) == nameKey }
            let compatible = sameName.filter { customers[$0].phone == nil || phoneKey == nil }
            if let idx = compatible.last {
                return fillMissing(idx)
            }
        }

        // 3. New customer.
        let newId = (customers.map(\.id).max() ?? 0) + 1
        customers.append(Customer(
            id: newId,
            name: trimmed.isEmpty ? "زبون \(phone)" : trimmed,
            phone: phoneKey == nil ? nil : phone,
            area: trimmedArea.isEmpty ? nil : trimmedArea,
            notes: "تمت الإضافة تلقائياً من نافذة البيع",
            createdAt: nowTimestamp()
        ))
        return newId
    }

    // MARK: - Receipts

    static let defaultReceiptCustomer = "Salford Libya"

    private func receiptDateTime(_ date: Date = Date()) -> (date: String, time: String) {
        let dfDate = DateFormatter()
        dfDate.locale = Locale(identifier: "en_GB")
        dfDate.dateFormat = "dd/MM/yyyy"
        let dfTime = DateFormatter()
        dfTime.locale = Locale(identifier: "en_GB")
        dfTime.dateFormat = "HH:mm"
        return (dfDate.string(from: date), dfTime.string(from: date))
    }

    /// Next receipt number, e.g. GR-2026-0007. Numbers only go up and are never reused.
    private func takeNextReceiptNo() -> String {
        receiptCounter += 1
        let year = Calendar(identifier: .gregorian).component(.year, from: Date())
        var no = String(format: "%@-%d-%04d", line.receiptPrefix, year, receiptCounter)
        while receipts.contains(where: { $0.receiptNo == no }) {
            receiptCounter += 1
            no = String(format: "%@-%d-%04d", line.receiptPrefix, year, receiptCounter)
        }
        return no
    }

    private func loadIntoStudio(_ r: IssuedReceipt) {
        activeReceiptId = r.id
        activeReceiptNo = r.receiptNo
        activeReceiptDate = r.date
        activeReceiptTime = r.time
        activeReceiptCustomer = r.customer
        activeReceiptItems = r.items
        activeReceiptTemplate = r.template
        showRealPricesInReceipt = r.showRealPrices
    }

    /// Called right after a sale: the receipt is saved immediately with its own number.
    private func issueSaleReceipt(saleIds: [Int], items: [ReceiptLineItem], customer: String) {
        let dt = receiptDateTime()
        let r = IssuedReceipt(
            id: (receipts.map(\.id).max() ?? 0) + 1,
            receiptNo: takeNextReceiptNo(),
            date: dt.date,
            time: dt.time,
            customer: customer.isEmpty ? Self.defaultReceiptCustomer : customer,
            items: items,
            template: activeReceiptTemplate,
            showRealPrices: showRealPricesInReceipt,
            saleIds: saleIds,
            createdAt: nowTimestamp(),
            updatedAt: nil
        )
        receipts.insert(r, at: 0)
        saveToDisk()
        loadIntoStudio(r)
        showGiftReceiptStudio = true
    }

    /// Opens a saved receipt for viewing / reprinting.
    func openReceipt(_ r: IssuedReceipt) {
        loadIntoStudio(r)
        showGiftReceiptStudio = true
    }

    /// Opens the receipt of a sale. Sales made before receipts were saved get one created now.
    func openReceiptForSale(_ sale: SaleRecord) {
        if let existing = receipts.first(where: { $0.saleIds.contains(sale.id) }) {
            openReceipt(existing)
            return
        }
        issueSaleReceipt(
            saleIds: [sale.id],
            items: [ReceiptLineItem(name: sale.productName, color: sale.color ?? "", code: sale.sku ?? "", qty: sale.quantity, price: sale.actualPrice, brand: sale.brand)],
            customer: sale.customerName ?? ""
        )
    }

    /// Starts a new, unsaved receipt (e.g. a gift receipt for a piece). It gets a number
    /// only when it is saved, printed or shared — never a made-up or reused one.
    func openNewDraftReceipt(items: [ReceiptLineItem], customer: String = "", present: Bool = true) {
        let dt = receiptDateTime()
        activeReceiptId = nil
        activeReceiptNo = ""
        activeReceiptDate = dt.date
        activeReceiptTime = dt.time
        activeReceiptCustomer = customer.isEmpty ? Self.defaultReceiptCustomer : customer
        activeReceiptItems = items
        if present { showGiftReceiptStudio = true }
    }

    /// Saves what is in the studio: a draft becomes a new numbered receipt, an existing one is updated.
    /// Returns the receipt number, or nil if there is nothing to save.
    @discardableResult
    func commitActiveReceipt() -> String? {
        let items = activeReceiptItems.filter { !$0.name.trimmingCharacters(in: .whitespaces).isEmpty }
        guard !items.isEmpty else { return nil }
        let customer = activeReceiptCustomer.trimmingCharacters(in: .whitespaces)

        if let id = activeReceiptId, let idx = receipts.firstIndex(where: { $0.id == id }) {
            receipts[idx].customer = customer.isEmpty ? Self.defaultReceiptCustomer : customer
            receipts[idx].items = items
            receipts[idx].template = activeReceiptTemplate
            receipts[idx].showRealPrices = showRealPricesInReceipt
            receipts[idx].updatedAt = nowTimestamp()
            saveToDisk()
            loadIntoStudio(receipts[idx])
            return receipts[idx].receiptNo
        }

        let r = IssuedReceipt(
            id: (receipts.map(\.id).max() ?? 0) + 1,
            receiptNo: takeNextReceiptNo(),
            date: activeReceiptDate.isEmpty ? receiptDateTime().date : activeReceiptDate,
            time: activeReceiptTime.isEmpty ? receiptDateTime().time : activeReceiptTime,
            customer: customer.isEmpty ? Self.defaultReceiptCustomer : customer,
            items: items,
            template: activeReceiptTemplate,
            showRealPrices: showRealPricesInReceipt,
            saleIds: [],
            createdAt: nowTimestamp(),
            updatedAt: nil
        )
        receipts.insert(r, at: 0)
        saveToDisk()
        loadIntoStudio(r)
        return r.receiptNo
    }

    /// Deletes a sale (e.g. entered by mistake). Its returns are deleted with it, and only the pieces
    /// that had not already come back through a return are put back into stock.
    func deleteSale(_ sale: SaleRecord) {
        let alreadyReturned = returnedQuantity(forSale: sale.id)
        if let pIdx = products.firstIndex(where: { $0.id == sale.productId }) {
            products[pIdx].stock += max(0, sale.quantity - alreadyReturned)
        }
        returns.removeAll { $0.saleId == sale.id }
        sales.removeAll { $0.id == sale.id }
        saveToDisk()
    }

    func addExpense(description: String, amount: Double, monthYear: String) {
        let newId = (expenses.map(\.id).max() ?? 0) + 1
        expenses.insert(
            ExpenseRecord(id: newId, description: description, amount: Money.round(amount), monthYear: monthYear, expenseDate: nowTimestamp()),
            at: 0
        )
        saveToDisk()
    }

    func deleteExpense(id: Int) {
        expenses.removeAll { $0.id == id }
        saveToDisk()
    }

    // MARK: - Returns

    func returnedQuantity(forSale saleId: Int) -> Int {
        returns.filter { $0.saleId == saleId }.reduce(0) { $0 + $1.quantity }
    }

    func returnableQuantity(for sale: SaleRecord) -> Int {
        max(0, sale.quantity - returnedQuantity(forSale: sale.id))
    }

    /// Records a return against the sale it came from: the refund defaults to what the customer
    /// actually paid, and the cost comes from the sale, so profit reports stay exact.
    /// Returns an error message, or nil on success.
    func addReturn(for sale: SaleRecord, quantity: Int, refundAmount: Double?, reason: String) -> String? {
        let returnable = returnableQuantity(for: sale)
        guard quantity > 0 else { return "الكمية يجب أن تكون 1 على الأقل" }
        guard quantity <= returnable else {
            return returnable == 0
                ? "كل قطع هذه البيعة مُرتجعة بالفعل"
                : "يمكن إرجاع \(returnable) قطعة فقط من هذه البيعة"
        }
        let maxRefund = Money.round(sale.actualPrice * Double(quantity))
        let refund = Money.round(refundAmount ?? maxRefund)
        guard refund >= 0 else { return "مبلغ الاسترداد غير صحيح" }
        guard refund <= maxRefund + 0.001 else {
            return String(format: "لا يمكن أن يتجاوز الاسترداد ما دفعه الزبون (%@ د.ل)", Money.plain(maxRefund))
        }

        if let pIdx = products.firstIndex(where: { $0.id == sale.productId }) {
            products[pIdx].stock += quantity
        }
        returns.insert(
            ReturnRecord(
                id: (returns.map(\.id).max() ?? 0) + 1,
                productId: sale.productId,
                productName: sale.productName,
                quantity: quantity,
                refundAmount: refund,
                costAmount: Money.round(sale.costPrice * Double(quantity)),
                saleId: sale.id,
                reason: reason.isEmpty ? nil : reason,
                returnDate: nowTimestamp(),
                monthYear: currentMonthYear()
            ),
            at: 0
        )
        saveToDisk()
        return nil
    }

    /// Return of a piece sold before it was recorded in the app (no invoice to link to).
    /// The refund must be entered; cost is taken from the product.
    func addReturnWithoutSale(product: Product, quantity: Int, refundAmount: Double, reason: String) -> String? {
        guard quantity > 0 else { return "الكمية يجب أن تكون 1 على الأقل" }
        guard refundAmount >= 0 else { return "مبلغ الاسترداد غير صحيح" }
        guard let pIdx = products.firstIndex(where: { $0.id == product.id }) else {
            return "القطعة غير موجودة في المخزون"
        }
        let current = products[pIdx]
        products[pIdx].stock += quantity
        returns.insert(
            ReturnRecord(
                id: (returns.map(\.id).max() ?? 0) + 1,
                productId: current.id,
                productName: current.name,
                quantity: quantity,
                refundAmount: Money.round(refundAmount),
                costAmount: Money.round(current.costPrice * Double(quantity)),
                saleId: nil,
                reason: reason.isEmpty ? "مرتجع بدون فاتورة" : reason,
                returnDate: nowTimestamp(),
                monthYear: currentMonthYear()
            ),
            at: 0
        )
        saveToDisk()
        return nil
    }

    /// Undoes a return recorded by mistake: the pieces leave stock again.
    /// Refused if those pieces are no longer in stock (they were sold again).
    func deleteReturn(_ ret: ReturnRecord) -> String? {
        if let pIdx = products.firstIndex(where: { $0.id == ret.productId }) {
            guard products[pIdx].stock >= ret.quantity else {
                return "لا يمكن إلغاء المرتجع: القطع المرتجعة لم تعد في المخزون (ربما بيعت مرة أخرى)"
            }
            products[pIdx].stock -= ret.quantity
        }
        returns.removeAll { $0.id == ret.id }
        saveToDisk()
        return nil
    }

    // MARK: - Customer Management
    /// Adds or edits a customer. Returns an error message (and changes nothing) if the phone
    /// number already belongs to another customer.
    @discardableResult
    func addOrUpdateCustomer(id: Int = 0, name: String, phone: String, area: String, notes: String) -> String? {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "يرجى إدخال اسم الزبون" }
        if let key = Self.phoneKey(phone),
           let other = customers.first(where: { Self.phoneKey($0.phone) == key && $0.id != id }) {
            return "رقم الهاتف مسجل مسبقاً للزبون «\(other.name)»"
        }
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
        return nil
    }

    func deleteCustomer(id: Int) {
        customers.removeAll { $0.id == id }
        saveToDisk()
    }

    // MARK: - Credit sales (آجل) and payments

    static let creditMethod = "آجل"

    static func isCredit(_ method: String) -> Bool { method == creditMethod }

    private func hasCustomerIdentity(name: String, phone: String) -> Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || Self.phoneKey(phone) != nil
    }

    /// Credit sales of a customer, newest first.
    func creditSales(for customerId: Int) -> [SaleRecord] {
        sales.filter { $0.customerId == customerId && Self.isCredit($0.paymentMethod) }
    }

    func payments(for customerId: Int) -> [CustomerPayment] {
        payments.filter { $0.customerId == customerId }
    }

    /// What the customer still owes: credit sales, minus refunds on returns of those sales,
    /// minus payments received.
    func balance(for customerId: Int) -> Double {
        let credit = creditSales(for: customerId)
        let creditIds = Set(credit.map(\.id))
        let owed = credit.reduce(0) { $0 + $1.totalSell }
        let returned = returns.filter { $0.saleId.map(creditIds.contains) ?? false }.reduce(0) { $0 + $1.refundAmount }
        let paid = payments(for: customerId).reduce(0) { $0 + $1.amount }
        let value = Money.round(owed - returned - paid)
        return abs(value) < 0.0005 ? 0 : value
    }

    struct Debtor: Identifiable {
        let customer: Customer
        let balance: Double
        var id: Int { customer.id }
    }

    /// Customers who owe money, largest balance first.
    var debtors: [Debtor] {
        customers.map { Debtor(customer: $0, balance: balance(for: $0.id)) }
            .filter { $0.balance > 0 }
            .sorted { $0.balance > $1.balance }
    }

    var totalOutstanding: Double { debtors.reduce(0) { $0 + $1.balance } }

    /// Credit sales recorded without a customer (older versions allowed it): cannot be collected per customer.
    var unassignedCreditTotal: Double {
        sales.filter { Self.isCredit($0.paymentMethod) && $0.customerId == nil }.reduce(0) { $0 + $1.totalSell }
    }

    /// Records money received from a customer. Returns an error message, or nil on success.
    func recordPayment(customerId: Int, amount rawAmount: Double, method: String, note: String) -> String? {
        let amount = Money.round(rawAmount)
        guard customers.contains(where: { $0.id == customerId }) else { return "الزبون غير موجود" }
        guard amount > 0 else { return "يرجى إدخال مبلغ الدفعة" }
        let owed = balance(for: customerId)
        guard amount <= owed + 0.0005 else {
            return String(format: "المبلغ أكبر من المستحق على الزبون (%@ د.ل)", Money.plain(owed))
        }
        payments.insert(
            CustomerPayment(
                id: (payments.map(\.id).max() ?? 0) + 1,
                customerId: customerId,
                amount: amount,
                method: method,
                note: note.isEmpty ? nil : note,
                paymentDate: nowTimestamp(),
                monthYear: currentMonthYear()
            ),
            at: 0
        )
        saveToDisk()
        return nil
    }

    func deletePayment(_ payment: CustomerPayment) {
        payments.removeAll { $0.id == payment.id }
        saveToDisk()
    }

    // MARK: - Brands

    static let noBrandLabel = "بدون ماركة"

    /// Trims the typed name and reuses the existing spelling ("pandora" -> "Pandora"). nil if empty.
    func canonicalBrand(_ raw: String?) -> String? {
        guard let t = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !t.isEmpty else { return nil }
        return brands.first { $0.caseInsensitiveCompare(t) == .orderedSame } ?? t
    }

    /// Adds a brand to the list (no duplicates, kept alphabetical). Returns its canonical name.
    @discardableResult
    func addBrand(_ raw: String) -> String? {
        guard let name = canonicalBrand(raw) else { return nil }
        if !brands.contains(name) {
            brands.append(name)
            brands.sort { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
            saveToDisk()
        }
        return name
    }

    /// Renames a brand everywhere it is used on products. Returns an error message or nil.
    func renameBrand(_ old: String, to raw: String) -> String? {
        let new = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !new.isEmpty else { return "اكتب اسم الماركة" }
        if new.caseInsensitiveCompare(old) != .orderedSame,
           brands.contains(where: { $0.caseInsensitiveCompare(new) == .orderedSame }) {
            return "الماركة «\(new)» موجودة بالفعل"
        }
        brands = brands.map { $0 == old ? new : $0 }
            .sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
        for i in products.indices where products[i].brand == old { products[i].brand = new }
        saveToDisk()
        return nil
    }

    /// Removes a brand from the list; pieces that had it become "no brand". Past sales keep their name.
    func deleteBrand(_ name: String) {
        brands.removeAll { $0 == name }
        for i in products.indices where products[i].brand == name { products[i].brand = nil }
        saveToDisk()
    }

    func productCount(forBrand name: String) -> Int {
        products.filter { $0.brand == name }.count
    }

    /// Brands that currently have pieces, alphabetical (for filter buttons).
    var brandsInUse: [String] {
        brands.filter { b in products.contains { $0.brand == b } }
    }

    // MARK: - Sets (bundles)

    /// Sum of the current sell prices of the bundle's pieces.
    func listPrice(of set: JewelrySet) -> Double {
        set.items.reduce(0) { total, item in
            total + (products.first { $0.id == item.productId }?.sellPrice ?? 0) * Double(item.quantity)
        }
    }

    /// What the customer pays for the bundle.
    func bundlePrice(of set: JewelrySet) -> Double {
        max(0, listPrice(of: set) - set.discount)
    }

    /// How many complete bundles can still be sold with the current stock (minus what is in the cart).
    func availableBundles(_ set: JewelrySet) -> Int {
        guard !set.items.isEmpty else { return 0 }
        var result = Int.max
        for item in set.items where item.quantity > 0 {
            guard let p = products.first(where: { $0.id == item.productId }) else { return 0 }
            let free = p.stock - cartQuantity(for: p.id)
            result = min(result, max(0, free) / item.quantity)
        }
        return result == Int.max ? 0 : result
    }

    /// Adds one complete bundle to the cart. The discount is spread over the pieces in proportion
    /// to their prices, so every sale line (and the receipt) carries the real price paid.
    func addSetToCart(_ set: JewelrySet) -> SaleProblem? {
        let lines = set.items.filter { $0.quantity > 0 }
        guard !lines.isEmpty else { return .emptyCart }
        var pieces: [(Product, Int)] = []
        for item in lines {
            guard let p = products.first(where: { $0.id == item.productId }) else {
                return .productMissing(name: "قطعة من طقم «\(set.name)»")
            }
            let requested = cartQuantity(for: p.id) + item.quantity
            guard requested <= p.stock else {
                return .notEnoughStock(name: p.name, requested: requested, available: p.stock)
            }
            pieces.append((p, item.quantity))
        }
        let lineLists = pieces.map { $0.0.sellPrice * Double($0.1) }
        let list = lineLists.reduce(0, +)
        let discount = min(max(0, set.discount), list)
        // Line totals rounded to the dirham that add up to exactly the bundle price.
        let lineTotals = Money.split(list - discount, weights: lineLists)
        let group = UUID()
        for (i, (p, qty)) in pieces.enumerated() {
            // Unit price to the dirham; a line of several pieces may differ by a fraction of a dirham.
            let unit = Money.round(lineTotals[i] / Double(qty))
            cart.append(CartItem(product: p, quantity: qty, unitPrice: unit, setId: set.id, setName: set.name, bundleGroup: group))
        }
        return nil
    }

    /// Removes a cart line; a line that belongs to a bundle removes the whole bundle
    /// (selling part of a bundle at the bundle discount would be wrong).
    func removeFromCart(_ item: CartItem) {
        if let group = item.bundleGroup {
            cart.removeAll { $0.bundleGroup == group }
        } else {
            cart.removeAll { $0.id == item.id }
        }
    }

    /// Creates or updates a bundle. Returns an error message, or nil on success.
    @discardableResult
    func saveSet(id: Int? = nil, name: String, description: String, discount rawDiscount: Double, items: [SetItem]) -> String? {
        let discount = Money.round(rawDiscount)
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "يرجى إدخال اسم الطقم" }
        let cleanItems = items.filter { $0.quantity > 0 }
        guard !cleanItems.isEmpty else { return "اختر قطعة واحدة على الأقل للطقم" }
        let draft = JewelrySet(id: id ?? 0, name: trimmed, description: nil, discount: discount, items: cleanItems, createdAt: "")
        let list = listPrice(of: draft)
        guard discount >= 0, discount < list else {
            return String(format: "الخصم يجب أن يكون أقل من مجموع أسعار القطع (%@ د.ل)", Money.plain(list))
        }
        if let id, let idx = sets.firstIndex(where: { $0.id == id }) {
            sets[idx].name = trimmed
            sets[idx].description = description.isEmpty ? nil : description
            sets[idx].discount = discount
            sets[idx].items = cleanItems
        } else {
            sets.insert(
                JewelrySet(
                    id: (sets.map(\.id).max() ?? 0) + 1,
                    name: trimmed,
                    description: description.isEmpty ? nil : description,
                    discount: discount,
                    items: cleanItems,
                    createdAt: nowTimestamp()
                ),
                at: 0
            )
        }
        saveToDisk()
        return nil
    }

    func deleteSet(id: Int) {
        sets.removeAll { $0.id == id }
        saveToDisk()
    }

    // MARK: - Reports

    func summary(forMonths months: Set<String>) -> PeriodSummary {
        var r = PeriodSummary()
        for sale in sales where months.contains(sale.monthYear) {
            r.grossSales += sale.totalSell
            r.costOfSales += sale.totalCost
            r.grossProfit += sale.profit
            r.transactions += 1
            r.itemsSold += sale.quantity
        }
        for ret in returns where months.contains(ret.monthYear) {
            r.refunds += ret.refundAmount
            r.itemsReturned += ret.quantity
            if let cost = ret.costAmount {
                r.returnedCost += cost
            } else if let product = products.first(where: { $0.id == ret.productId }) {
                // Older return without a stored cost: estimate with the product's current cost.
                r.returnedCost += product.costPrice * Double(ret.quantity)
            }
            // Product deleted and no stored cost: treat the whole refund as lost profit (conservative).
        }
        for exp in expenses where months.contains(exp.monthYear) {
            r.expenses += exp.amount
        }
        return r
    }

    func summary(forMonth month: String) -> PeriodSummary {
        summary(forMonths: [month])
    }

    func summary(for period: QuarterPeriod) -> PeriodSummary {
        summary(forMonths: Set(period.monthKeys))
    }

    // MARK: - Quarterly Closing

    func existingClosing(for period: QuarterPeriod) -> QuarterlyClosing? {
        closings.first { $0.periodKey == period.key }
    }

    /// Closes one calendar quarter using ONLY that quarter's sales, returns and expenses.
    /// If the quarter was already closed, the old closing is replaced.
    func createQuarterlyClosing(period: QuarterPeriod, notes: String) {
        let sum = summary(for: period)
        let id: Int
        if let existing = existingClosing(for: period) {
            id = existing.id
            closings.removeAll { $0.id == existing.id }
        } else {
            id = (closings.map(\.id).max() ?? 0) + 1
        }

        let closing = QuarterlyClosing(
            id: id,
            quarterKey: period.title,
            periodKey: period.key,
            totalSales: sum.grossSales,
            totalCost: sum.costOfSales,
            totalExpenses: sum.expenses,
            totalRefunds: sum.refunds,
            totalProfit: sum.netProfit,
            totalTransactions: sum.transactions,
            itemsSold: sum.itemsSold,
            notes: notes.isEmpty ? nil : notes,
            closedAt: nowTimestamp()
        )
        closings.insert(closing, at: 0)
        closings.sort { ($0.periodKey ?? "") > ($1.periodKey ?? "") }
        saveToDisk()
    }

    func deleteClosing(id: Int) {
        closings.removeAll { $0.id == id }
        saveToDisk()
    }
}

