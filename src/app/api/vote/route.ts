import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is missing`);
  return v;
}

export async function POST(req: Request) {
  try {
    const { matchupId, choiceEntryId, voterId, userId } = await req.json();

    if (!matchupId || !choiceEntryId || !voterId) {
      return NextResponse.json(
        { ok: false, error: "Missing matchupId/choiceEntryId/voterId" },
        { status: 400 }
      );
    }

    const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // 1) Fetch matchup to validate choiceEntryId is actually in it
    const { data: m, error: mErr } = await supabaseAdmin
      .from("matchups")
      .select("id, a_entry_id, b_entry_id")
      .eq("id", matchupId)
      .maybeSingle();

    if (mErr) {
      return NextResponse.json({ ok: false, error: mErr.message }, { status: 500 });
    }
    if (!m) {
      return NextResponse.json({ ok: false, error: "Matchup not found" }, { status: 404 });
    }

    if (choiceEntryId !== m.a_entry_id && choiceEntryId !== m.b_entry_id) {
      return NextResponse.json(
        { ok: false, error: "Invalid choice for this matchup" },
        { status: 400 }
      );
    }

    // 2) Prevent double voting by same voter for the same matchup
    // (If you already enforce this with a DB unique constraint, this still helps.)
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("votes")
      .select("id")
      .eq("matchup_id", matchupId)
      .eq("voter_id", voterId)
      .limit(1)
      .maybeSingle();

    if (exErr) {
      return NextResponse.json({ ok: false, error: exErr.message }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json({ ok: false, error: "Already voted" }, { status: 409 });
    }

    // 3) Insert vote (choice_entry_id is now guaranteed correct)
    const { error: insErr } = await supabaseAdmin.from("votes").insert({
      matchup_id: matchupId,
      choice_entry_id: choiceEntryId,
      voter_id: voterId,
      user_id: userId ?? null,
    });

    if (insErr) {
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
