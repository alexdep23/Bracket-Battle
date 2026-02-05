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

function msUntilNextMidnightET(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";

  const y = Number(get("year"));
  const mo = Number(get("month"));
  const d = Number(get("day"));
  const hh = Number(get("hour"));
  const mm = Number(get("minute"));
  const ss = Number(get("second"));

  const etNow = new Date(y, mo - 1, d, hh, mm, ss, 0);
  const next = new Date(etNow);
  next.setDate(etNow.getDate() + 1);
  next.setHours(0, 0, 0, 0);

  return next.getTime() - etNow.getTime();
}

export default function NextRoundTimer() {
  const [now, setNow] = useState<Date | null>(null);

  // ✅ Only start on client to avoid hydration mismatch
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const countdown = useMemo(() => {
    if (!now) return "--:--:--";
    return formatCountdown(msUntilNextMidnightET(now));
  }, [now]);

  return (
    <span className="bb-nextRound">
      <span className="bb-nextRoundLabel">Next round in</span>{" "}
      <span className="bb-nextRoundValue">{countdown}</span>{" "}
      <span className="bb-nextRoundTz">(ET)</span>
    </span>
  );
}
