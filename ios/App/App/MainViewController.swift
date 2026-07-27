import Capacitor
import UIKit
import WebKit

/// Enables the native edge-swipe back/forward gesture on the app's single
/// WKWebView. Since the app is a client-side router using pushState, this
/// hooks directly into history.back()/forward() — no JS changes needed.
class MainViewController: CAPBridgeViewController, WKScriptMessageHandler, BonadoNativeTripNavViewDelegate, BonadoNativeTopControlsViewDelegate, BonadoNativeActionButtonViewDelegate, BonadoNativeScreenBackButtonViewDelegate, BonadoNativeDashboardControlsViewDelegate {
    private let nativeTripNavView = BonadoNativeTripNavView()
    private let nativeTopControlsView = BonadoNativeTopControlsView()
    private let nativeActionButtonView = BonadoNativeActionButtonView()
    private let nativeScreenBackButtonView = BonadoNativeScreenBackButtonView()
    private let nativeDashboardControlsView = BonadoNativeDashboardControlsView()
    private var nativeTopControlsOwner: String?
    private var nativeActionButtonOwner: String?
    private var nativeScreenBackOwner: String?
    private var nativeDashboardControlsOwner: String?
    private var pendingTopControlsHideWorkItem: DispatchWorkItem?

    override func viewDidLoad() {
        super.viewDidLoad()
        setupNativeTripNav()
        setupNativeTopControls()
        setupNativeActionButton()
        setupNativeScreenBackButton()
        setupNativeDashboardControls()
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        webView?.allowsBackForwardNavigationGestures = true
        webView?.configuration.userContentController.add(self, name: "bonadoNativeNav")
        webView?.configuration.userContentController.add(self, name: "bonadoNativeTopControls")
        webView?.configuration.userContentController.add(self, name: "bonadoNativeActionButton")
        webView?.configuration.userContentController.add(self, name: "bonadoNativeScreenBack")
        webView?.configuration.userContentController.add(self, name: "bonadoNativeDashboardControls")
        webView?.configuration.userContentController.add(self, name: "bonadoNativeTheme")
    }

