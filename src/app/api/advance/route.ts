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
    const isCron = req.headers.get("x-vercel-cron") === "1";
    if (!isCron) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
    const topicId = mustEnv("CURRENT_TOPIC_ID");

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const { data, error } = await supabaseAdmin.rpc("advance_topic", {
      p_topic_id: topicId,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, result: data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
