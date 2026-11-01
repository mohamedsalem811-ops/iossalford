import SwiftUI
import UIKit

@main
struct SalfordJewelryPOSApp: App {
    /// Two separate systems, each with its own database, login, customers, brands and reports.
    @StateObject private var jewelryStore = POSDataStore(line: .jewelry)
    @StateObject private var scarvesStore = POSDataStore(line: .scarves)
    /// nil = show the "which system?" screen.
    @State private var activeLine: BusinessLine? = nil
    @Environment(\.scenePhase) private var scenePhase

    init() {
        Self.configureNativeBarsAppearance()
    }

    /// The navigation bar and tab bar are left to iOS so they get the system look
    /// (the new "Liquid Glass" bars on iOS 26) in both Light and Dark mode.
    /// The SALFORD gold is applied as the app tint.
    static func configureNativeBarsAppearance() {
        // Right-to-left only for the bars and controls the app itself draws. The app's screens get
        // RTL from the SwiftUI environment below; system screens (share sheet, camera, print,
        // Face ID) keep the phone's own direction instead of being flipped.
        UINavigationBar.appearance().semanticContentAttribute = .forceRightToLeft
        UITabBar.appearance().semanticContentAttribute = .forceRightToLeft
        UISegmentedControl.appearance().semanticContentAttribute = .forceRightToLeft
    }

    var body: some Scene {
        WindowGroup {
            Group {
                if let line = activeLine {
                    SystemContainerView(store: line == .jewelry ? jewelryStore : scarvesStore) {
                        // Switch system: lock the one being left, back to the chooser.
                        (line == .jewelry ? jewelryStore : scarvesStore).lock()
                        withAnimation(.easeInOut(duration: 0.25)) { activeLine = nil }
                    }
                    .id(line)
                    .transition(.opacity)
                } else {
                    SystemChooserView { chosen in
                        withAnimation(.easeInOut(duration: 0.25)) { activeLine = chosen }
                    }
                    .transition(.opacity)
                }
            }
            .overlay {
                // Hide sales/profit figures from the app switcher snapshot.
                if scenePhase != .active && (jewelryStore.isAuthenticated || scarvesStore.isAuthenticated) {
                    ZStack {
                        SalfordTheme.bgGradient.ignoresSafeArea()
                        SalfordMonogramLogoView(size: 84, showWordmark: true)
                    }
                }
            }
            .onChange(of: scenePhase) { phase in
                // Require Face ID / the code again whenever the app leaves the screen.
                if phase == .background {
                    jewelryStore.lock()
                    scarvesStore.lock()
                }
                if phase == .active {
                    jewelryStore.retryDeferredLoadIfNeeded()
                    scarvesStore.retryDeferredLoadIfNeeded()
                }
            }
            .environment(\.layoutDirection, .rightToLeft)
            .environment(\.locale, Locale(identifier: "ar_LY@numbers=latn"))
        }
    }
}

/// Lets any screen go back to the "which system?" screen.
private struct SwitchSystemKey: EnvironmentKey {
    static let defaultValue: () -> Void = {}
}

extension EnvironmentValues {
    var switchSystem: () -> Void {
        get { self[SwitchSystemKey.self] }
        set { self[SwitchSystemKey.self] = newValue }
    }
}

/// One system (jewelry or scarves): its login, then its tabs. Uses the system's accent colour.
struct SystemContainerView: View {
    @ObservedObject var store: POSDataStore
    let onSwitch: () -> Void

    var body: some View {
        Group {
            if store.isAuthenticated {
                MainTabView()
            } else {
                PinLoginView()
            }
        }
        .environmentObject(store)
        .environment(\.switchSystem, onSwitch)
        .tint(store.line.accent)
        .alert(
            "تنبيه حفظ البيانات",
            isPresented: Binding(
                get: { store.storageAlertMessage != nil },
                set: { if !$0 { store.storageAlertMessage = nil } }
            )
        ) {
            Button("حسناً", role: .cancel) {}
        } message: {
            Text(store.storageAlertMessage ?? "")
        }
    }
}

/// First screen: choose المجوهرات or الأوشحة.
struct SystemChooserView: View {
    let onChoose: (BusinessLine) -> Void

    var body: some View {
        ZStack {
            SalfordTheme.bgGradient.ignoresSafeArea()
            ScrollView(showsIndicators: false) {
                VStack(spacing: SalfordSpacing.xl) {
                    Spacer(minLength: SalfordSpacing.xl)
                    SalfordMonogramLogoView(size: 84, showWordmark: true)
                        .accessibilityHidden(true)
                    Text("اختر النظام")
                        .font(.system(.title2, weight: .bold))
                        .foregroundColor(SalfordTheme.textPrimary)

                    VStack(spacing: SalfordSpacing.l) {
                        ForEach(BusinessLine.allCases) { line in
                            Button {
                                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                                onChoose(line)
                            } label: {
                                HStack(spacing: SalfordSpacing.l) {
                                    Image(systemName: line.icon)
                                        .font(.system(.title))
                                        .foregroundColor(.white)
                                        .frame(width: 64, height: 64)
                                        .background(line.accent.gradient)
                                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(line.title)
                                            .font(.system(.title3, weight: .bold))
                                            .foregroundColor(SalfordTheme.textPrimary)
                                        Label(line.subtitle, systemImage: line.usesBiometrics ? "faceid" : "lock.fill")
                                            .font(.system(.footnote))
                                            .foregroundColor(SalfordTheme.textMuted)
                                    }
                                    Spacer()
                                    Image(systemName: "chevron.left")
                                        .foregroundColor(SalfordTheme.textMuted)
                                }
                                .padding(SalfordSpacing.l)
                                .frame(maxWidth: .infinity)
                                .salfordCard(borderColor: line.accent.opacity(0.5))
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("نظام \(line.title)، \(line.subtitle)")
                        }
                    }
                    Spacer(minLength: SalfordSpacing.l)
                }
                .frame(maxWidth: 480)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, SalfordSpacing.xl)
            }
        }
    }
}