    deinit {
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "bonadoNativeNav")
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "bonadoNativeTopControls")
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "bonadoNativeActionButton")
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "bonadoNativeScreenBack")
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "bonadoNativeDashboardControls")
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "bonadoNativeTheme")
    }

    private func setupNativeTripNav() {
        nativeTripNavView.delegate = self
        nativeTripNavView.translatesAutoresizingMaskIntoConstraints = false
        nativeTripNavView.isHidden = true
        nativeTripNavView.alpha = 0
        view.addSubview(nativeTripNavView)

        NSLayoutConstraint.activate([
            nativeTripNavView.leadingAnchor.constraint(greaterThanOrEqualTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 20),
            nativeTripNavView.trailingAnchor.constraint(lessThanOrEqualTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -20),
            nativeTripNavView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            nativeTripNavView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -12),
            nativeTripNavView.widthAnchor.constraint(lessThanOrEqualToConstant: 430),
        ])
    }

    private func setupNativeTopControls() {
        nativeTopControlsView.delegate = self
        nativeTopControlsView.translatesAutoresizingMaskIntoConstraints = false
        nativeTopControlsView.isHidden = true
        nativeTopControlsView.alpha = 0
        view.addSubview(nativeTopControlsView)

        NSLayoutConstraint.activate([
            nativeTopControlsView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 20),
            nativeTopControlsView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -20),
            nativeTopControlsView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 14),
            nativeTopControlsView.heightAnchor.constraint(equalToConstant: 44),
        ])
    }

    private func setupNativeActionButton() {
        nativeActionButtonView.delegate = self
        nativeActionButtonView.translatesAutoresizingMaskIntoConstraints = false
        nativeActionButtonView.isHidden = true
        nativeActionButtonView.alpha = 0
        view.addSubview(nativeActionButtonView)

        NSLayoutConstraint.activate([
            nativeActionButtonView.leadingAnchor.constraint(greaterThanOrEqualTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 20),
            nativeActionButtonView.trailingAnchor.constraint(lessThanOrEqualTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -20),
            nativeActionButtonView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            nativeActionButtonView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -12),
            nativeActionButtonView.widthAnchor.constraint(lessThanOrEqualToConstant: 430),
            nativeActionButtonView.heightAnchor.constraint(equalToConstant: 58),
        ])
    }

    private func setupNativeScreenBackButton() {
        nativeScreenBackButtonView.delegate = self
        nativeScreenBackButtonView.translatesAutoresizingMaskIntoConstraints = false
        nativeScreenBackButtonView.isHidden = true
        nativeScreenBackButtonView.alpha = 0
        view.addSubview(nativeScreenBackButtonView)

        NSLayoutConstraint.activate([
            nativeScreenBackButtonView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 20),
            nativeScreenBackButtonView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 14),
            nativeScreenBackButtonView.widthAnchor.constraint(equalToConstant: 44),
            nativeScreenBackButtonView.heightAnchor.constraint(equalToConstant: 44),
        ])
    }

    private func setupNativeDashboardControls() {
        nativeDashboardControlsView.delegate = self
        nativeDashboardControlsView.translatesAutoresizingMaskIntoConstraints = false
        nativeDashboardControlsView.isHidden = true
        nativeDashboardControlsView.alpha = 0
        view.addSubview(nativeDashboardControlsView)

        NSLayoutConstraint.activate([
            nativeDashboardControlsView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -20),
            nativeDashboardControlsView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 14),
            nativeDashboardControlsView.widthAnchor.constraint(equalToConstant: 98),
            nativeDashboardControlsView.heightAnchor.constraint(equalToConstant: 44),
        ])
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let type = body["type"] as? String else {
            return
        }

        if message.name == "bonadoNativeNav", type == "tripNav:update" {
            let visible = body["visible"] as? Bool ?? false
            let hidden = body["hidden"] as? Bool ?? false
            let activeTab = body["activeTab"] as? String ?? "entries"

            DispatchQueue.main.async { [weak self] in
                guard let self else { return }

                if visible {
                    self.nativeTripNavView.setActiveTab(activeTab, animated: true)
                    self.nativeTripNavView.setVisible(!hidden, animated: true)
                } else {
                    self.nativeTripNavView.setVisible(false, animated: true)
                }
            }
            return
        }

        if message.name == "bonadoNativeTopControls", type == "topControls:update" {
            let visible = body["visible"] as? Bool ?? false
            let tone = body["tone"] as? String ?? "surface"
            let owner = body["id"] as? String

            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                if visible {
                    self.pendingTopControlsHideWorkItem?.cancel()
                    self.pendingTopControlsHideWorkItem = nil
                    self.nativeTopControlsOwner = owner
                    self.nativeTopControlsView.setTone(tone, animated: true)
                    self.nativeTopControlsView.setVisible(true, animated: true)
                } else if owner == nil || owner == self.nativeTopControlsOwner {
                    self.pendingTopControlsHideWorkItem?.cancel()
                    let hideWorkItem = DispatchWorkItem { [weak self] in
                        guard let self else { return }
                        if owner == nil || owner == self.nativeTopControlsOwner {
                            self.nativeTopControlsOwner = nil
                            self.nativeTopControlsView.setVisible(false, animated: true)
                        }
                    }
                    self.pendingTopControlsHideWorkItem = hideWorkItem
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.18, execute: hideWorkItem)
                }
            }
            return
        }

        if message.name == "bonadoNativeTopControls", type == "topControls:unread" {
            let unreadCount = body["unreadCount"] as? Int ?? 0

            DispatchQueue.main.async { [weak self] in
                self?.nativeTopControlsView.setUnreadCount(unreadCount)
            }
            return
        }

        if message.name == "bonadoNativeActionButton", type == "actionButton:update" {
            let visible = body["visible"] as? Bool ?? false
            let owner = body["id"] as? String
            let label = body["label"] as? String ?? ""
            let disabled = body["disabled"] as? Bool ?? false
            let bottomOffset = body["bottomOffset"] as? Double ?? 0

            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                if visible {
                    self.nativeActionButtonOwner = owner
                    self.nativeActionButtonView.setLabel(label)
                    self.nativeActionButtonView.setDisabled(disabled)
                    self.nativeActionButtonView.setBottomOffset(CGFloat(bottomOffset))
                    self.nativeActionButtonView.setVisible(true, animated: true)
                } else if owner == nil || owner == self.nativeActionButtonOwner {
                    self.nativeActionButtonOwner = nil
                    self.nativeActionButtonView.setVisible(false, animated: true)
                }
            }
            return
        }

        if message.name == "bonadoNativeScreenBack", type == "screenBack:update" {
            let visible = body["visible"] as? Bool ?? false
            let owner = body["id"] as? String

            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                if visible {
                    self.nativeScreenBackOwner = owner
                    self.nativeScreenBackButtonView.setVisible(true, animated: true)
                } else if owner == nil || owner == self.nativeScreenBackOwner {
                    self.nativeScreenBackOwner = nil
                    self.nativeScreenBackButtonView.setVisible(false, animated: true)
                }
            }
            return
        }

        if message.name == "bonadoNativeDashboardControls", type == "dashboardControls:update" {
            let visible = body["visible"] as? Bool ?? false
            let owner = body["id"] as? String
            let avatarUrl = body["avatarUrl"] as? String
            let name = body["name"] as? String

            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                if visible {
                    self.nativeDashboardControlsOwner = owner
                    self.nativeDashboardControlsView.setAvatar(urlString: avatarUrl, name: name)
                    self.nativeDashboardControlsView.setVisible(true, animated: true)
                } else if owner == nil || owner == self.nativeDashboardControlsOwner {
                    self.nativeDashboardControlsOwner = nil
                    self.nativeDashboardControlsView.setVisible(false, animated: true)
                }
            }
            return
        }

        if message.name == "bonadoNativeDashboardControls", type == "dashboardControls:unread" {
            let unreadCount = body["unreadCount"] as? Int ?? 0

            DispatchQueue.main.async { [weak self] in
                self?.nativeDashboardControlsView.setUnreadCount(unreadCount)
            }
            return
        }

        if message.name == "bonadoNativeTheme", type == "theme:update" {
            let preference = body["preference"] as? String ?? "system"

            DispatchQueue.main.async { [weak self] in
                self?.applyNativeThemePreference(preference)
            }
            return
        }
    }

    private func applyNativeThemePreference(_ preference: String) {
        let style: UIUserInterfaceStyle
        switch preference {
        case "light":
            style = .light
        case "dark":
            style = .dark
        default:
            style = .unspecified
        }

        view.overrideUserInterfaceStyle = style
        nativeTripNavView.overrideUserInterfaceStyle = style
        nativeTopControlsView.overrideUserInterfaceStyle = style
        nativeActionButtonView.overrideUserInterfaceStyle = style
        nativeScreenBackButtonView.overrideUserInterfaceStyle = style
        nativeDashboardControlsView.overrideUserInterfaceStyle = style
        nativeTripNavView.refreshAppearance()
    }

    func nativeTripNavView(_ view: BonadoNativeTripNavView, didSelectTab tab: String) {
        dispatchNativeTripNavEvent(action: "selectTab", tab: tab)
    }

    func nativeTripNavViewDidTapAddExpense(_ view: BonadoNativeTripNavView) {
        dispatchNativeTripNavEvent(action: "addExpense")
    }

    func nativeTopControlsViewDidTapBack(_ view: BonadoNativeTopControlsView) {
        dispatchNativeTopControlsEvent(action: "back")
    }

    func nativeTopControlsViewDidTapNotifications(_ view: BonadoNativeTopControlsView) {
        dispatchNativeTopControlsEvent(action: "notifications")
    }

    func nativeTopControlsViewDidTapSettings(_ view: BonadoNativeTopControlsView) {
        dispatchNativeTopControlsEvent(action: "settings")
    }

    func nativeActionButtonViewDidTap(_ view: BonadoNativeActionButtonView) {
        guard let nativeActionButtonOwner else { return }
        dispatchNativeActionButtonEvent(id: nativeActionButtonOwner)
    }

    func nativeScreenBackButtonViewDidTap(_ view: BonadoNativeScreenBackButtonView) {
        guard let nativeScreenBackOwner else { return }
        dispatchNativeScreenBackEvent(id: nativeScreenBackOwner)
    }

    func nativeDashboardControlsViewDidTapNotifications(_ view: BonadoNativeDashboardControlsView) {
        guard let nativeDashboardControlsOwner else { return }
        dispatchNativeDashboardControlsEvent(action: "notifications", id: nativeDashboardControlsOwner)
    }

    func nativeDashboardControlsViewDidTapAccount(_ view: BonadoNativeDashboardControlsView) {
        guard let nativeDashboardControlsOwner else { return }
        dispatchNativeDashboardControlsEvent(action: "account", id: nativeDashboardControlsOwner)
    }

    private func dispatchNativeTripNavEvent(action: String, tab: String? = nil) {
        var detail = "{ action: '\(action)'"
        if let tab {
            detail += ", tab: '\(tab)'"
        }
        detail += " }"

        let script = """
        window.dispatchEvent(new CustomEvent('bonado:native-trip-nav', { detail: \(detail) }));
        """
        webView?.evaluateJavaScript(script)
    }

    private func dispatchNativeTopControlsEvent(action: String) {
        let script = """
        window.dispatchEvent(new CustomEvent('bonado:native-top-controls', { detail: { action: '\(action)' } }));
        """
        webView?.evaluateJavaScript(script)
    }

    private func dispatchNativeActionButtonEvent(id: String) {
        let script = """
        window.dispatchEvent(new CustomEvent('bonado:native-action-button', { detail: { id: '\(id)' } }));
        """
        webView?.evaluateJavaScript(script)
    }

    private func dispatchNativeScreenBackEvent(id: String) {
        let script = """
        window.dispatchEvent(new CustomEvent('bonado:native-screen-back', { detail: { id: '\(id)' } }));
        """
        webView?.evaluateJavaScript(script)
    }

    private func dispatchNativeDashboardControlsEvent(action: String, id: String) {
        let script = """
        window.dispatchEvent(new CustomEvent('bonado:native-dashboard-controls', { detail: { action: '\(action)', id: '\(id)' } }));
        """
        webView?.evaluateJavaScript(script)
    }
}

