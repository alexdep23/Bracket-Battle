import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is missing`);
  return v;
}

export async function GET(req: Request) {
  // allow only Vercel Cron calls
  const isCron = req.headers.get("x-vercel-cron") === "1";
  if (!isCron) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const topicId = env("CURRENT_TOPIC_ID");

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  const { data, error } = await supabaseAdmin.rpc("advance_topic", {
    p_topic_id: topicId,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, result: data });
}
