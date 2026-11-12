import ExpoModulesCore
import UIKit

/// Keyboard shortcuts on iPad with a hardware keyboard (⌘F search, ⌘N new piece). Holding ⌘ shows
/// them with their Arabic titles. A shortcut only sends its id to JavaScript, which decides what it
/// does on the screen that is open.
public class KeyCommandsModule: Module {
  private var observer: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("KeyCommands")
    Events("onKeyCommand")

    OnCreate {
      self.observer = NotificationCenter.default.addObserver(
        forName: SalfordKeyCommands.pressed, object: nil, queue: .main
      ) { [weak self] note in
        if let id = note.object as? String { self?.sendEvent("onKeyCommand", ["id": id]) }
      }
    }

    OnDestroy {
      if let observer = self.observer { NotificationCenter.default.removeObserver(observer) }
    }

    /// Replaces the shortcuts: [{ id, input, title }], each with ⌘.
    Function("setCommands") { (commands: [[String: String]]) in
      DispatchQueue.main.async { SalfordKeyCommands.install(commands) }
    }
  }
}

enum SalfordKeyCommands {
  static let pressed = Notification.Name("SalfordKeyCommandPressed")
  private static var installed: [UIKeyCommand] = []
  private static var list: [[String: String]] = []

  /// Adds the shortcuts to the window's root view controller: it is on the responder chain of every
  /// screen, whether or not a text field has the keyboard.
  static func install(_ commands: [[String: String]]) {
    list = commands
    guard let root = keyWindow()?.rootViewController else { return }
    for c in installed { root.removeKeyCommand(c) }
    installed = commands.compactMap { item in
      guard let id = item["id"], let input = item["input"] else { return nil }
      let command = UIKeyCommand(
        title: item["title"] ?? id,
        action: #selector(UIViewController.salfordKeyCommand(_:)),
        input: input,
        modifierFlags: .command,
        propertyList: id
      )
      command.wantsPriorityOverSystemBehavior = true
      return command
    }
    for c in installed { root.addKeyCommand(c) }
  }

  private static func keyWindow() -> UIWindow? {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }
  }
}

extension UIViewController {
  /// Every view controller answers the shortcuts, so a sheet open on top of the root still passes
  /// them on.
  @objc func salfordKeyCommand(_ sender: UIKeyCommand) {
    if let id = sender.propertyList as? String {
      NotificationCenter.default.post(name: SalfordKeyCommands.pressed, object: id)
    }
  }
}