protocol BonadoNativeTripNavViewDelegate: AnyObject {
    func nativeTripNavView(_ view: BonadoNativeTripNavView, didSelectTab tab: String)
    func nativeTripNavViewDidTapAddExpense(_ view: BonadoNativeTripNavView)
}

protocol BonadoNativeTopControlsViewDelegate: AnyObject {
    func nativeTopControlsViewDidTapBack(_ view: BonadoNativeTopControlsView)
    func nativeTopControlsViewDidTapNotifications(_ view: BonadoNativeTopControlsView)
    func nativeTopControlsViewDidTapSettings(_ view: BonadoNativeTopControlsView)
}

protocol BonadoNativeActionButtonViewDelegate: AnyObject {
    func nativeActionButtonViewDidTap(_ view: BonadoNativeActionButtonView)
}

protocol BonadoNativeScreenBackButtonViewDelegate: AnyObject {
    func nativeScreenBackButtonViewDidTap(_ view: BonadoNativeScreenBackButtonView)
}

protocol BonadoNativeDashboardControlsViewDelegate: AnyObject {
    func nativeDashboardControlsViewDidTapNotifications(_ view: BonadoNativeDashboardControlsView)
    func nativeDashboardControlsViewDidTapAccount(_ view: BonadoNativeDashboardControlsView)
}

final class BonadoNativeActionButtonView: UIView {
    weak var delegate: BonadoNativeActionButtonViewDelegate?

    private let button = UIButton(type: .system)
    private var desiredVisible = false
    private var bottomOffset: CGFloat = 0
    private var disabled = false
    private let accentColor = UIColor(red: 0.04, green: 0.50, blue: 0.44, alpha: 1)

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupView()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupView()
    }

    func setLabel(_ label: String) {
        var configuration = button.configuration
        configuration?.title = label
        button.configuration = configuration
        button.accessibilityLabel = label
    }

    func setDisabled(_ disabled: Bool) {
        self.disabled = disabled
        button.isEnabled = true
        button.isUserInteractionEnabled = !disabled
        button.alpha = disabled ? 0.92 : 1

        var configuration = button.configuration
        configuration?.baseForegroundColor = disabled ? .secondaryLabel : .white
        if #available(iOS 26.0, *) {
            configuration?.baseBackgroundColor = disabled
                ? UIColor.secondarySystemFill.withAlphaComponent(0.86)
                : accentColor.withAlphaComponent(0.76)
        } else {
            configuration?.baseBackgroundColor = disabled ? .systemGray4 : accentColor
        }
        button.configuration = configuration
    }

    func setBottomOffset(_ offset: CGFloat) {
        bottomOffset = max(0, offset)
        transform = desiredVisible
            ? CGAffineTransform(translationX: 0, y: -bottomOffset)
            : CGAffineTransform(translationX: 0, y: 84 - bottomOffset)
    }

    func setVisible(_ visible: Bool, animated: Bool) {
        desiredVisible = visible
        if visible {
            isHidden = false
        }

        let changes = {
            self.alpha = visible ? 1 : 0
            self.transform = visible
                ? CGAffineTransform(translationX: 0, y: -self.bottomOffset)
                : CGAffineTransform(translationX: 0, y: 84 - self.bottomOffset)
        }

        let completion: (Bool) -> Void = { _ in
            if !self.desiredVisible {
                self.isHidden = true
            }
        }

        if animated {
            UIView.animate(
                withDuration: 0.36,
                delay: 0,
                usingSpringWithDamping: 0.88,
                initialSpringVelocity: 0.35,
                options: [.allowUserInteraction, .beginFromCurrentState],
                animations: changes,
                completion: completion
            )
        } else {
            changes()
            completion(true)
        }
    }

    private func setupView() {
        translatesAutoresizingMaskIntoConstraints = false
        button.translatesAutoresizingMaskIntoConstraints = false
        button.addTarget(self, action: #selector(didTap), for: .touchUpInside)
        addSubview(button)

        NSLayoutConstraint.activate([
            button.leadingAnchor.constraint(equalTo: leadingAnchor),
            button.trailingAnchor.constraint(equalTo: trailingAnchor),
            button.topAnchor.constraint(equalTo: topAnchor),
            button.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        if #available(iOS 26.0, *) {
            var configuration = UIButton.Configuration.prominentGlass()
            configuration.cornerStyle = .capsule
            configuration.baseForegroundColor = .white
            configuration.baseBackgroundColor = accentColor.withAlphaComponent(0.72)
            configuration.contentInsets = NSDirectionalEdgeInsets(top: 16, leading: 22, bottom: 16, trailing: 22)
            configuration.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
                var outgoing = incoming
                outgoing.font = UIFont.systemFont(ofSize: 16, weight: .bold)
                return outgoing
            }
            button.configuration = configuration
        } else {
            var configuration = UIButton.Configuration.filled()
            configuration.cornerStyle = .capsule
            configuration.baseForegroundColor = .white
            configuration.baseBackgroundColor = accentColor
            configuration.contentInsets = NSDirectionalEdgeInsets(top: 16, leading: 22, bottom: 16, trailing: 22)
            button.configuration = configuration
        }

        button.layer.shadowColor = accentColor.cgColor
        button.layer.shadowOffset = CGSize(width: 0, height: 16)
        button.layer.shadowOpacity = 0.22
        button.layer.shadowRadius = 24
    }

    @objc private func didTap() {
        guard !disabled else { return }
        delegate?.nativeActionButtonViewDidTap(self)
    }
}

final class BonadoNativeScreenBackButtonView: UIView {
    weak var delegate: BonadoNativeScreenBackButtonViewDelegate?

