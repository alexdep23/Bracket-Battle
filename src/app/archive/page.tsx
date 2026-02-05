import BracketBoard from "@/components/BracketBoard";
import HomeHeaderActions from "@/components/HomeHeaderActions";
import NextRoundTimer from "@/components/NextRoundTimer";
import { supabase } from "@/lib/supabase";
import { cookies } from "next/headers";

const TZ = "America/New_York";
const VOTER_COOKIE = "bb_voter_id";

/**
 * Get the current day-of-week in Eastern Time
 */
function getETDay(now: Date) {
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
 * Determine which round is active based on ET weekday
 * Sun/Mon => 1, Tue/Wed => 2, Thu/Fri => 3, Sat => 4
 */
function activeRoundFromDay(now: Date) {
  const day = getETDay(now);
  if (day === 0 || day === 1) return 1;
  if (day === 2 || day === 3) return 2;
  if (day === 4 || day === 5) return 3;
  return 4;
}

export default async function Home() {
  const now = new Date();

  // ✅ pick the most recent topic that has started (no manual flipping)
  // NOTE: we keep using starts_at for topic selection only.
  const { data: topic } = await supabase
    .from("topics")
    .select("*")
    .eq("status", "active")
    .lte("starts_at", now.toISOString())
    .order("starts_at", { ascending: false })
    .limit(1)
    .single();

  if (!topic) {
    return <main className="bb-page">No active topic</main>;
  }

  // ✅ Round is determined by Eastern weekday (no manual flipping)
  const scheduledRound = activeRoundFromDay(now);

  // ✅ voting is always allowed for current round (client enforces per-round)
  const votingOpen = true;

  // ===== fetch matchups for topic =====
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

  // ===== counts for bars/results =====
  const { data: voteRows } = await supabase
    .from("votes")
    .select("matchup_id, choice_entry_id")
    .in("matchup_id", matchupIds.length ? matchupIds : ["00000000-0000-0000-0000-000000000000"]);

  const counts: Record<string, number> = {};
  for (const v of voteRows ?? []) {
    const key = `${v.matchup_id}:${v.choice_entry_id}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }

  // ===== pass votedMatchupIds from SERVER using cookie =====
  // ✅ Next.js 15+: cookies() is async
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
          <div className="bb-roundBig">Round {scheduledRound}</div>
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
        currentRound={scheduledRound}
        votingOpen={votingOpen}
        votedMatchupIds={votedMatchupIds}
        matchups={(matchups ?? []) as any}
        counts={counts}
      />
    </main>
  );
}
