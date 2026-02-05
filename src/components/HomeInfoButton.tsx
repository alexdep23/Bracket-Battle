"use client";

import { useEffect, useState } from "react";

const TZ = "America/New_York";

/**
 * Get date/time parts for a given timezone.
 */
function getTZParts(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = dtf.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  const weekday = get("weekday"); // Sun, Mon, ...
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const second = Number(get("second"));

  return { weekday, year, month, day, hour, minute, second };
}

/**
 * Get timezone offset in minutes for a given instant.
 * Uses timeZoneName: "shortOffset" which returns e.g. "GMT-5" or "GMT-4".
 */
function getOffsetMinutes(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = dtf.formatToParts(date);
  const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+0"; // e.g. "GMT-5"

  // Parse "GMT-5", "GMT+2", "GMT-05:00" etc.
  const m = tzName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!m) return 0;

  const sign = m[1] === "-" ? -1 : 1;
  const hh = Number(m[2]);
  const mm = Number(m[3] ?? "0");

  return sign * (hh * 60 + mm);
}

/**
 * Add days to a (year,month,day) in a TZ safely by anchoring at 12:00 UTC.
 * This avoids DST midnight weirdness.
 */
function addDaysInTZ(
  year: number,
  month: number,
  day: number,
  addDays: number,
  timeZone: string
) {
  const anchorUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const moved = new Date(anchorUTC.getTime() + addDays * 86400000);
  const p = getTZParts(moved, timeZone);
  return { year: p.year, month: p.month, day: p.day };
}

/**
 * Build the REAL UTC timestamp for a wall-time in TZ (y-m-d hh:mm:ss.ms).
 */
function tzWallTimeToUTCms(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number,
  timeZone: string
) {
  // Start with a UTC guess, then compute the TZ offset at that instant.
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms));
  const offsetMin = getOffsetMinutes(utcGuess, timeZone);
  return Date.UTC(year, month - 1, day, hour, minute, second, ms) - offsetMin * 60_000;
}

/**
 * End of the CURRENT voting window in New York time:
 * Sun–Mon -> end of Monday
 * Tue–Wed -> end of Wednesday
 * Thu–Fri -> end of Friday
 * Sat -> end of Saturday
 */
function getVotingWindowEndUTCmsNY(now: Date) {
  const p = getTZParts(now, TZ);

  // Map weekday string to 0..6
  const dowMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dow = dowMap[p.weekday] ?? 0;

  // Determine which date (in NY) the window ends on
  let endDate = { year: p.year, month: p.month, day: p.day };

  if (dow === 0) {
    // Sunday -> ends Monday (add 1 day)
    endDate = addDaysInTZ(p.year, p.month, p.day, 1, TZ);
  } else if (dow === 2) {
    // Tuesday -> ends Wednesday (add 1 day)
    endDate = addDaysInTZ(p.year, p.month, p.day, 1, TZ);
  } else if (dow === 4) {
    // Thursday -> ends Friday (add 1 day)
    endDate = addDaysInTZ(p.year, p.month, p.day, 1, TZ);
  }
  // Monday, Wednesday, Friday, Saturday -> ends today (no add)

  // End-of-day in NY: 23:59:59.999
  return tzWallTimeToUTCms(
    endDate.year,
    endDate.month,
    endDate.day,
    23,
    59,
    59,
    999,
    TZ
  );
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export default function HomeInfoButton() {
  const [open, setOpen] = useState(false);
  const [countdown, setCountdown] = useState("00:00:00");

  // 🔒 lock scrolling when modal is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // ⏱ countdown (REAL New York window end)
  useEffect(() => {
    if (!open) return;

    const tick = () => {
      const endUTCms = getVotingWindowEndUTCmsNY(new Date());
      const diff = Math.max(0, endUTCms - Date.now());

      const totalSeconds = Math.floor(diff / 1000);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;

      setCountdown(`${pad2(h)}:${pad2(m)}:${pad2(s)}`);
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="bb-iconBtn"
        aria-label="Info"
        onClick={() => setOpen(true)}
      >
        i
      </button>

      {open ? (
        <div
          className="bb-modalOverlay"
          role="dialog"
          aria-modal="true"
          aria-label="More Voting Info"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="bb-modalCard">
            <div className="bb-modalHeader">
              <div className="bb-modalTitle">More Voting Info</div>
              <button
                type="button"
                className="bb-modalClose"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="bb-modalBody">
              <div
                className="bb-modalSection"
                style={{ borderTop: 0, paddingTop: 0, marginTop: 0 }}
              >
                <div className="bb-modalLabel">Schedule (EST)</div>
                <div className="bb-modalText">
                  <div>
                    <b>Sun–Mon:</b> Round 1
                  </div>
                  <div>
                    <b>Tue–Wed:</b> Round 2
                  </div>
                  <div>
                    <b>Thu–Fri:</b> Round 3
                  </div>
                  <div>
                    <b>Saturday:</b> Final
                  </div>
                </div>
              </div>

              <div className="bb-modalSection">
                <div className="bb-modalLabel">Next round begins in</div>
                <div
                  className="bb-modalText"
                  style={{ fontSize: 20, fontWeight: 900, letterSpacing: 1 }}
                >
                  {countdown}
                </div>
              </div>

              <div className="bb-modalSection">
                <div className="bb-modalLabel">Rules</div>
                <div className="bb-modalText">
                  <div>• You can vote once per matchup.</div>
                  <div>• After voting, that matchup locks for you.</div>
                  <div>• Voting results appear immediately after you vote.</div>
                </div>
              </div>

              <div className="bb-modalSection">
                <div className="bb-modalLabel">Ideas & feedback</div>
                <div className="bb-modalText">
                  Email{" "}
                  <a
                    href="mailto:bracketbattle88@gmail.com?subject=Bracket%20Battle%20Feedback"
                    style={{ textDecoration: "underline" }}
                  >
                    bracketbattle88@gmail.com
                  </a>
                </div>
              </div>

              <div className="bb-modalSection">
                <div className="bb-modalLabel">Privacy</div>
                <div className="bb-modalText">
                  Votes are tied to an anonymous browser ID — not your name.
                </div>
              </div>
            </div>

            <div className="bb-modalFooter">
              <button
                type="button"
                className="bb-modalBtn"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
