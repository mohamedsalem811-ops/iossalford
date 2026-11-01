import SwiftUI
import UIKit

@main
struct SalfordJewelryPOSApp: App {
    @StateObject private var store = POSDataStore()
    @Environment(\.scenePhase) private var scenePhase

    init() {
        Self.configureNativeBarsAppearance()
    }

    /// Configures 100% Native iOS Top Navigation Bar & Bottom Tab Bar with SALFORD Royal Navy (#122452 -> #0B1530)
    static func configureNativeBarsAppearance() {
        let royalNavy = UIColor(red: 18/255.0, green: 36/255.0, blue: 82/255.0, alpha: 1.0)
        let deepNavy  = UIColor(red: 11/255.0, green: 21/255.0, blue: 48/255.0, alpha: 1.0)
        let crystal   = UIColor(red: 200/255.0, green: 216/255.0, blue: 240/255.0, alpha: 1.0)
        let goldLight = UIColor(red: 212/255.0, green: 175/255.0, blue: 122/255.0, alpha: 1.0)
        let muted     = UIColor(red: 140/255.0, green: 158/255.0, blue: 192/255.0, alpha: 1.0)

        let navAppearance = UINavigationBarAppearance()
        navAppearance.configureWithOpaqueBackground()
        navAppearance.backgroundColor = royalNavy
        navAppearance.shadowColor = crystal.withAlphaComponent(0.18)
        navAppearance.titleTextAttributes = [
            .foregroundColor: crystal,
            .font: UIFont.systemFont(ofSize: 18, weight: .bold)
        ]
        navAppearance.largeTitleTextAttributes = [
            .foregroundColor: crystal,
            .font: UIFont.systemFont(ofSize: 26, weight: .heavy)
        ]

        UINavigationBar.appearance().standardAppearance = navAppearance
        UINavigationBar.appearance().scrollEdgeAppearance = navAppearance
        UINavigationBar.appearance().compactAppearance = navAppearance
        UINavigationBar.appearance().tintColor = goldLight

        let tabAppearance = UITabBarAppearance()
        tabAppearance.configureWithOpaqueBackground()
        tabAppearance.backgroundColor = deepNavy
        tabAppearance.shadowColor = crystal.withAlphaComponent(0.2)

        let itemAppearance = UITabBarItemAppearance()
        itemAppearance.normal.iconColor = muted
        itemAppearance.normal.titleTextAttributes = [.foregroundColor: muted]
        itemAppearance.selected.iconColor = goldLight
        itemAppearance.selected.titleTextAttributes = [.foregroundColor: goldLight]

        tabAppearance.stackedLayoutAppearance = itemAppearance
        tabAppearance.inlineLayoutAppearance = itemAppearance
        tabAppearance.compactInlineLayoutAppearance = itemAppearance

        UITabBar.appearance().standardAppearance = tabAppearance
        UITabBar.appearance().scrollEdgeAppearance = tabAppearance
        UITabBar.appearance().tintColor = goldLight

        UIScrollView.appearance().bounces = false
        UIView.appearance().semanticContentAttribute = .forceRightToLeft
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
            .preferredColorScheme(.dark)
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
