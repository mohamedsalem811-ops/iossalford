import SwiftUI
import UIKit

@main
struct SalfordJewelryPOSApp: App {
    @StateObject private var store = POSDataStore()
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
                if store.isAuthenticated {
                    MainTabView()
                        .environmentObject(store)
                        .transition(.opacity)
                } else {
                    PinLoginView()
                        .environmentObject(store)
                        .transition(.opacity)
                }
            }
            .overlay {
                // Hide sales/profit figures from the app switcher snapshot.
                if scenePhase != .active && store.isAuthenticated {
                    ZStack {
                        SalfordTheme.bgGradient.ignoresSafeArea()
                        SalfordMonogramLogoView(size: 84, showWordmark: true)
                    }
                }
            }
            .onChange(of: scenePhase) { phase in
                // Require the PIN / Face ID again whenever the app leaves the screen.
                if phase == .background {
                    store.lock()
                }
                if phase == .active {
                    store.retryDeferredLoadIfNeeded()
                }
            }
            .environment(\.layoutDirection, .rightToLeft)
            .environment(\.locale, Locale(identifier: "ar_LY@numbers=latn"))
            .tint(SalfordTheme.gold)
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
}
