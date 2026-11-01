import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var store: POSDataStore
    @State private var selectedTab: Int = 0
    @State private var showDefaultPinWarning: Bool = false
    @State private var showPinSettings: Bool = false

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                DashboardView(selectedTab: $selectedTab)
            }
            .tabItem {
                Label("الرئيسية", systemImage: "chart.bar.xaxis")
            }
            .tag(0)

            NavigationStack {
                SalePOSView()
            }
            .badge(store.cart.isEmpty ? 0 : store.cart.count)
            .tabItem {
                Label("نقطة البيع", systemImage: "cart.fill.badge.plus")
            }
            .tag(1)

            NavigationStack {
                GiftReceiptStudioView()
            }
            .tabItem {
                Label("الفاتورة", systemImage: "doc.text.fill")
            }
            .tag(2)

            NavigationStack {
                ProductsView()
            }
            .tabItem {
                Label("المنتجات", systemImage: "sparkles")
            }
            .tag(3)

            NavigationStack {
                MoreManagementHubView()
            }
            .tabItem {
                Label("الإدارة", systemImage: "square.grid.2x2.fill")
            }
            .tag(4)
        }
        .tint(SalfordTheme.silverLight)
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
