import SwiftUI
import LocalAuthentication

struct PinLoginView: View {
    @EnvironmentObject var store: POSDataStore
    @State private var pinInput: String = ""
    @State private var errorMessage: String = ""
    @State private var lockedUntil: Date? = PinVault.lockedUntil
    @FocusState private var isPinFieldFocused: Bool

    private let lockTimer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    private var isLockedOut: Bool { lockedUntil != nil }

    var body: some View {
        ZStack {
            SalfordTheme.bgGradient.ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(spacing: 18) {
                    Spacer(minLength: 14)

                    SalfordMonogramLogoView(size: 84, showWordmark: true)

                    Text("نظام إدارة المبيعات والمجوهرات المتكامل")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(SalfordTheme.textMuted)
                        .padding(.bottom, 4)

                    // Native iOS NumberPad Input Card
                    VStack(spacing: 12) {
                        HStack {
                            Image(systemName: "lock.shield.fill")
                                .foregroundColor(SalfordTheme.silverAccent)
                            Text("أدخل رمز الدخول (8 أرقام)")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(SalfordTheme.silverLight)
                            Spacer()
                            Button {
                                authenticateWithFaceID()
                            } label: {
                                Label("Face ID", systemImage: "faceid")
                                    .font(.system(size: 12, weight: .bold))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 5)
                                    .background(SalfordTheme.royalNavyMid)
                                    .foregroundColor(SalfordTheme.silverLight)
                                    .clipShape(Capsule())
                            }
                        }

                        // Native iOS SecureField with .numberPad keyboard
                        SecureField("••••••••", text: $pinInput)
                            .keyboardType(.numberPad)
                            .focused($isPinFieldFocused)
                            .font(.system(size: 26, weight: .heavy, design: .monospaced))
                            .multilineTextAlignment(.center)
                            .foregroundColor(.white)
                            .padding(.vertical, 12)
                            .padding(.horizontal, 16)
                            .background(Color.black.opacity(0.35))
                            .cornerRadius(14)
                            .overlay(
                                RoundedRectangle(cornerRadius: 14)
                                    .stroke(SalfordTheme.silverAccent.opacity(0.45), lineWidth: 1.4)
                            )
                            .disabled(isLockedOut)
                            .onChange(of: pinInput) { newVal in
                                let filtered = String(PinVault.normalize(newVal).prefix(PinVault.pinLength))
                                if filtered != newVal {
                                    // onChange fires again with the cleaned value; handle it there.
                                    pinInput = filtered
                                    return
                                }
                                if !pinInput.isEmpty && !isLockedOut { errorMessage = "" }
                                if pinInput.count == PinVault.pinLength {
                                    attemptLogin()
                                }
                            }

                        // 8 visual dots indicator
                        HStack(spacing: 10) {
                            ForEach(0..<8, id: \.self) { index in
                                Circle()
                                    .fill(index < pinInput.count ? SalfordTheme.silverLight : Color.white.opacity(0.18))
                                    .frame(width: 11, height: 11)
                                    .scaleEffect(index < pinInput.count ? 1.15 : 1.0)
                                    .animation(.spring(response: 0.25), value: pinInput.count)
                            }
                        }
                        .padding(.vertical, 4)

                        if !errorMessage.isEmpty {
                            Text(errorMessage)
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(SalfordTheme.dangerRed)
                        }

                        // Primary Unlock Button
                        Button {
                            attemptLogin()
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: "lock.open.fill")
                                Text("دخول إلى النظام")
                                    .font(.system(size: 15, weight: .heavy))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                            .background(SalfordTheme.silverGradient)
                            .foregroundColor(SalfordTheme.bgPrimary)
                            .cornerRadius(12)
                            .opacity(isLockedOut ? 0.4 : 1)
                        }
                        .disabled(isLockedOut)

                    }
                    .padding(18)
                    .background(SalfordTheme.bgCard)
                    .cornerRadius(20)
                    .overlay(
                        RoundedRectangle(cornerRadius: 20)
                            .stroke(SalfordTheme.borderSubtle, lineWidth: 1)
                    )
                    .padding(.horizontal, 20)

                    Spacer(minLength: 20)
                }
            }
        }
        .onAppear {
            refreshLockState()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                isPinFieldFocused = true
            }
        }
        .onReceive(lockTimer) { _ in
            if isLockedOut { refreshLockState() }
        }
    }

    private func refreshLockState() {
        lockedUntil = PinVault.lockedUntil
        if let until = lockedUntil {
            let secs = max(1, Int(until.timeIntervalSinceNow.rounded(.up)))
            errorMessage = "🔒 محاولات خاطئة كثيرة — حاول مرة أخرى بعد \(secs) ثانية"
        } else if errorMessage.hasPrefix("🔒") {
            errorMessage = ""
        }
    }

    private func attemptLogin() {
        guard !isLockedOut else { return }
        switch store.verifyPin(pinInput) {
        case .success:
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            errorMessage = ""
        case .wrong(let left):
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            errorMessage = left > 0
                ? "❌ الرمز غير صحيح — تبقّى \(left) محاولات قبل الإيقاف المؤقت"
                : "❌ الرمز غير صحيح"
        case .lockedOut:
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            refreshLockState()
        }
        pinInput = ""
    }

    private func authenticateWithFaceID() {
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
