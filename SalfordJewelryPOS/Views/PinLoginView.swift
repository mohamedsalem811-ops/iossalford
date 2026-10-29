import SwiftUI
import LocalAuthentication
import CoreImage.CIFilterBuiltins

struct PinLoginView: View {
    @EnvironmentObject var store: POSDataStore
    @State private var pinInput: String = ""
    @State private var errorMessage: String = ""
    @State private var showQRModal: Bool = false
    @FocusState private var isPinFieldFocused: Bool

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
                            .onChange(of: pinInput) { newVal in
                                let filtered = newVal.filter { $0.isNumber }
                                if filtered.count > 8 {
                                    pinInput = String(filtered.prefix(8))
                                } else if filtered != newVal {
                                    pinInput = filtered
                                }
                                errorMessage = ""
                                if pinInput.count == 8 {
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
                        }

                        // Quick Demo Fill & Clear Row
                        HStack(spacing: 10) {
                            Button {
                                pinInput = store.pin
                                attemptLogin()
                            } label: {
                                Label("تعبئة سريعة (\(store.pin))", systemImage: "bolt.fill")
                                    .font(.system(size: 12, weight: .bold))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 9)
                                    .background(SalfordTheme.bgElevated)
                                    .foregroundColor(SalfordTheme.silverLight)
                                    .cornerRadius(10)
                            }

                            Button {
                                showQRModal = true
                            } label: {
                                Label("باركود اليوم QR", systemImage: "qrcode")
                                    .font(.system(size: 12, weight: .bold))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 9)
                                    .background(SalfordTheme.bgElevated)
                                    .foregroundColor(SalfordTheme.silverAccent)
                                    .cornerRadius(10)
                            }
                        }
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
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                isPinFieldFocused = true
            }
        }
        .sheet(isPresented: $showQRModal) {
            DailyQRLoginSheet(pin: store.pin) {
                showQRModal = false
                let _ = store.verifyPin(store.pin)
            }
            .presentationDetents([.medium])
        }
    }

    private func attemptLogin() {
        if !store.verifyPin(pinInput) {
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            errorMessage = "❌ الرمز غير صحيح! الرمز الافتراضي: \(store.pin)"
            pinInput = ""
        } else {
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        }
    }

    private func authenticateWithFaceID() {
        let context = LAContext()
        var error: NSError?
        if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
            context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: "فتح نظام SALFORD Jewelry POS") { success, _ in
                DispatchQueue.main.async {
                    if success {
                        let _ = store.verifyPin(store.pin)
                    }
                }
            }
        } else {
            errorMessage = "Face ID غير مفعل على هذا الجهاز — استخدم الرمز الرقمي"
        }
    }
}

struct DailyQRLoginSheet: View {
    let pin: String
    let onInstantUnlock: () -> Void

    var body: some View {
        ZStack {
            SalfordTheme.bgPrimary.ignoresSafeArea()
            VStack(spacing: 16) {
                Text("باركود الدخول اليومي السريع")
                    .font(.system(size: 17, weight: .heavy))
                    .foregroundColor(SalfordTheme.silverLight)

                if let qrImage = generateQRCode(from: "SALFORD-POS-LOGIN:\(pin)") {
                    Image(uiImage: qrImage)
                        .interpolation(.none)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 180, height: 180)
                        .padding(14)
                        .background(Color.white)
                        .cornerRadius(16)
                }

                Text("امسح الباركود أو اضغط الزر أدناه للدخول المباشر")
                    .font(.system(size: 12))
                    .foregroundColor(SalfordTheme.textMuted)

                Button {
                    onInstantUnlock()
                } label: {
                    Label("دخول فوري بالباركود اليومي", systemImage: "checkmark.seal.fill")
                        .font(.system(size: 14, weight: .bold))
                        .padding(.horizontal, 24)
                        .padding(.vertical, 12)
                        .background(SalfordTheme.silverGradient)
                        .foregroundColor(SalfordTheme.bgPrimary)
                        .cornerRadius(12)
                }
            }
            .padding()
        }
    }

    private func generateQRCode(from string: String) -> UIImage? {
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(string.utf8)
        if let outputImage = filter.outputImage {
            let scaled = outputImage.transformed(by: CGAffineTransform(scaleX: 8, y: 8))
            if let cgimg = context.createCGImage(scaled, from: scaled.extent) {
                return UIImage(cgImage: cgimg)
            }
        }
        return nil
    }
}
