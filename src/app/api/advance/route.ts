import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is missing`);
  return v;
}

export async function GET(req: Request) {
  try {
    // 1) Only allow Vercel Cron
    const isCron = req.headers.get("x-vercel-cron") === "1";
    if (!isCron) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    // 2) Create admin client
    const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // 3) Find the active topic automatically
    const { data: topic, error: topicError } = await supabaseAdmin
      .from("topics")
      .select("id, current_round")
      .lte("starts_at", new Date().toISOString())
      .lt("current_round", 4)
      .order("starts_at", { ascending: false })
      .limit(1)
      .single();

    if (topicError || !topic) {
      return NextResponse.json({
        ok: true,
        message: "No active topic to advance",
      });
    }

    // 4) Advance exactly one round
    const { data, error } = await supabaseAdmin.rpc("advance_topic", {
      p_topic_id: topic.id,
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    // 5) Done
    return NextResponse.json({
      ok: true,
      advanced_topic: topic.id,
      from_round: topic.current_round,
      result: data,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
