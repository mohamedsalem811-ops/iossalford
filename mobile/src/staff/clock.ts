/**
 * The clock guard (phase S3): the app remembers the latest time it has seen on this device. If
 * the device clock goes back before it (to get around the 24 hours for returns, or to date a sale
 * in the past), every action that changes data is refused and the owner is alerted, until the
 * clock is put right or the owner accepts the device's time. Times are absolute (milliseconds),
 * so travelling to another time zone never counts as going back.
 */
export type ClockStore = { get(): string | null; set(value: string): void };

/** A few minutes either way are normal (the clock syncing with the network). */
export const CLOCK_TOLERANCE_MS = 10 * 60_000;
/** The latest time is saved at most once a minute (each save is a Keychain write). */
const SAVE_EVERY_MS = 60_000;

export class ClockGuard {
  private latestMs: number | null;
  private savedMs: number | null;
  private reported = false;

  constructor(
    private readonly store: ClockStore,
    /** Called once when the clock is first found behind (the owner's alert and the log line). */
    public onBack?: (latest: Date, now: Date) => void,
  ) {
    const raw = Number(store.get());
    this.latestMs = Number.isFinite(raw) && raw > 0 ? raw : null;
    this.savedMs = this.latestMs;
  }

  /** The latest time seen, or null before the first. */
  latest(): Date | null {
    return this.latestMs === null ? null : new Date(this.latestMs);
  }

  /** True when the device clock is now earlier than the latest time seen (beyond a few minutes). */
  behind(now: Date): boolean {
    return this.latestMs !== null && now.getTime() < this.latestMs - CLOCK_TOLERANCE_MS;
  }

  /** Remembers `now` when it is later than anything seen so far. */
  seen(now: Date) {
    const t = now.getTime();
    if (this.latestMs !== null && t <= this.latestMs) return;
    this.latestMs = t;
    this.reported = false;
    if (this.savedMs === null || t - this.savedMs >= SAVE_EVERY_MS) this.save(t);
  }

  /**
   * Refuses (with the Arabic message) when the clock is behind; otherwise remembers the time.
   * Called first by every action that changes data.
   */
  check(now: Date): string | null {
    if (this.behind(now)) {
      if (!this.reported) {
        this.reported = true;
        this.onBack?.(new Date(this.latestMs!), now);
      }
      return clockMessage(new Date(this.latestMs!));
    }
    this.seen(now);
    return null;
  }

  /** The owner says the device's time is right: it becomes the latest time seen. */
  accept(now: Date) {
    this.latestMs = now.getTime();
    this.reported = false;
    this.save(this.latestMs);
  }

  private save(t: number) {
    try {
      this.store.set(String(t));
      this.savedMs = t;
    } catch {
      // Kept in memory for this run; the next save tries again.
    }
  }
}

export function clockMessage(latest: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const when = `${latest.getFullYear()}-${pad(latest.getMonth() + 1)}-${pad(latest.getDate())} ${pad(latest.getHours())}:${pad(latest.getMinutes())}`;
  return `ساعة الجهاز أقدم من آخر وقت سجّله التطبيق (${when}). صحّح التاريخ والوقت من إعدادات الجهاز، أو يقبل المالك وقت الجهاز من الإدارة.`;
}