    private let button = UIButton(type: .system)
    private var desiredVisible = false

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupView()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupView()
    }

    func setVisible(_ visible: Bool, animated: Bool) {
        desiredVisible = visible
        if visible {
            isHidden = false
        }

        let changes = {
            self.alpha = visible ? 1 : 0
            self.transform = visible ? .identity : CGAffineTransform(translationX: 0, y: -6)
        }

        let completion: (Bool) -> Void = { _ in
            if !self.desiredVisible {
                self.isHidden = true
            }
        }

        if animated {
            UIView.animate(
                withDuration: 0.22,
                delay: 0,
                options: [.allowUserInteraction, .beginFromCurrentState, .curveEaseOut],
                animations: changes,
                completion: completion
            )
        } else {
            changes()
            completion(true)
        }
    }

    private func setupView() {
        button.translatesAutoresizingMaskIntoConstraints = false
        button.accessibilityLabel = "Back"
        button.addTarget(self, action: #selector(didTap), for: .touchUpInside)
        addSubview(button)

        NSLayoutConstraint.activate([
            button.leadingAnchor.constraint(equalTo: leadingAnchor),
            button.trailingAnchor.constraint(equalTo: trailingAnchor),
            button.topAnchor.constraint(equalTo: topAnchor),
            button.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        if #available(iOS 26.0, *) {
            var configuration = UIButton.Configuration.glass()
            configuration.image = UIImage(systemName: "chevron.left")
            configuration.cornerStyle = .capsule
            configuration.baseForegroundColor = .label
            button.configuration = configuration
        } else {
            var configuration = UIButton.Configuration.filled()
            configuration.image = UIImage(systemName: "chevron.left")
            configuration.cornerStyle = .capsule
            configuration.baseForegroundColor = .label
            configuration.baseBackgroundColor = UIColor.systemBackground.withAlphaComponent(0.86)
            button.configuration = configuration
        }
    }

    @objc private func didTap() {
        delegate?.nativeScreenBackButtonViewDidTap(self)
    }
}

final class BonadoNativeDashboardControlsView: UIView {
    weak var delegate: BonadoNativeDashboardControlsViewDelegate?

    private let notificationsButton = UIButton(type: .system)
    private let accountButton = UIButton(type: .system)
    private let stackView = UIStackView()
    private let badgeLabel = UILabel()
    private var desiredVisible = false

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupView()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupView()
    }

    func setVisible(_ visible: Bool, animated: Bool) {
        desiredVisible = visible
        if visible {
            isHidden = false
        }

        let changes = {
            self.alpha = visible ? 1 : 0
            self.transform = visible ? .identity : CGAffineTransform(translationX: 0, y: -6)
        }

        let completion: (Bool) -> Void = { _ in
            if !self.desiredVisible {
                self.isHidden = true
            }
        }

        if animated {
            UIView.animate(
                withDuration: 0.22,
                delay: 0,
                options: [.allowUserInteraction, .beginFromCurrentState, .curveEaseOut],
                animations: changes,
                completion: completion
            )
        } else {
            changes()
            completion(true)
        }
    }

    func setUnreadCount(_ count: Int) {
        badgeLabel.isHidden = count <= 0
        badgeLabel.text = count > 9 ? "9+" : "\(count)"
        bringSubviewToFront(badgeLabel)
    }

    func setAvatar(urlString: String?, name: String?) {
        let initials = String((name ?? "A").prefix(1)).uppercased()
        let fallbackImage = BonadoNativeDashboardControlsView.initialsImage(initials: initials)
        setAccountImage(fallbackImage)

        guard let urlString,
              let url = URL(string: urlString) else {
            return
        }

        URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            guard let self,
                  let data,
                  let image = UIImage(data: data) else {
                return
            }
            DispatchQueue.main.async {
                self.setAccountImage(image)
            }
        }.resume()
    }

    private func setupView() {
        stackView.axis = .horizontal
        stackView.alignment = .center
        stackView.spacing = 10
        stackView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stackView)

        configureGlass(button: notificationsButton, image: UIImage(systemName: "bell"))
        configureGlass(button: accountButton, image: UIImage(systemName: "person.crop.circle"))

        notificationsButton.accessibilityLabel = "Notifications"
        accountButton.accessibilityLabel = "Account menu"
        notificationsButton.addTarget(self, action: #selector(didTapNotifications), for: .touchUpInside)
        accountButton.addTarget(self, action: #selector(didTapAccount), for: .touchUpInside)

        stackView.addArrangedSubview(notificationsButton)
        stackView.addArrangedSubview(accountButton)

        NSLayoutConstraint.activate([
            stackView.leadingAnchor.constraint(equalTo: leadingAnchor),
            stackView.trailingAnchor.constraint(equalTo: trailingAnchor),
            stackView.topAnchor.constraint(equalTo: topAnchor),
            stackView.bottomAnchor.constraint(equalTo: bottomAnchor),
            notificationsButton.widthAnchor.constraint(equalToConstant: 44),
            notificationsButton.heightAnchor.constraint(equalToConstant: 44),
            accountButton.widthAnchor.constraint(equalToConstant: 44),
            accountButton.heightAnchor.constraint(equalToConstant: 44),
        ])

        setupBadge()
    }

    private func configureGlass(button: UIButton, image: UIImage?) {
        button.translatesAutoresizingMaskIntoConstraints = false
        button.clipsToBounds = false
        button.layer.masksToBounds = false
        button.layer.cornerCurve = .continuous
        button.layer.cornerRadius = 22

        if #available(iOS 26.0, *) {
            var configuration = UIButton.Configuration.glass()
            configuration.image = image
            configuration.cornerStyle = .capsule
            configuration.baseForegroundColor = .label
            button.configuration = configuration
        } else {
            var configuration = UIButton.Configuration.filled()
            configuration.image = image
            configuration.cornerStyle = .capsule
            configuration.baseForegroundColor = .label
            configuration.baseBackgroundColor = UIColor.systemBackground.withAlphaComponent(0.86)
            button.configuration = configuration
        }
    }

    private func setupBadge() {
        badgeLabel.translatesAutoresizingMaskIntoConstraints = false
        badgeLabel.isHidden = true
        badgeLabel.backgroundColor = UIColor(red: 0.70, green: 0.33, blue: 0.30, alpha: 1)
        badgeLabel.textColor = .white
        badgeLabel.font = UIFont.systemFont(ofSize: 10, weight: .bold)
        badgeLabel.textAlignment = .center
        badgeLabel.layer.cornerCurve = .continuous
        badgeLabel.layer.cornerRadius = 9
        badgeLabel.layer.masksToBounds = true
        badgeLabel.layer.zPosition = 10
        addSubview(badgeLabel)

        NSLayoutConstraint.activate([
            badgeLabel.topAnchor.constraint(equalTo: notificationsButton.topAnchor, constant: -4),
            badgeLabel.trailingAnchor.constraint(equalTo: notificationsButton.trailingAnchor, constant: 4),
            badgeLabel.heightAnchor.constraint(equalToConstant: 18),
            badgeLabel.widthAnchor.constraint(greaterThanOrEqualToConstant: 18),
        ])
    }

    private func setAccountImage(_ image: UIImage) {
        var configuration = accountButton.configuration
        configuration?.image = BonadoNativeDashboardControlsView.fittedCircularImage(image)
            .withRenderingMode(.alwaysOriginal)
        accountButton.configuration = configuration
    }

    private static func fittedCircularImage(_ image: UIImage) -> UIImage {
        let size = CGSize(width: 38, height: 38)
        let renderer = UIGraphicsImageRenderer(size: size)

        return renderer.image { _ in
            UIColor.secondarySystemBackground.setFill()
            UIBezierPath(ovalIn: CGRect(origin: .zero, size: size)).fill()

            let imageSize = image.size
            guard imageSize.width > 0, imageSize.height > 0 else { return }

            let scale = min(size.width / imageSize.width, size.height / imageSize.height)
            let drawSize = CGSize(
                width: imageSize.width * scale,
                height: imageSize.height * scale
            )
            let drawRect = CGRect(
                x: (size.width - drawSize.width) / 2,
                y: (size.height - drawSize.height) / 2,
                width: drawSize.width,
                height: drawSize.height
            )

            UIBezierPath(ovalIn: CGRect(origin: .zero, size: size)).addClip()
            image.draw(in: drawRect)
        }
    }

    private static func initialsImage(initials: String) -> UIImage {
        let size = CGSize(width: 44, height: 44)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { context in
            UIColor(red: 0.04, green: 0.50, blue: 0.44, alpha: 0.18).setFill()
            UIBezierPath(ovalIn: CGRect(origin: .zero, size: size)).fill()
            let attributes: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 17, weight: .bold),
                .foregroundColor: UIColor(red: 0.04, green: 0.50, blue: 0.44, alpha: 1),
            ]
            let text = NSString(string: initials)
            let textSize = text.size(withAttributes: attributes)
            text.draw(
                at: CGPoint(
                    x: (size.width - textSize.width) / 2,
                    y: (size.height - textSize.height) / 2
                ),
                withAttributes: attributes
            )
            _ = context
        }
    }

    @objc private func didTapNotifications() {
        delegate?.nativeDashboardControlsViewDidTapNotifications(self)
    }

    @objc private func didTapAccount() {
        delegate?.nativeDashboardControlsViewDidTapAccount(self)
    }
}

