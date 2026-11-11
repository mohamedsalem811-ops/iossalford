/** A plain file path, as SQLite expects ("/var/…/SQLite", not "file:///var/…"). */
export function toPath(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, '')).replace(/\/+$/, '');
}
