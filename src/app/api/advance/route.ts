import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TZ = "America/New_York";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is missing`);
  return v;
}

function getETParts(now: Date): {
  weekday: number;
  hour: number;
  minute: number;
  dateKey: string;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const pick = (type: string) => parts.find((p) => p.type === type)?.value;

  const wd = pick("weekday") ?? "";
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const weekday = map[wd] ?? now.getDay();
  const year = pick("year") ?? "0000";
  const month = pick("month") ?? "00";
  const day = pick("day") ?? "00";
  const hour = Number(pick("hour") ?? "0");
  const minute = Number(pick("minute") ?? "0");

  return { weekday, hour, minute, dateKey: `${year}-${month}-${day}` };
}

/**
 * Round schedule in ET (changes at 12:00 AM ET):
 * Round 1: Sun–Mon
 * Round 2: Tue–Wed
 * Round 3: Thu–Fri
 * Final : Sat
 */
function scheduledRoundET(now: Date) {
  const { weekday } = getETParts(now);
  if (weekday === 0 || weekday === 1) return 1; // Sun/Mon
  if (weekday === 2 || weekday === 3) return 2; // Tue/Wed
  if (weekday === 4 || weekday === 5) return 3; // Thu/Fri
  return 4; // Sat
}

function clampRound(n: number) {
  return Math.min(4, Math.max(1, n));
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";

    // allow cron + (optional) manual admin testing via secret header
    const isCron = req.headers.get("x-vercel-cron") === "1";
    const secret = process.env.ADVANCE_SECRET;
    const provided = req.headers.get("x-advance-secret");

    if (!isCron && secret && provided !== secret) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const now = new Date();
    const et = getETParts(now);
    const targetRound = clampRound(scheduledRoundET(now));

    const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Helper: stamp last_advanced_at on a topic (run-once-per-day ET guard)
    async function stamp(topicId: string) {
      const { error } = await supabaseAdmin
        .from("topics")
        .update({ last_advanced_at: new Date().toISOString() })
        .eq("id", topicId);
      if (error) throw new Error(error.message);
    }

    // 1) Always try to activate due queued topic (safe no-op if none).
    // This preserves your Sunday behavior, but also helps if you ever manually
    // clear active topics: it will still activate the next due queued one.
    const { data: act, error: actErr } = await supabaseAdmin.rpc(
      "activate_next_topic"
    );
    if (actErr) {
      return NextResponse.json(
        { ok: false, error: actErr.message, et },
        { status: 500 }
      );
    }

    // 2) Find the active topic by status
    const { data: topic, error: topicErr } = await supabaseAdmin
      .from("topics")
      .select("id, title, current_round, last_advanced_at, starts_at")
      .eq("status", "active")
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (topicErr) {
      return NextResponse.json(
        { ok: false, error: topicErr.message, et },
        { status: 500 }
      );
    }

    if (!topic) {
      return NextResponse.json({
        ok: true,
        noop: true,
        reason: "no_active_topic",
        activated: act,
        et,
      });
    }

    // Run-once-per-ET-date guard
    if (!force && topic.last_advanced_at) {
      const lastET = getETParts(new Date(topic.last_advanced_at));
      if (lastET.dateKey === et.dateKey) {
        return NextResponse.json({
          ok: true,
          noop: true,
          reason: "already_ran_today_et",
          topic_id: topic.id,
          title: topic.title,
          last_advanced_at: topic.last_advanced_at,
          activated: act,
          et,
        });
      }
    }

    // 3) Catch-up loop: if behind schedule, advance until caught up.
    // This is the permanent fix that prevents missed Thu/Sat from leaving you stuck.
    let round = clampRound(Number(topic.current_round ?? 1));

    const steps: any[] = [];
    let advanced = 0;

    while (round < targetRound) {
      const { data: fin, error: finErr } = await supabaseAdmin.rpc(
        "finalize_round",
        {
          p_topic_id: topic.id,
          p_round: round,
        }
      );

      if (finErr) {
        return NextResponse.json(
          { ok: false, error: finErr.message, et },
          { status: 500 }
        );
      }

      const { data: adv, error: advErr } = await supabaseAdmin.rpc(
        "advance_topic",
        {
          p_topic_id: topic.id,
        }
      );

      if (advErr) {
        return NextResponse.json(
          { ok: false, error: advErr.message, et },
          { status: 500 }
        );
      }

      steps.push({ finalize_round: fin, advance_topic: adv });

      if (adv && (adv as any).skipped) {
        // e.g. round_not_complete, next_round_not_created
        break;
      }

      advanced += 1;
      round += 1;
    }

    // Stamp last_advanced_at once per ET day (even if we did nothing)
    await stamp(topic.id);

    // If nothing was due (already at/past target), still report helpful info
    if (advanced === 0 && round >= targetRound) {
      return NextResponse.json({
        ok: true,
        noop: true,
        reason: "already_at_or_past_target_round",
        topic_id: topic.id,
        title: topic.title,
        current_round: clampRound(Number(topic.current_round ?? 1)),
        target_round: targetRound,
        activated: act,
        et,
      });
    }

    return NextResponse.json({
      ok: true,
      topic_id: topic.id,
      title: topic.title,
      from_round: clampRound(Number(topic.current_round ?? 1)),
      to_round: round,
      target_round: targetRound,
      advanced,
      activated: act,
      steps,
      et,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}