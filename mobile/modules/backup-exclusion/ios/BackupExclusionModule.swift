import ExpoModulesCore

/// Marks the app's own folders as excluded from the device's iCloud (and computer) backup, so the
/// shop's data stays on this device as the owner chose. A folder's contents are excluded with it.
public class BackupExclusionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BackupExclusion")

    /// Excludes each folder (a file:// URL or a path) that exists; returns how many were marked.
    Function("exclude") { (paths: [String]) -> Int in
      var marked = 0
      for path in paths {
        var url = path.hasPrefix("file://")
          ? (URL(string: path) ?? URL(fileURLWithPath: path))
          : URL(fileURLWithPath: path)
        guard FileManager.default.fileExists(atPath: url.path) else { continue }
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        if (try? url.setResourceValues(values)) != nil { marked += 1 }
      }
      return marked
    }

    /// Whether a folder is excluded (for the backup screen).
    Function("isExcluded") { (path: String) -> Bool in
      let url = path.hasPrefix("file://")
        ? (URL(string: path) ?? URL(fileURLWithPath: path))
        : URL(fileURLWithPath: path)
      return (try? url.resourceValues(forKeys: [.isExcludedFromBackupKey]))?.isExcludedFromBackup ?? false
    }
  }
}
