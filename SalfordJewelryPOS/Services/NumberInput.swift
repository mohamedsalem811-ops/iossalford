import SwiftUI

/// The app only ever shows and stores the digits 0-9.
///
/// If the iPhone's region uses Arabic digits, its number pad types ٠١٢… — those are converted to
/// 0-9 the moment they are typed, so they never appear on screen or in saved data. A decimal
/// comma (",", "٫") becomes ".". Anything else is removed.
enum NumberInput {
    enum Kind {
        case decimal   // prices, amounts, exchange rate: digits and one "."
        case integer   // quantities: digits only
        case phone     // digits, with an optional leading "+"
    }

    /// Converts Arabic-Indic (٠-٩) and Persian (۰-۹) digits to 0-9; leaves every other character as is.
    static func latinDigits(_ input: String) -> String {
        String(input.map { ch -> Character in
            guard ch.unicodeScalars.count == 1, let v = ch.unicodeScalars.first?.value else { return ch }
            switch v {
            case 0x660...0x669: return Character(UnicodeScalar(v - 0x660 + 0x30)!)
            case 0x6F0...0x6F9: return Character(UnicodeScalar(v - 0x6F0 + 0x30)!)
            default: return ch
            }
        })
    }

    static func sanitize(_ input: String, kind: Kind) -> String {
        let latin = latinDigits(input)
        switch kind {
        case .integer:
            return latin.filter { ("0"..."9").contains($0) }
        case .phone:
            let digits = latin.filter { ("0"..."9").contains($0) }
            return latin.trimmingCharacters(in: .whitespaces).hasPrefix("+") ? "+" + digits : digits
        case .decimal:
            var result = ""
            var hasPoint = false
            for ch in latin {
                if ("0"..."9").contains(ch) {
                    result.append(ch)
                } else if ch == "." || ch == "," || ch == "٫" {
                    if !hasPoint {
                        hasPoint = true
                        result.append(result.isEmpty ? "0." : ".")
                    }
                }
                // Thousands separators ("٬"), spaces and any other characters are dropped.
            }
            return result
        }
    }

    /// Formats a stored amount for an editable field without losing decimals:
    /// 1250 -> "1250", 12.5 -> "12.5", 7.125 -> "7.125". Always digits 0-9 and ".".
    static func editable(_ value: Double) -> String {
        var text = String(format: "%.3f", locale: Locale(identifier: "en_US_POSIX"), value)
        while text.hasSuffix("0") { text.removeLast() }
        if text.hasSuffix(".") { text.removeLast() }
        return text == "-0" ? "0" : text
    }

    /// Parses a decimal amount typed by the user. nil if empty or not a number.
    static func decimal(_ input: String) -> Double? {
        var clean = sanitize(input, kind: .decimal)
        guard !clean.isEmpty, clean != "0." else { return nil }
        if clean.hasSuffix(".") { clean.removeLast() } // "12." -> "12"
        return Double(clean)
    }

    /// Parses a whole number typed by the user. nil if empty.
    static func integer(_ input: String) -> Int? {
        let clean = sanitize(input, kind: .integer)
        return clean.isEmpty ? nil : Int(clean)
    }
}

private struct NumericInputModifier: ViewModifier {
    @Binding var text: String
    let kind: NumberInput.Kind
    @FocusState private var focused: Bool

    func body(content: Content) -> some View {
        content
            .keyboardType(keyboard)
            .autocorrectionDisabled()
            .focused($focused)
            // Number pads have no return key: add a "تم" (Done) button above the keyboard.
            // Shown only for the focused field so several number fields don't add several buttons.
            .toolbar {
                ToolbarItemGroup(placement: .keyboard) {
                    if focused {
                        Spacer()
                        Button("تم") { focused = false }
                            .font(.system(.body, weight: .bold))
                    }
                }
            }
            .onChange(of: text) { newValue in
                let clean = NumberInput.sanitize(newValue, kind: kind)
                if clean != newValue { text = clean }
            }
    }

    private var keyboard: UIKeyboardType {
        switch kind {
        case .decimal: return .decimalPad
        case .integer: return .numberPad
        case .phone: return .phonePad
        }
    }
}

extension View {
    /// Number field that only ever contains 0-9 (and one "." for decimals). Also sets the keyboard.
    func numericInput(_ text: Binding<String>, _ kind: NumberInput.Kind) -> some View {
        modifier(NumericInputModifier(text: text, kind: kind))
    }
}

/// Libyan dinar amounts. 1 LYD = 1000 dirhams, so money is kept to 3 decimals.
///
/// Storage keeps Double (no risky data migration), but every amount the app calculates is
/// rounded to the dirham before it is saved, and every amount on screen shows its dirhams
/// instead of being cut to whole dinars.
enum Money {
    /// Rounds to the nearest dirham (3 decimals).
    static func round(_ value: Double) -> Double {
        (value * 1000).rounded() / 1000
    }

    private static let formatter: NumberFormatter = {
        let f = NumberFormatter()
        f.locale = Locale(identifier: "en_US")   // digits 0-9, "," thousands, "." decimals
        f.numberStyle = .decimal
        f.minimumFractionDigits = 0
        f.maximumFractionDigits = 3
        f.roundingMode = .halfUp
        return f
    }()

    /// "1,250", "12.5", "1,083.333" — dirhams are shown only when there are any.
    static func plain(_ value: Double) -> String {
        let v = round(value)
        return formatter.string(from: NSNumber(value: v == 0 ? 0 : v)) ?? NumberInput.editable(v)
    }

    /// "1,250 د.ل"
    static func lyd(_ value: Double) -> String {
        plain(value) + " د.ل"
    }

    /// Splits a total into `parts` amounts proportional to `weights`, each rounded to the dirham,
    /// with any rounding difference put on the last part so they add up to exactly `total`.
    static func split(_ total: Double, weights: [Double]) -> [Double] {
        let sum = weights.reduce(0, +)
        guard !weights.isEmpty else { return [] }
        guard sum > 0 else {
            return weights.indices.map { $0 == weights.count - 1 ? round(total) : 0 }
        }
        var parts = weights.map { round(total * $0 / sum) }
        let diff = round(total - parts.reduce(0, +))
        parts[parts.count - 1] = round(parts[parts.count - 1] + diff)
        return parts
    }
}
