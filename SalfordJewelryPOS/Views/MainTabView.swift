import SwiftUI

/// The app's tabs, in display order. Named cases instead of numbers so links between
/// screens (e.g. "low stock" on the dashboard opening Products) can't point at the wrong tab.
enum AppTab: Hashable {
    case dashboard, sale, products, receipts, management
}

struct MainTabView: View {
    @EnvironmentObject var store: POSDataStore
    @State private var selectedTab: AppTab = .dashboard
    @State private var showDefaultPinWarning: Bool = false
    @State private var showPinSettings: Bool = false

    private var cartPieces: Int { store.cart.reduce(0) { $0 + $1.quantity } }

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                DashboardView(selectedTab: $selectedTab)
            }
            .tabItem { Label("الرئيسية", systemImage: "chart.bar.xaxis") }
            .tag(AppTab.dashboard)

            NavigationStack {
                SalePOSView()
            }
            .badge(cartPieces)
            .tabItem { Label("البيع", systemImage: "cart.fill") }
            .tag(AppTab.sale)

            NavigationStack {
                ProductsView()
            }
            .tabItem { Label("المنتجات", systemImage: "sparkles") }
            .tag(AppTab.products)

            // Saved receipts; new / opened receipts are edited in the receipt sheet.
            NavigationStack {
                ReceiptsHistoryView()
            }
            .tabItem { Label("الفواتير", systemImage: "doc.text.fill") }
            .tag(AppTab.receipts)

            NavigationStack {
                MoreManagementHubView()
            }
            .tabItem { Label("الإدارة", systemImage: "square.grid.2x2.fill") }
            .tag(AppTab.management)
        }
        .tint(SalfordTheme.gold)
        .sheet(isPresented: $store.showGiftReceiptStudio) {
            NavigationStack {
                GiftReceiptStudioView(isModalSheet: true)
            }
            .environment(\.layoutDirection, .rightToLeft)
        }
        .onAppear {
            showDefaultPinWarning = store.isUsingDefaultPin
        }
        .alert("غيّر رمز الدخول الافتراضي", isPresented: $showDefaultPinWarning) {
            Button("تغيير الآن") { showPinSettings = true }
            Button("لاحقاً", role: .cancel) {}
        } message: {
            Text("التطبيق ما زال يستخدم الرمز الافتراضي المعروف. أي شخص يعرفه يمكنه فتح بيانات المبيعات والأرباح.")
        }
        .sheet(isPresented: $showPinSettings) {
            NavigationStack {
                SettingsAndBackupView()
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("إغلاق") { showPinSettings = false }
                        }
                    }
            }
            .environmentObject(store)
            .environment(\.layoutDirection, .rightToLeft)
        }
    }
}
