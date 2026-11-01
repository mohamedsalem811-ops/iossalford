import SwiftUI
import LocalAuthentication

/// Login: 8-digit PIN on a built-in keypad (always digits 0-9, whatever the phone's region),
/// Face ID / Touch ID, and an escalating lockout after wrong attempts.
struct PinLoginView: View {
    @EnvironmentObject var store: POSDataStore
    @Environment(\.switchSystem) private var switchSystem
    @State private var pinInput: String = ""
    /// Creating the scarves code: the first entry, waiting for the confirmation entry.
    @State private var setupFirstEntry: String? = nil
    @State private var errorMessage: String = ""
    @State private var lockedUntil: Date? = nil
    @State private var shake: CGFloat = 0
    @State private var didAutoPromptBiometrics = false

    private let lockTimer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    private var isLockedOut: Bool { lockedUntil != nil }

    private var biometryType: LABiometryType {
        let context = LAContext()
        _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        return context.biometryType
    }

    /// Only the jewelry system uses Face ID / Touch ID; scarves always uses its own code.
    private var biometryAvailable: Bool { store.line.usesBiometrics && biometryType != .none }

    private var isSetup: Bool { store.needsPinSetup }

    private var titleText: String {
        if isSetup {
            return setupFirstEntry == nil ? "أنشئ رمز \(store.line.title)" : "أعد إدخال الرمز للتأكيد"
        }
        return "أدخل رمز \(store.line.title)"
    }

    private var biometryIcon: String {
        biometryType == .touchID ? "touchid" : "faceid"
    }

