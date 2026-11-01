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

    func body(content: Content) -> some View {
        content
            .keyboardType(keyboard)
            .autocorrectionDisabled()
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
