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

    const currentRound = Number(topic.current_round ?? 1);

    // already caught up
    if (currentRound >= targetRound) {
      return NextResponse.json({
        ok: true,
        topic_id: topic.id,
        current_round: currentRound,
        target_round: targetRound,
        advanced: 0,
      });
    }

    // advance until caught up (handles missed cron runs)
    let advanced = 0;
    let round = currentRound;

    while (round < targetRound) {
      const { data, error } = await supabaseAdmin.rpc("advance_topic", {
        p_topic_id: topic.id,
      });

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }

      // If function returns ok:false, stop and report
      if (data && (data as any).ok === false) {
        return NextResponse.json({ ok: false, result: data }, { status: 500 });
      }

      advanced += 1;
      round += 1;
    }

    return NextResponse.json({
      ok: true,
      topic_id: topic.id,
      from_round: currentRound,
      to_round: round,
      target_round: targetRound,
      advanced,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
