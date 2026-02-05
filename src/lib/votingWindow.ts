// src/lib/votingWindow.ts

export type VotingWindow = { open: Date; close: Date };

// Voting windows: Mon / Wed / Fri
// 12:00 AM → 11:59 PM **Eastern Time**
const OPEN_HOUR = 14;
const OPEN_MIN = 0;
const CLOSE_HOUR = 23;
const CLOSE_MIN = 59;

// ---- Timezone helpers (America/New_York) ----
const TZ = "America/New_York";

/**
 * Returns a Date representing "now" in Eastern Time
 */
function nowInET(now = new Date()) {
  return new Date(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(now)
  );
}

/**
 * Create a Date at a specific ET time on the same ET calendar day
 */
function atETTime(baseET: Date, h: number, m: number) {
  const d = new Date(baseET);
  d.setHours(h, m, 0, 0);
  return d;
}

export function getCurrentOrNextWindow(now = new Date()): {
  isOpen: boolean;
  window: VotingWindow;
} {
  const etNow = nowInET(now);
  const day = etNow.getDay(); // 0 Sun ... 6 Sat
  const isWindowDay = day === 1 || day === 3 || day === 5; // Mon/Wed/Fri

  // ---- If today is a window day, check if open ----
  if (isWindowDay) {
    const open = atETTime(etNow, OPEN_HOUR, OPEN_MIN);
    const close = atETTime(etNow, CLOSE_HOUR, CLOSE_MIN);

    if (etNow >= open && etNow <= close) {
      return { isOpen: true, window: { open, close } };
    }
  }

  // ---- Find the next window day ----
  const targetDays = [1, 3, 5];
  for (let add = 1; add <= 7; add++) {
    const cand = new Date(etNow);
    cand.setDate(etNow.getDate() + add);
    const d = cand.getDay();

    if (targetDays.includes(d)) {
      const open = atETTime(cand, OPEN_HOUR, OPEN_MIN);
      const close = atETTime(cand, CLOSE_HOUR, CLOSE_MIN);
      return { isOpen: false, window: { open, close } };
    }
  }

  // Fallback (should never happen)
  const open = atETTime(etNow, OPEN_HOUR, OPEN_MIN);
  const close = atETTime(etNow, CLOSE_HOUR, CLOSE_MIN);
  return { isOpen: false, window: { open, close } };
}

// ---- Countdown formatting ----
export function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${h}:${pad(m)}:${pad(s)}`;
}
