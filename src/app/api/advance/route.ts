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
 * Transition schedule (ET @ 00:00):
 * Sun: activate next topic (Round 1 starts)
 * Tue: advance to Round 2
 * Thu: advance to Round 3
 * Sat: advance to Final
 */
function transitionForWeekdayET(
  weekday: number
): { kind: "topic_start" | "advance_round" | "none"; targetRound?: number } {
  if (weekday === 0) return { kind: "topic_start" }; // Sunday
  if (weekday === 2) return { kind: "advance_round", targetRound: 2 }; // Tuesday
  if (weekday === 4) return { kind: "advance_round", targetRound: 3 }; // Thursday
  if (weekday === 6) return { kind: "advance_round", targetRound: 4 }; // Saturday
  return { kind: "none" };
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
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    const et = getETParts(now);
    const transition = transitionForWeekdayET(et.weekday);

    // On Hobby plan, cron is already daily at midnight ET (via 0 5 * * *).
    // So we do NOT need a minute-window gate. We just no-op on non-transition days.
    if (!force && transition.kind === "none") {
      return NextResponse.json({
        ok: true,
        noop: true,
        reason: "no_transition_today",
        transition,
        et,
      });
    }

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

    // === SUNDAY: activate next queued topic ===
    if (transition.kind === "topic_start" || (force && transition.kind !== "advance_round")) {
      // Activate next topic whose starts_at is due
      const { data: act, error: actErr } = await supabaseAdmin.rpc("activate_next_topic");

      if (actErr) {
        return NextResponse.json({ ok: false, error: actErr.message, et }, { status: 500 });
      }

      // If nothing activated, just no-op
      if (!act || (act as any).activated === false) {
        return NextResponse.json({
          ok: true,
          noop: true,
          reason: "no_due_queued_topic_to_activate",
          debug: act,
          et,
        });
      }

      // Stamp that newly activated topic so it won't re-run today
      const newTopicId = (act as any).topic_id as string | undefined;
      if (newTopicId) {
        await stamp(newTopicId);
      }

      return NextResponse.json({
        ok: true,
        activated: true,
        transition,
        debug: act,
        et,
      });
    }

    // === Tue/Thu/Sat: advance one round ===

    // Find the active topic by status (this is key!)
    const { data: topic, error: topicErr } = await supabaseAdmin
      .from("topics")
      .select("id, title, current_round, last_advanced_at")
      .eq("status", "active")
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (topicErr) {
      return NextResponse.json({ ok: false, error: topicErr.message }, { status: 500 });
    }

    if (!topic) {
      return NextResponse.json({ ok: true, noop: true, reason: "no_active_topic", et });
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
          et,
        });
      }
    }

    const currentRound = Number(topic.current_round ?? 1);
    const targetRound = transition.targetRound ?? currentRound;

    // If we're already at/past the target round, just stamp and stop
    if (!force && currentRound >= targetRound) {
      await stamp(topic.id);
      return NextResponse.json({
        ok: true,
        noop: true,
        reason: "already_at_or_past_target_round",
        topic_id: topic.id,
        title: topic.title,
        current_round: currentRound,
        target_round: targetRound,
        et,
      });
    }

    // Finalize winners for current round, then advance one round
    const { data: fin, error: finErr } = await supabaseAdmin.rpc("finalize_round", {
      p_topic_id: topic.id,
      p_round: currentRound,
    });

    if (finErr) {
      return NextResponse.json({ ok: false, error: finErr.message, et }, { status: 500 });
    }

    const { data: adv, error: advErr } = await supabaseAdmin.rpc("advance_topic", {
      p_topic_id: topic.id,
    });

    if (advErr) {
      return NextResponse.json({ ok: false, error: advErr.message, et }, { status: 500 });
    }

    // Stamp last_advanced_at no matter what
    await stamp(topic.id);

    if (adv && (adv as any).skipped) {
      return NextResponse.json({
        ok: true,
        advanced: 0,
        topic_id: topic.id,
        title: topic.title,
        current_round: currentRound,
        target_round: targetRound,
        skipped: (adv as any).skipped,
        debug: { finalize_round: fin, advance_topic: adv },
        et,
      });
    }

    return NextResponse.json({
      ok: true,
      advanced: 1,
      topic_id: topic.id,
      title: topic.title,
      from_round: currentRound,
      to_round: currentRound + 1,
      target_round: targetRound,
      debug: { finalize_round: fin, advance_topic: adv },
      et,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}