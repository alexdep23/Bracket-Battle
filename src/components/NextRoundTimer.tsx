"use client";

import { useEffect, useMemo, useState } from "react";

const TZ = "America/New_York";

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${h}:${pad(m)}:${pad(s)}`;
}

function getETParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: get("weekday"), // "Sun"..."Sat"
  };
}

function etWeekdayToNum(wd: string) {
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[wd] ?? 0;
}

/**
 * Next switch times (ET midnight):
 * - Sun/Mon -> Tue
 * - Tue/Wed -> Thu
 * - Thu/Fri -> Sat
 * - Sat     -> Sun
 */
function msUntilNextRoundSwitchET(now = new Date()) {
  const p = getETParts(now);
  const wd = etWeekdayToNum(p.weekday);

  // Build an "ET-local" Date object using the extracted ET parts.
  // (This avoids timezone math/hydration weirdness.)
  const etNow = new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, 0);

  // How many days to jump to reach the next switch day at 00:00
  let addDays = 1;

  if (wd === 0 || wd === 1) addDays = (2 - wd);      // Sun(0)->2, Mon(1)->1
  else if (wd === 2 || wd === 3) addDays = (4 - wd); // Tue(2)->2, Wed(3)->1
  else if (wd === 4 || wd === 5) addDays = (6 - wd); // Thu(4)->2, Fri(5)->1
  else addDays = 1;                                  // Sat(6)->Sun(0) (next day)

  const next = new Date(etNow);
  next.setDate(etNow.getDate() + addDays);
  next.setHours(0, 0, 0, 0);

  return next.getTime() - etNow.getTime();
}

export default function NextRoundTimer() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const countdown = useMemo(() => {
    if (!now) return "--:--:--";
    return formatCountdown(msUntilNextRoundSwitchET(now));
  }, [now]);

  return (
    <span className="bb-nextRound">
      <span className="bb-nextRoundLabel">Next round in</span>{" "}
      <span className="bb-nextRoundValue">{countdown}</span>{" "}
      <span className="bb-nextRoundTz">(ET)</span>
    </span>
  );
}
