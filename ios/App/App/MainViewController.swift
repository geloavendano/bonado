import Capacitor

/// Enables the native edge-swipe back/forward gesture on the app's single
/// WKWebView. Since the app is a client-side router using pushState, this
/// hooks directly into history.back()/forward() — no JS changes needed.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        webView?.allowsBackForwardNavigationGestures = true
    }
}