final class BonadoNativeTopControlsView: UIView {
    weak var delegate: BonadoNativeTopControlsViewDelegate?

    private let backButton = UIButton(type: .system)
    private let notificationsButton = UIButton(type: .system)
    private let settingsButton = UIButton(type: .system)
    private let trailingStack = UIStackView()
    private let badgeLabel = UILabel()
    private var tone = "surface"
    private var desiredVisible = false
    private let accentColor = UIColor(red: 0.04, green: 0.50, blue: 0.44, alpha: 1)

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupView()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupView()
    }

    func setVisible(_ visible: Bool, animated: Bool) {
        desiredVisible = visible

        if visible {
            isHidden = false
        }

        let changes = {
            self.alpha = visible ? 1 : 0
            self.transform = visible ? .identity : CGAffineTransform(translationX: 0, y: -6)
        }

        let completion: (Bool) -> Void = { _ in
            if !self.desiredVisible {
                self.isHidden = true
            }
        }

        if animated {
            UIView.animate(
                withDuration: 0.24,
                delay: 0,
                options: [.allowUserInteraction, .beginFromCurrentState, .curveEaseOut],
                animations: changes,
                completion: completion
            )
        } else {
            changes()
            completion(true)
        }
    }

    func setTone(_ nextTone: String, animated: Bool) {
        guard tone != nextTone else { return }
        tone = nextTone

        let changes = {
            self.applyButtonTone()
        }

        if animated {
            UIView.transition(
                with: self,
                duration: 0.2,
                options: [.transitionCrossDissolve, .allowUserInteraction],
                animations: changes
            )
        } else {
            changes()
        }
    }

    func setUnreadCount(_ count: Int) {
        badgeLabel.isHidden = count <= 0
        badgeLabel.text = count > 9 ? "9+" : "\(count)"
        badgeLabel.accessibilityLabel = count > 0 ? "\(count) unread notifications" : nil
    }

    private func setupView() {
        transform = CGAffineTransform(translationX: 0, y: -6)

        backButton.accessibilityLabel = "Back to dashboard"
        notificationsButton.accessibilityLabel = "Notifications"
        settingsButton.accessibilityLabel = "Trip settings"

        backButton.addTarget(self, action: #selector(didTapBack), for: .touchUpInside)
        notificationsButton.addTarget(self, action: #selector(didTapNotifications), for: .touchUpInside)
        settingsButton.addTarget(self, action: #selector(didTapSettings), for: .touchUpInside)

        configure(button: backButton, systemImage: "chevron.left")
        configure(button: notificationsButton, systemImage: "bell")
        configure(button: settingsButton, systemImage: "gearshape")

        trailingStack.axis = .horizontal
        trailingStack.alignment = .center
        trailingStack.spacing = 10
        trailingStack.translatesAutoresizingMaskIntoConstraints = false
        trailingStack.addArrangedSubview(notificationsButton)
        trailingStack.addArrangedSubview(settingsButton)

        addSubview(backButton)
        addSubview(trailingStack)
        setupBadge()

        NSLayoutConstraint.activate([
            backButton.leadingAnchor.constraint(equalTo: leadingAnchor),
            backButton.centerYAnchor.constraint(equalTo: centerYAnchor),
            backButton.widthAnchor.constraint(equalToConstant: 44),
            backButton.heightAnchor.constraint(equalToConstant: 44),

            trailingStack.trailingAnchor.constraint(equalTo: trailingAnchor),
            trailingStack.centerYAnchor.constraint(equalTo: centerYAnchor),

            notificationsButton.widthAnchor.constraint(equalToConstant: 44),
            notificationsButton.heightAnchor.constraint(equalToConstant: 44),
            settingsButton.widthAnchor.constraint(equalToConstant: 44),
            settingsButton.heightAnchor.constraint(equalToConstant: 44),
        ])

        applyButtonTone()
    }

    private func configure(button: UIButton, systemImage: String) {
        button.translatesAutoresizingMaskIntoConstraints = false
        button.tintColor = .label
        button.layer.shadowColor = UIColor.black.cgColor
        button.layer.shadowOffset = CGSize(width: 0, height: 8)
        button.layer.shadowOpacity = 0.12
        button.layer.shadowRadius = 18

        if #available(iOS 26.0, *) {
            var configuration = UIButton.Configuration.glass()
            configuration.image = UIImage(systemName: systemImage)
            configuration.cornerStyle = .capsule
            configuration.baseForegroundColor = .label
            configuration.contentInsets = NSDirectionalEdgeInsets(top: 10, leading: 10, bottom: 10, trailing: 10)
            button.configuration = configuration
        } else {
            var configuration = UIButton.Configuration.filled()
            configuration.image = UIImage(systemName: systemImage)
            configuration.cornerStyle = .capsule
            configuration.contentInsets = NSDirectionalEdgeInsets(top: 10, leading: 10, bottom: 10, trailing: 10)
            button.configuration = configuration
        }
    }

    private func setupBadge() {
        badgeLabel.translatesAutoresizingMaskIntoConstraints = false
        badgeLabel.isHidden = true
        badgeLabel.backgroundColor = UIColor(red: 0.70, green: 0.33, blue: 0.30, alpha: 1)
        badgeLabel.textColor = .white
        badgeLabel.font = UIFont.systemFont(ofSize: 10, weight: .bold)
        badgeLabel.textAlignment = .center
        badgeLabel.layer.cornerCurve = .continuous
        badgeLabel.layer.cornerRadius = 9
        badgeLabel.layer.masksToBounds = true
        notificationsButton.addSubview(badgeLabel)

        NSLayoutConstraint.activate([
            badgeLabel.topAnchor.constraint(equalTo: notificationsButton.topAnchor, constant: -4),
            badgeLabel.trailingAnchor.constraint(equalTo: notificationsButton.trailingAnchor, constant: 4),
            badgeLabel.heightAnchor.constraint(equalToConstant: 18),
            badgeLabel.widthAnchor.constraint(greaterThanOrEqualToConstant: 18),
        ])
    }

    private func applyButtonTone() {
        let foreground: UIColor = tone == "photo" ? .white : .label
        let fallbackBackground: UIColor =
            tone == "photo"
                ? UIColor.white.withAlphaComponent(0.82)
                : UIColor.systemBackground.withAlphaComponent(0.86)

        for button in [backButton, notificationsButton, settingsButton] {
            button.tintColor = foreground
            var configuration = button.configuration
            configuration?.baseForegroundColor = foreground

            if #unavailable(iOS 26.0) {
                configuration?.baseBackgroundColor = fallbackBackground
            }

            button.configuration = configuration
        }
    }

    @objc private func didTapBack() {
        delegate?.nativeTopControlsViewDidTapBack(self)
    }

    @objc private func didTapNotifications() {
        delegate?.nativeTopControlsViewDidTapNotifications(self)
    }

    @objc private func didTapSettings() {
        delegate?.nativeTopControlsViewDidTapSettings(self)
    }
}

