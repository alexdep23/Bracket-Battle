import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server-only key
);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");

  if (!process.env.ADVANCE_SECRET || secret !== process.env.ADVANCE_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const topicId = process.env.CURRENT_TOPIC_ID;
  if (!topicId) {
    return NextResponse.json({ ok: false, error: "Missing CURRENT_TOPIC_ID env var" }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin.rpc("advance_topic", {
    p_topic_id: topicId,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, result: data });
}
