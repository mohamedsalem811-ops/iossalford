/**
 * The error log on the device: every unexpected error (a screen that failed, a backup that could
 * not be saved, an error nothing else caught) is written here, with when and where. Nothing is
 * sent anywhere: the owner can share the file from Settings, so each problem can be found and
 * fixed once. Kept in the app's private folder and limited in size (the newest entries stay).
 */
import Constants from 'expo-constants';
import { File } from 'expo-file-system';

import { privateRoot } from './storage';

export const MAX_ENTRIES = 200;

export type LogEntry = {
  at: string;
  where: string;
  message: string;
  stack?: string;
  version?: string;
};

const logFile = () => new File(privateRoot(), 'errors.log');

/** One line per entry; entries beyond MAX_ENTRIES are dropped, oldest first. */
export function appendEntry(existing: string, entry: LogEntry, max = MAX_ENTRIES): string {
  const lines = existing.split('\n').filter(Boolean);
  lines.push(JSON.stringify(entry));
  return lines.slice(-max).join('\n') + '\n';
}

export function parseLog(text: string): LogEntry[] {
  return text
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l) as LogEntry;
      } catch {
        return null;
      }
    })
    .filter((e): e is LogEntry => e !== null);
}

const describe = (error: unknown) =>
  error instanceof Error
    ? { message: error.message || error.name, stack: error.stack?.slice(0, 2000) }
    : { message: String(error) };

/** Writes an error to the log. Never throws: logging must not cause a second problem. */
export function logError(where: string, error: unknown, now: Date = new Date()) {
  try {
    const f = logFile();
    const existing = f.exists ? f.textSync() : '';
    f.writeSync(
      appendEntry(existing, {
        at: now.toISOString(),
        where,
        version: Constants.expoConfig?.version,
        ...describe(error),
      }),
    );
  } catch {
    // Nothing more to do: the app goes on.
  }
}

/** The entries, newest first. */
export function readLog(): LogEntry[] {
  try {
    const f = logFile();
    return f.exists ? parseLog(f.textSync()).reverse() : [];
  } catch {
    return [];
  }
}

export function clearLog() {
  try {
    const f = logFile();
    if (f.exists) f.delete();
  } catch {
    // Nothing more to do.
  }
}

/** The log file's address, for sharing (null when empty). */
export function logFileUri(): string | null {
  const f = logFile();
  return f.exists ? f.uri : null;
}

let installed = false;

/**
 * Errors nothing else caught are written to the log before React Native's own handling (which, for
 * a fatal error, closes the app as before; the screens' retry screens catch the rest).
 */
export function installGlobalErrorLog() {
  if (installed) return;
  installed = true;
  const g = globalThis as {
    ErrorUtils?: {
      getGlobalHandler(): (e: unknown, fatal?: boolean) => void;
      setGlobalHandler(h: (e: unknown, fatal?: boolean) => void): void;
    };
  };
  const utils = g.ErrorUtils;
  if (!utils) return;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, fatal) => {
    logError(fatal ? 'خطأ أغلق التطبيق' : 'خطأ غير متوقع', error);
    previous(error, fatal);
  });
}