final class BonadoNativeTripNavView: UIView {
    weak var delegate: BonadoNativeTripNavViewDelegate?

    private let navEffectView = UIVisualEffectView(effect: BonadoNativeTripNavView.makeNavEffect())
    private let navTintView = UIView()
    private let activePillView = UIVisualEffectView(effect: BonadoNativeTripNavView.makeActiveEffect())
    private let activePillTintView = UIView()
    private let touchLensView = UIVisualEffectView(effect: BonadoNativeTripNavView.makeTouchLensEffect())
    private let stackView = UIStackView()
    private let addButton = UIButton(type: .system)
    private var activePillLeadingConstraint: NSLayoutConstraint?
    private var activePillWidthConstraint: NSLayoutConstraint?
    private var touchLensCenterXConstraint: NSLayoutConstraint?
    private var tabButtons: [String: UIButton] = [:]
    private var activeTab = "entries"
    private var desiredVisible = false
    private let accentColor = UIColor(red: 0.04, green: 0.50, blue: 0.44, alpha: 1)

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupView()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupView()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        updateActivePill(animated: false)
        updateChromeColors()
    }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        updateChromeColors()
    }

    func setActiveTab(_ tab: String, animated: Bool) {
        guard activeTab != tab || tabButtons[tab] != nil else { return }
        activeTab = tab
        updateButtonStates()
        updateActivePill(animated: animated)
    }

    func setVisible(_ visible: Bool, animated: Bool) {
        desiredVisible = visible

        if visible {
            isHidden = false
        }

        let changes = {
            self.alpha = visible ? 1 : 0
            self.transform = visible ? .identity : CGAffineTransform(translationX: 0, y: 110)
        }

        let completion: (Bool) -> Void = { _ in
            if !self.desiredVisible {
                self.isHidden = true
            }
        }

        if animated {
            UIView.animate(
                withDuration: 0.42,
                delay: 0,
                usingSpringWithDamping: 0.9,
                initialSpringVelocity: 0.4,
                options: [.allowUserInteraction, .beginFromCurrentState],
                animations: changes,
                completion: completion
            )
        } else {
            changes()
            completion(true)
        }
    }

    func refreshAppearance() {
        updateChromeColors()
        updateButtonStates()
        setNeedsLayout()
    }

    private func setupView() {
        translatesAutoresizingMaskIntoConstraints = false
        transform = CGAffineTransform(translationX: 0, y: 110)

        setupNavIsland()
        setupAddButton()

        let rootStack = UIStackView(arrangedSubviews: [navEffectView, addButton])
        rootStack.axis = .horizontal
        rootStack.alignment = .center
        rootStack.spacing = 12
        rootStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rootStack)

        NSLayoutConstraint.activate([
            rootStack.leadingAnchor.constraint(equalTo: leadingAnchor),
            rootStack.trailingAnchor.constraint(equalTo: trailingAnchor),
            rootStack.topAnchor.constraint(equalTo: topAnchor),
            rootStack.bottomAnchor.constraint(equalTo: bottomAnchor),

            navEffectView.heightAnchor.constraint(equalToConstant: 68),
            navEffectView.widthAnchor.constraint(greaterThanOrEqualToConstant: 260),
            navEffectView.widthAnchor.constraint(lessThanOrEqualToConstant: 354),

            addButton.widthAnchor.constraint(equalToConstant: 58),
            addButton.heightAnchor.constraint(equalToConstant: 58),
        ])

        setupTouchLens()
        updateButtonStates()
        updateChromeColors()
    }

    private func setupNavIsland() {
        navEffectView.translatesAutoresizingMaskIntoConstraints = false
        navEffectView.clipsToBounds = true
        navEffectView.backgroundColor = .clear
        navEffectView.contentView.backgroundColor = .clear
        navEffectView.layer.cornerCurve = .continuous
        navEffectView.layer.cornerRadius = 34
        navEffectView.layer.borderWidth = 0.8
        navEffectView.layer.shadowColor = UIColor.black.cgColor
        navEffectView.layer.shadowOffset = CGSize(width: 0, height: 10)
        navEffectView.layer.shadowOpacity = 0.08
        navEffectView.layer.shadowRadius = 20

        navTintView.translatesAutoresizingMaskIntoConstraints = false
        navTintView.isUserInteractionEnabled = false
        navTintView.layer.cornerCurve = .continuous
        navTintView.layer.cornerRadius = 34
        navEffectView.contentView.addSubview(navTintView)

        activePillView.translatesAutoresizingMaskIntoConstraints = false
        activePillView.clipsToBounds = true
        activePillView.backgroundColor = .clear
        activePillView.contentView.backgroundColor = .clear
        activePillView.layer.cornerCurve = .continuous
        activePillView.layer.cornerRadius = 26
        activePillView.layer.borderWidth = 0.7
        navEffectView.contentView.addSubview(activePillView)

        activePillTintView.translatesAutoresizingMaskIntoConstraints = false
        activePillTintView.isUserInteractionEnabled = false
        activePillTintView.layer.cornerCurve = .continuous
        activePillTintView.layer.cornerRadius = 26
        activePillView.contentView.addSubview(activePillTintView)

        stackView.axis = .horizontal
        stackView.alignment = .fill
        stackView.distribution = .fillEqually
        stackView.spacing = 0
        stackView.translatesAutoresizingMaskIntoConstraints = false
        navEffectView.contentView.addSubview(stackView)

        let tabs: [(String, String, String)] = [
            ("entries", "Entries", "list.bullet.rectangle"),
            ("balances", "Balances", "arrow.left.arrow.right"),
            ("reports", "Reports", "chart.pie"),
        ]

        for tab in tabs {
            let button = makeTabButton(key: tab.0, title: tab.1, systemImage: tab.2)
            tabButtons[tab.0] = button
            stackView.addArrangedSubview(button)
        }

        activePillLeadingConstraint = activePillView.leadingAnchor.constraint(equalTo: navEffectView.contentView.leadingAnchor, constant: 8)
        activePillWidthConstraint = activePillView.widthAnchor.constraint(equalToConstant: 96)

        NSLayoutConstraint.activate([
            navTintView.leadingAnchor.constraint(equalTo: navEffectView.contentView.leadingAnchor),
            navTintView.trailingAnchor.constraint(equalTo: navEffectView.contentView.trailingAnchor),
            navTintView.topAnchor.constraint(equalTo: navEffectView.contentView.topAnchor),
            navTintView.bottomAnchor.constraint(equalTo: navEffectView.contentView.bottomAnchor),

            stackView.leadingAnchor.constraint(equalTo: navEffectView.contentView.leadingAnchor, constant: 8),
            stackView.trailingAnchor.constraint(equalTo: navEffectView.contentView.trailingAnchor, constant: -8),
            stackView.topAnchor.constraint(equalTo: navEffectView.contentView.topAnchor, constant: 8),
            stackView.bottomAnchor.constraint(equalTo: navEffectView.contentView.bottomAnchor, constant: -8),

            activePillTintView.leadingAnchor.constraint(equalTo: activePillView.contentView.leadingAnchor),
            activePillTintView.trailingAnchor.constraint(equalTo: activePillView.contentView.trailingAnchor),
            activePillTintView.topAnchor.constraint(equalTo: activePillView.contentView.topAnchor),
            activePillTintView.bottomAnchor.constraint(equalTo: activePillView.contentView.bottomAnchor),

            activePillView.topAnchor.constraint(equalTo: navEffectView.contentView.topAnchor, constant: 8),
            activePillView.bottomAnchor.constraint(equalTo: navEffectView.contentView.bottomAnchor, constant: -8),
            activePillLeadingConstraint!,
            activePillWidthConstraint!,
        ])

        let trackingGesture = UILongPressGestureRecognizer(target: self, action: #selector(handleNavTracking(_:)))
        trackingGesture.minimumPressDuration = 0
        trackingGesture.cancelsTouchesInView = true
        trackingGesture.delaysTouchesBegan = false
        trackingGesture.delaysTouchesEnded = false
        navEffectView.addGestureRecognizer(trackingGesture)
    }

    private func setupTouchLens() {
        touchLensView.translatesAutoresizingMaskIntoConstraints = false
        touchLensView.isUserInteractionEnabled = false
        touchLensView.backgroundColor = .clear
        touchLensView.contentView.backgroundColor = .clear
        touchLensView.alpha = 0
        touchLensView.clipsToBounds = true
        touchLensView.layer.cornerCurve = .continuous
        touchLensView.layer.cornerRadius = 42
        touchLensView.layer.borderWidth = 0.8
        touchLensView.layer.shadowColor = accentColor.cgColor
        touchLensView.layer.shadowOffset = CGSize(width: 0, height: 18)
        touchLensView.layer.shadowOpacity = 0.16
        touchLensView.layer.shadowRadius = 28
        touchLensView.transform = CGAffineTransform(scaleX: 0.82, y: 0.82)
        touchLensView.layer.zPosition = 4
        addSubview(touchLensView)

        touchLensCenterXConstraint = touchLensView.centerXAnchor.constraint(equalTo: navEffectView.leadingAnchor, constant: 42)

        NSLayoutConstraint.activate([
            touchLensView.widthAnchor.constraint(equalToConstant: 84),
            touchLensView.heightAnchor.constraint(equalToConstant: 84),
            touchLensView.centerYAnchor.constraint(equalTo: navEffectView.centerYAnchor, constant: 14),
            touchLensCenterXConstraint!,
        ])
    }

    private func setupAddButton() {
        addButton.translatesAutoresizingMaskIntoConstraints = false
        addButton.tintColor = .white
        addButton.layer.shadowColor = UIColor.black.cgColor
        addButton.layer.shadowOffset = CGSize(width: 0, height: 16)
        addButton.layer.shadowOpacity = 0.18
        addButton.layer.shadowRadius = 20
        addButton.addTarget(self, action: #selector(didTapAddExpense), for: .touchUpInside)

        if #available(iOS 26.0, *) {
            var configuration = UIButton.Configuration.prominentGlass()
            configuration.image = UIImage(systemName: "plus")
            configuration.baseForegroundColor = .white
            configuration.baseBackgroundColor = accentColor.withAlphaComponent(0.72)
            configuration.cornerStyle = .capsule
            addButton.configuration = configuration
        } else {
            var configuration = UIButton.Configuration.filled()
            configuration.image = UIImage(systemName: "plus")
            configuration.baseForegroundColor = .white
            configuration.baseBackgroundColor = accentColor
            configuration.cornerStyle = .capsule
            addButton.configuration = configuration
        }
    }

    private func makeTabButton(key: String, title: String, systemImage: String) -> UIButton {
        let button = UIButton(type: .system)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.tintColor = .secondaryLabel
        button.accessibilityIdentifier = "native-trip-nav-\(key)"
        button.tag = tabIndex(for: key)
        button.addTarget(self, action: #selector(didTapTab(_:)), for: .touchUpInside)

        var configuration = UIButton.Configuration.plain()
        configuration.image = UIImage(systemName: systemImage)
        configuration.imagePlacement = .top
        configuration.imagePadding = 1
        configuration.title = title
        configuration.contentInsets = NSDirectionalEdgeInsets(top: 6, leading: 4, bottom: 5, trailing: 4)
        configuration.baseForegroundColor = .secondaryLabel
        configuration.preferredSymbolConfigurationForImage = UIImage.SymbolConfiguration(pointSize: 17, weight: .semibold)
        configuration.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
            var outgoing = incoming
            outgoing.font = UIFont.systemFont(ofSize: 10, weight: .semibold)
            return outgoing
        }
        button.configuration = configuration

        return button
    }

    private func updateButtonStates() {
        for (key, button) in tabButtons {
            let selected = key == activeTab
            button.tintColor = selected ? accentColor : .label
            button.accessibilityTraits = selected ? [.button, .selected] : [.button]

            var configuration = button.configuration
            configuration?.baseForegroundColor = selected ? accentColor : .label
            button.configuration = configuration
        }
    }

    private func updateActivePill(animated: Bool) {
        guard let activeButton = tabButtons[activeTab],
              let activePillLeadingConstraint,
              let activePillWidthConstraint else {
            return
        }

        let frameInNav = activeButton.convert(activeButton.bounds, to: navEffectView.contentView)
        activePillLeadingConstraint.constant = frameInNav.minX
        activePillWidthConstraint.constant = frameInNav.width

        let changes = {
            self.navEffectView.contentView.layoutIfNeeded()
        }

        if animated {
            UIView.animate(
                withDuration: 0.34,
                delay: 0,
                usingSpringWithDamping: 0.86,
                initialSpringVelocity: 0.45,
                options: [.allowUserInteraction, .beginFromCurrentState],
                animations: changes
            )
        } else {
            changes()
        }
    }

    private func updateChromeColors() {
        let isDark = traitCollection.userInterfaceStyle == .dark

        navEffectView.backgroundColor = .clear
        navEffectView.contentView.backgroundColor = .clear
        navEffectView.layer.borderColor = (isDark
            ? UIColor.white.withAlphaComponent(0.14)
            : UIColor.white.withAlphaComponent(0.78)
        ).cgColor
        navEffectView.layer.shadowColor = UIColor.black.cgColor
        navEffectView.layer.shadowOpacity = isDark ? 0.24 : 0.10
        navTintView.backgroundColor = isDark
            ? UIColor.black.withAlphaComponent(0.10)
            : UIColor.white.withAlphaComponent(0.34)

        activePillView.backgroundColor = .clear
        activePillView.contentView.backgroundColor = .clear
        activePillView.layer.borderColor = (isDark
            ? UIColor.white.withAlphaComponent(0.10)
            : UIColor.white.withAlphaComponent(0.62)
        ).cgColor
        activePillTintView.backgroundColor = isDark
            ? UIColor.white.withAlphaComponent(0.08)
            : UIColor.systemGray6.withAlphaComponent(0.62)

        touchLensView.backgroundColor = .clear
        touchLensView.contentView.backgroundColor = .clear
        touchLensView.layer.borderColor = accentColor.withAlphaComponent(isDark ? 0.38 : 0.30).cgColor
    }

    private func tabKey(at locationInNav: CGPoint) -> String? {
        let locationInStack = navEffectView.convert(locationInNav, to: stackView)
        guard stackView.bounds.contains(locationInStack), stackView.bounds.width > 0 else {
            return nil
        }

        let index = Int(floor(locationInStack.x / (stackView.bounds.width / 3)))
        return tabKey(for: max(0, min(2, index)))
    }

    private func updateTouchLens(at locationInNav: CGPoint, visible: Bool) {
        guard navEffectView.bounds.width > 0 else { return }
        let clampedX = min(max(locationInNav.x, 42), navEffectView.bounds.width - 42)
        touchLensCenterXConstraint?.constant = clampedX

        for button in tabButtons.values {
            let centerInNav = button.convert(CGPoint(x: button.bounds.midX, y: button.bounds.midY), to: navEffectView)
            let influence = max(0, 1 - abs(centerInNav.x - clampedX) / 120)
            let scale = visible ? 1 + (0.14 * influence) : 1
            button.transform = CGAffineTransform(scaleX: scale, y: scale)
        }

        let changes = {
            self.layoutIfNeeded()
            self.touchLensView.alpha = visible ? 1 : 0
            self.touchLensView.transform = visible
                ? CGAffineTransform(scaleX: 1, y: 1)
                : CGAffineTransform(scaleX: 0.82, y: 0.82)
            if !visible {
                for button in self.tabButtons.values {
                    button.transform = .identity
                }
            }
        }

        UIView.animate(
            withDuration: visible ? 0.18 : 0.22,
            delay: 0,
            options: [.allowUserInteraction, .beginFromCurrentState, .curveEaseOut],
            animations: changes
        )
    }

    @objc private func handleNavTracking(_ recognizer: UILongPressGestureRecognizer) {
        let location = recognizer.location(in: navEffectView)

        switch recognizer.state {
        case .began, .changed:
            updateTouchLens(at: location, visible: true)
        case .ended:
            updateTouchLens(at: location, visible: false)
            if let tab = tabKey(at: location) {
                delegate?.nativeTripNavView(self, didSelectTab: tab)
            }
        case .cancelled, .failed:
            updateTouchLens(at: location, visible: false)
        default:
            break
        }
    }

    private func tabKey(for index: Int) -> String {
        switch index {
        case 1: return "balances"
        case 2: return "reports"
        default: return "entries"
        }
    }

    private func tabIndex(for key: String) -> Int {
        switch key {
        case "balances": return 1
        case "reports": return 2
        default: return 0
        }
    }

    @objc private func didTapTab(_ sender: UIButton) {
        delegate?.nativeTripNavView(self, didSelectTab: tabKey(for: sender.tag))
    }

    @objc private func didTapAddExpense() {
        delegate?.nativeTripNavViewDidTapAddExpense(self)
    }

    private static func makeNavEffect() -> UIVisualEffect {
        if #available(iOS 26.0, *) {
            let glass = UIGlassEffect(style: .regular)
            glass.tintColor = UIColor.white.withAlphaComponent(0.10)
            glass.isInteractive = true
            return glass
        }
        return UIBlurEffect(style: .systemChromeMaterial)
    }

    private static func makeActiveEffect() -> UIVisualEffect {
        if #available(iOS 26.0, *) {
            let glass = UIGlassEffect(style: .clear)
            glass.tintColor = UIColor.white.withAlphaComponent(0.08)
            glass.isInteractive = true
            return glass
        }
        return UIBlurEffect(style: .systemChromeMaterial)
    }

    private static func makeTouchLensEffect() -> UIVisualEffect {
        if #available(iOS 26.0, *) {
            let glass = UIGlassEffect(style: .regular)
            glass.tintColor = UIColor(red: 0.04, green: 0.50, blue: 0.44, alpha: 0.12)
            glass.isInteractive = true
            return glass
        }
        return UIBlurEffect(style: .systemThinMaterial)
    }
}
