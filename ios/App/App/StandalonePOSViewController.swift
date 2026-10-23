import UIKit
import WebKit

/// Standalone Native iOS WKWebView Controller for SALFORD Jewelry POS v5.7.0
/// Works with or without Capacitor pods — loads public/index.html with full IndexedDB & AirPrint support.
class StandalonePOSViewController: UIViewController, WKUIDelegate, WKNavigationDelegate {
    var webView: WKWebView!

    override var preferredStatusBarStyle: UIStatusBarStyle {
        return .lightContent
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 7/255.0, green: 7/255.0, blue: 15/255.0, alpha: 1.0)

        let config = WKWebViewConfiguration()
        config.websiteDataStore = WKWebsiteDataStore.default()
        config.allowsInlineMediaPlayback = true

        webView = WKWebView(frame: .zero, configuration: config)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.uiDelegate = self
        webView.navigationDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 7/255.0, green: 7/255.0, blue: 15/255.0, alpha: 1.0)
        webView.scrollView.backgroundColor = UIColor(red: 7/255.0, green: 7/255.0, blue: 15/255.0, alpha: 1.0)
        webView.scrollView.bounces = false

        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])

        if let indexURL = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "public") {
            webView.loadFileURL(indexURL, allowingReadAccessTo: indexURL.deletingLastPathComponent())
        }
    }
}