    var body: some View {
        ZStack {
            SalfordTheme.bgGradient.ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(spacing: SalfordSpacing.xl) {
                    Spacer(minLength: SalfordSpacing.l)

                    HStack {
                        Button {
                            switchSystem()
                        } label: {
                            Label("تغيير النظام", systemImage: "arrow.left.arrow.right")
                                .font(.system(.subheadline, weight: .semibold))
                        }
                        Spacer()
                        Label(store.line.title, systemImage: store.line.icon)
                            .font(.system(.subheadline, weight: .bold))
                            .foregroundColor(store.line.accent)
                    }
                    .environment(\.layoutDirection, .rightToLeft)

                    SalfordMonogramLogoView(size: 84, showWordmark: true)
                        .accessibilityHidden(true)

                    VStack(spacing: SalfordSpacing.s) {
                        Text(titleText)
                            .font(.system(.title3, weight: .bold))
                            .foregroundColor(SalfordTheme.textPrimary)
                        Text(isSetup ? "8 أرقام — هذا الرمز خاص بنظام \(store.line.title) فقط" : "8 أرقام")
                            .font(.system(.subheadline))
                            .foregroundColor(SalfordTheme.textMuted)
                            .multilineTextAlignment(.center)
                    }

                    pinDots
                        .modifier(ShakeEffect(animatableData: shake))

                    Text(errorMessage.isEmpty ? " " : errorMessage)
                        .font(.system(.footnote, weight: .semibold))
                        .foregroundColor(isLockedOut ? SalfordTheme.warningAmber : SalfordTheme.dangerRed)
                        .multilineTextAlignment(.center)
                        .frame(minHeight: 36)
                        .padding(.horizontal, SalfordSpacing.l)
                        .accessibilityHidden(errorMessage.isEmpty)

                    keypad

                    Spacer(minLength: SalfordSpacing.l)
                }
                .frame(maxWidth: 420)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, SalfordSpacing.xl)
            }
        }
        // The keypad below always uses digits 0-9 and the left-to-right order of a phone dial pad.
        .environment(\.layoutDirection, .leftToRight)
        .onAppear {
            refreshLockState()
            // Offer Face ID / Touch ID straight away, once per appearance of the login screen.
            if biometryAvailable && !isSetup && !isLockedOut && !didAutoPromptBiometrics {
                didAutoPromptBiometrics = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { authenticateWithBiometrics() }
            }
        }
        .onReceive(lockTimer) { _ in
            if isLockedOut { refreshLockState() }
        }
    }

    // MARK: PIN dots

    private var pinDots: some View {
        HStack(spacing: 14) {
            ForEach(0..<PinVault.pinLength, id: \.self) { index in
                Circle()
                    .fill(index < pinInput.count ? SalfordTheme.gold : SalfordTheme.textMuted.opacity(0.25))
                    .frame(width: 14, height: 14)
                    .scaleEffect(index < pinInput.count ? 1.15 : 1.0)
                    .animation(.spring(response: 0.25), value: pinInput.count)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("تم إدخال \(pinInput.count) من \(PinVault.pinLength) أرقام")
    }

    // MARK: Keypad

    private var keypad: some View {
        let rows: [[String]] = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["bio", "0", "del"]]
        return VStack(spacing: SalfordSpacing.m) {
            ForEach(rows, id: \.self) { row in
                HStack(spacing: SalfordSpacing.l) {
                    ForEach(row, id: \.self) { key in
                        keyButton(key)
                    }
                }
            }
        }
    }

    @ViewBuilder private func keyButton(_ key: String) -> some View {
        let size: CGFloat = 76
        switch key {
        case "bio":
            if biometryAvailable && !isSetup {
                Button {
                    authenticateWithBiometrics()
                } label: {
                    Image(systemName: biometryIcon)
                        .font(.system(.title))
                        .frame(width: size, height: size)
                        .foregroundColor(SalfordTheme.gold)
                }
                .accessibilityLabel(biometryType == .touchID ? "الدخول بالبصمة" : "الدخول بالوجه")
            } else {
                Color.clear.frame(width: size, height: size)
            }
        case "del":
            Button {
                if !pinInput.isEmpty { pinInput.removeLast() }
            } label: {
                Image(systemName: "delete.left")
                    .font(.system(.title2))
                    .frame(width: size, height: size)
                    .foregroundColor(SalfordTheme.textPrimary)
            }
            .disabled(pinInput.isEmpty)
            .accessibilityLabel("حذف رقم")
        default:
            Button {
                type(key)
            } label: {
                Text(key)
                    .font(.system(.title, design: .rounded, weight: .semibold))
                    .frame(width: size, height: size)
                    .background(Circle().fill(SalfordTheme.bgCard))
                    .overlay(Circle().stroke(SalfordTheme.borderSubtle, lineWidth: 1))
                    .foregroundColor(SalfordTheme.textPrimary)
            }
            .buttonStyle(KeypadButtonStyle())
            // Digits are blocked during a lockout; Face ID / Touch ID still works.
            .disabled(isLockedOut)
            .opacity(isLockedOut ? 0.4 : 1)
            .accessibilityLabel(key)
        }
    }

    private func type(_ digit: String) {
        guard pinInput.count < PinVault.pinLength else { return }
        if pinInput.isEmpty && !isLockedOut { errorMessage = "" }
        pinInput.append(digit)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        if pinInput.count == PinVault.pinLength {
            // Let the last dot fill before checking.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) { attemptLogin() }
        }
    }

    // MARK: Login

    private func refreshLockState() {
        lockedUntil = store.pinVault.lockedUntil
        if let until = lockedUntil {
            let secs = max(1, Int(until.timeIntervalSinceNow.rounded(.up)))
            errorMessage = "🔒 محاولات خاطئة كثيرة — حاول مرة أخرى بعد \(secs) ثانية"
        } else if errorMessage.hasPrefix("🔒") {
            errorMessage = ""
        }
    }

    private func attemptLogin() {
        if isSetup {
            createPin()
            return
        }
        guard !isLockedOut else { return }
        switch store.verifyPin(pinInput) {
        case .success:
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            errorMessage = ""
        case .wrong(let left):
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            withAnimation(.default) { shake += 1 }
            errorMessage = left > 0
                ? "الرمز غير صحيح — تبقّى \(left) محاولات قبل الإيقاف المؤقت"
                : "الرمز غير صحيح"
        case .lockedOut:
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            withAnimation(.default) { shake += 1 }
            refreshLockState()
        }
        pinInput = ""
    }

    /// First use of a system without a code (scarves): type it, then type it again to confirm.
    private func createPin() {
        guard let first = setupFirstEntry else {
            setupFirstEntry = pinInput
            pinInput = ""
            errorMessage = ""
            return
        }
        if let error = store.setupPin(first, confirm: pinInput) {
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            withAnimation(.default) { shake += 1 }
            errorMessage = error
            setupFirstEntry = nil
        } else {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
        pinInput = ""
    }

    private func authenticateWithBiometrics() {
        let context = LAContext()
        context.localizedFallbackTitle = "استخدم الرمز الرقمي"
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            errorMessage = "Face ID غير مفعل على هذا الجهاز — استخدم الرمز الرقمي"
            return
        }
        context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: "فتح نظام SALFORD Jewelry POS") { success, _ in
            DispatchQueue.main.async {
                if success {
                    store.unlockWithBiometrics()
                }
            }
        }
    }
}

/// Small press feedback for keypad digits.
private struct KeypadButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.92 : 1)
            .opacity(configuration.isPressed ? 0.7 : 1)
            .animation(.easeOut(duration: 0.1), value: configuration.isPressed)
    }
}

/// Horizontal shake for a wrong PIN.
private struct ShakeEffect: GeometryEffect {
    var animatableData: CGFloat

    func effectValue(size: CGSize) -> ProjectionTransform {
        ProjectionTransform(CGAffineTransform(translationX: 10 * sin(animatableData * .pi * 4), y: 0))
    }
}
