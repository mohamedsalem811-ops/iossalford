import Foundation
import Security
import CryptoKit

/// Stores a login PIN in the iOS Keychain as a salted SHA-256 hash.
/// The PIN itself is never written anywhere: not to the database JSON, not to backups.
/// Also tracks failed attempts and applies an escalating lockout.
///
/// Each system has its own vault: `.jewelry` keeps the original Keychain item and settings keys
/// (so the existing PIN keeps working), `.scarves` is a separate PIN.
struct PinVault {
    static let defaultPin = "01020304"
    static let pinLength = 8
    /// Free attempts before the first lockout.
    static let freeAttempts = 5

    static let jewelry = PinVault(service: "com.salfordjewelry.pos.pin", keyPrefix: "pin")
    static let scarves = PinVault(service: "com.salfordjewelry.pos.scarves.pin", keyPrefix: "scarvesPin")

    let service: String
    let keyPrefix: String

    private let hashAccount = "pinHash"
    private let saltAccount = "pinSalt"
    private var failedAttemptsKey: String { "\(keyPrefix).failedAttempts" }
    private var lockedUntilKey: String { "\(keyPrefix).lockedUntil" }
    private var usingDefaultKey: String { "\(keyPrefix).usingDefault" }

    // MARK: - Helpers shared by every vault

    /// Converts Arabic-Indic (٠-٩) and Persian (۰-۹) digits to ASCII and drops anything else,
    /// so a PIN typed on an Arabic keyboard matches the same PIN typed in Latin digits.
    static func normalize(_ input: String) -> String {
        String(input.compactMap { ch -> Character? in
            guard let scalar = ch.unicodeScalars.first, ch.unicodeScalars.count == 1 else { return nil }
            switch scalar.value {
            case 0x30...0x39: return ch
            case 0x660...0x669: return Character(UnicodeScalar(scalar.value - 0x660 + 0x30)!)
            case 0x6F0...0x6F9: return Character(UnicodeScalar(scalar.value - 0x6F0 + 0x30)!)
            default: return nil
            }
        })
    }

    static func isValidFormat(_ pin: String) -> Bool {
        pin.count == pinLength && pin.allSatisfy { $0.isASCII && $0.isNumber }
    }

    // MARK: - Setup

    var isConfigured: Bool {
        readData(account: hashAccount) != nil && readData(account: saltAccount) != nil
    }

    /// Migrates a PIN found in an older database file, or installs the default PIN.
    /// Only used for the jewelry system; scarves asks the user to create its PIN instead.
    func bootstrap(legacyPin: String?) {
        guard !isConfigured else { return }
        if let legacy = legacyPin.map(Self.normalize), Self.isValidFormat(legacy) {
            _ = store(pin: legacy)
        } else {
            _ = store(pin: Self.defaultPin)
        }
    }

    /// True while this system still uses the published default PIN.
    var isUsingDefaultPin: Bool {
        UserDefaults.standard.bool(forKey: usingDefaultKey)
    }

    // MARK: - Verify / change

    func verify(_ pin: String) -> Bool {
        guard let salt = readData(account: saltAccount),
              let stored = readData(account: hashAccount) else { return false }
        let candidate = hash(Self.normalize(pin), salt: salt)
        // Constant-time comparison.
        guard candidate.count == stored.count else { return false }
        var diff: UInt8 = 0
        for (a, b) in zip(candidate, stored) { diff |= a ^ b }
        return diff == 0
    }

    @discardableResult
    func store(pin rawPin: String) -> Bool {
        let pin = Self.normalize(rawPin)
        guard Self.isValidFormat(pin) else { return false }
        var salt = Data(count: 16)
        let status = salt.withUnsafeMutableBytes { SecRandomCopyBytes(kSecRandomDefault, 16, $0.baseAddress!) }
        guard status == errSecSuccess else { return false }
        guard writeData(salt, account: saltAccount),
              writeData(hash(pin, salt: salt), account: hashAccount) else { return false }
        UserDefaults.standard.set(pin == Self.defaultPin, forKey: usingDefaultKey)
        return true
    }

    // MARK: - Lockout

    var failedAttempts: Int {
        UserDefaults.standard.integer(forKey: failedAttemptsKey)
    }

    var lockedUntil: Date? {
        let t = UserDefaults.standard.double(forKey: lockedUntilKey)
        guard t > 0 else { return nil }
        let date = Date(timeIntervalSince1970: t)
        return date > Date() ? date : nil
    }

    func recordFailure() {
        let count = failedAttempts + 1
        UserDefaults.standard.set(count, forKey: failedAttemptsKey)
        if count >= Self.freeAttempts {
            // 30s, 60s, 120s ... capped at 1 hour.
            let step = count - Self.freeAttempts
            let seconds = min(30.0 * pow(2.0, Double(step)), 3600)
            UserDefaults.standard.set(Date().addingTimeInterval(seconds).timeIntervalSince1970, forKey: lockedUntilKey)
        }
    }

    func recordSuccess() {
        UserDefaults.standard.removeObject(forKey: failedAttemptsKey)
        UserDefaults.standard.removeObject(forKey: lockedUntilKey)
    }

    // MARK: - Internals

    private func hash(_ pin: String, salt: Data) -> Data {
        var input = salt
        input.append(Data(pin.utf8))
        return Data(SHA256.hash(data: input))
    }

    private func baseQuery(account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }

    private func readData(account: String) -> Data? {
        var query = baseQuery(account: account)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else { return nil }
        return result as? Data
    }

    private func writeData(_ data: Data, account: String) -> Bool {
        let query = baseQuery(account: account)
        let attrs: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        let updateStatus = SecItemUpdate(query as CFDictionary, attrs as CFDictionary)
        if updateStatus == errSecSuccess { return true }
        guard updateStatus == errSecItemNotFound else { return false }
        var addQuery = query
        addQuery.merge(attrs) { _, new in new }
        return SecItemAdd(addQuery as CFDictionary, nil) == errSecSuccess
    }
}
