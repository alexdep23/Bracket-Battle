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

function getETWeekday(now: Date) {
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
  }).format(now);

  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return map[wd] ?? now.getDay();
}

/**
 * Schedule (ET):
 * Round 1: Sun–Mon
 * Round 2: Tue–Wed
 * Round 3: Thu–Fri
 * Final : Sat
 */
function scheduledRoundET(now: Date) {
  const day = getETWeekday(now);
  if (day === 0 || day === 1) return 1;
  if (day === 2 || day === 3) return 2;
  if (day === 4 || day === 5) return 3;
  return 4;
}

export async function GET(req: Request) {
  try {
    // allow cron + (optional) manual admin testing via secret header
    const isCron = req.headers.get("x-vercel-cron") === "1";
    const secret = process.env.ADVANCE_SECRET;
    const provided = req.headers.get("x-advance-secret");

    if (!isCron && secret && provided !== secret) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const targetRound = scheduledRoundET(now);

    // ✅ Find the active topic (latest started). Ignore rows with null starts_at.
    const { data: topic, error: topicErr } = await supabaseAdmin
      .from("topics")
      .select("id, current_round, starts_at, title")
      .not("starts_at", "is", null)
      .lte("starts_at", now.toISOString())
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (topicErr) {
      return NextResponse.json({ ok: false, error: topicErr.message }, { status: 500 });
    }

    if (!topic) {
      return NextResponse.json({ ok: true, message: "No active topic to advance" });
    }

    // already caught up
    let round = Number(topic.current_round ?? 1);
    if (round >= targetRound) {
      return NextResponse.json({
        ok: true,
        topic_id: topic.id,
        current_round: round,
        target_round: targetRound,
        advanced: 0,
      });
    }

    // advance until caught up (handles missed cron runs)
    let advanced = 0;
    let lastSkip: any = null;

    while (round < targetRound) {
      // ✅ NEW: finalize winners for the current round (sets matchups.winner_entry_id)
      const { data: fin, error: finErr } = await supabaseAdmin.rpc("finalize_round", {
        p_topic_id: topic.id,
        p_round: round,
      });

      if (finErr) {
        return NextResponse.json({ ok: false, error: finErr.message }, { status: 500 });
      }

      // ✅ Now advance one round (this creates next-round matchups + bumps topics.current_round)
      const { data: adv, error: advErr } = await supabaseAdmin.rpc("advance_topic", {
        p_topic_id: topic.id,
      });

      if (advErr) {
        return NextResponse.json({ ok: false, error: advErr.message }, { status: 500 });
      }

      // If we still can't advance, stop here (means winners are still missing)
      if (adv && (adv as any).skipped === "round_not_complete") {
        lastSkip = { finalize_round: fin, advance_topic: adv };
        break;
      }

      advanced += 1;
      round += 1;
    }

    return NextResponse.json({
      ok: true,
      topic_id: topic.id,
      from_round: Number(topic.current_round ?? 1),
      to_round: round,
      target_round: targetRound,
      advanced,
      stopped_reason: lastSkip ? "round_not_complete" : null,
      debug: lastSkip,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
