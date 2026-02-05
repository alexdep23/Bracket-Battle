import BracketBoard from "@/components/BracketBoard";
import HomeHeaderActions from "@/components/HomeHeaderActions";
import NextRoundTimer from "@/components/NextRoundTimer";
import { supabase } from "@/lib/supabase";
import { cookies } from "next/headers";

const TZ = "America/New_York";
const VOTER_COOKIE = "bb_voter_id";

/** "YYYY-MM-DD" in a specific timezone */
function tzDayKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

/** Days difference between two dates, comparing their calendar day in TZ */
function diffDaysInTZ(a: Date, b: Date, timeZone: string) {
  const aKey = tzDayKey(a, timeZone);
  const bKey = tzDayKey(b, timeZone);

  const [ay, am, ad] = aKey.split("-").map(Number);
  const [by, bm, bd] = bKey.split("-").map(Number);

  const aUTC = Date.UTC(ay, am - 1, ad);
  const bUTC = Date.UTC(by, bm - 1, bd);

  return Math.floor((aUTC - bUTC) / 86400000);
}

function roundFromStart(now: Date, startsAt: Date) {
  const days = diffDaysInTZ(now, startsAt, TZ);

  if (days <= 1) return 1;
  if (days <= 3) return 2;
  if (days <= 5) return 3;
  return 4;
}

export default async function Home() {
  const now = new Date();

  // ✅ Auto-pick the "current" topic: most recent that already started
  const { data: topic } = await supabase
    .from("topics")
    .select("*")
    .lte("starts_at", now.toISOString())
    .order("starts_at", { ascending: false })
    .limit(1)
    .single();

  if (!topic) {
    return <main className="bb-page">No active topic</main>;
  }

  const startsAt = new Date(topic.starts_at);
  const currentRound = roundFromStart(now, startsAt);

  // ✅ Auto rounds → no manual open/close needed
  const votingOpen = true;

  const { data: matchups } = await supabase
    .from("matchups")
    .select(
      `
      id,
      round,
      matchup_index,
      a_entry:entries!matchups_a_entry_id_fkey (
        id, name, seed, description, image_url
      ),
      b_entry:entries!matchups_b_entry_id_fkey (
        id, name, seed, description, image_url
      )
    `
    )
    .eq("topic_id", topic.id)
    .order("round", { ascending: true })
    .order("matchup_index", { ascending: true });

  const matchupIds = (matchups ?? []).map((m: any) => m.id);

  // ===== counts for results/fill =====
  const { data: voteRows } = await supabase
    .from("votes")
    .select("matchup_id, choice_entry_id")
    .in("matchup_id", matchupIds.length ? matchupIds : ["000"]);

  const counts: Record<string, number> = {};
  for (const v of voteRows ?? []) {
    const key = `${v.matchup_id}:${v.choice_entry_id}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }

  // ✅ FIX: cookies() is async in your Next, so await it
  const cookieStore = await cookies();
  const voterId = cookieStore.get(VOTER_COOKIE)?.value ?? null;

  let votedMatchupIds: string[] = [];
  if (voterId && matchupIds.length) {
    const { data: votedRows } = await supabase
      .from("votes")
      .select("matchup_id")
      .eq("voter_id", voterId)
      .in("matchup_id", matchupIds);

    votedMatchupIds = Array.from(
      new Set((votedRows ?? []).map((r: any) => r.matchup_id))
    );
  }

  return (
    <main className="bb-page">
      <div className="bb-banner">
        {/* LEFT */}
        <div className="bb-bannerLeft">
          <div className="bb-roundBig">Round {currentRound}</div>
        </div>

        {/* CENTER */}
        <div className="bb-bannerCenter">
          <div className="bb-bannerLogo">
            <img src="/logo.png" alt="Bracket Battle" className="bb-logoImg" />
          </div>

          <div className="bb-bannerTopic">
            <div className="bb-tourTitle">
              {topic.title?.toUpperCase?.() ?? topic.title}
            </div>
          </div>

          <div className="bb-bannerMeta">
            <div className="bb-meta">
              <NextRoundTimer />
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="bb-bannerRight">
          <HomeHeaderActions />
        </div>
      </div>

      <BracketBoard
        currentRound={currentRound}
        votingOpen={votingOpen}
        votedMatchupIds={votedMatchupIds}
        matchups={(matchups ?? []) as any}
        counts={counts}
      />
    </main>
  );
}
