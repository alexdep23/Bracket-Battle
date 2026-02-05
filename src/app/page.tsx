// src/app/page.tsx
import BracketBoard from "@/components/BracketBoard";
import HomeHeaderActions from "@/components/HomeHeaderActions";
import NextRoundTimer from "@/components/NextRoundTimer";
import { supabase } from "@/lib/supabase";

const TZ = "America/New_York";

/** ET weekday: Sun=0 ... Sat=6 */
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

/** Round schedule in ET:
 *  Round 1: Sun–Mon
 *  Round 2: Tue–Wed
 *  Round 3: Thu–Fri
 *  Final:   Sat
 */
function activeRoundFromDay(now: Date) {
  const day = getETDay(now);
  if (day === 0 || day === 1) return 1;
  if (day === 2 || day === 3) return 2;
  if (day === 4 || day === 5) return 3;
  return 4;
}

export default async function Home() {
  // 1) Get active topic (your current approach)
  const { data: topic } = await supabase
    .from("topics")
    .select("*")
    .eq("status", "active")
    .order("starts_at", { ascending: false })
    .limit(1)
    .single();

  if (!topic) {
    return <main className="bb-page">No active topic</main>;
  }

  // 2) Determine current round from ET (no manual flips)
  const scheduledRound = activeRoundFromDay(new Date());

  // 3) Auto-advance DB to match scheduled round (safe if function exists)
  //    If the function is missing or errors, page still renders.
  try {
    const { error } = await supabase.rpc("advance_topic_to_round", {
      topic_id: topic.id,
      target_round: scheduledRound,
    });
    if (error) {
      console.warn("advance_topic_to_round error:", error);
    }
  } catch (e) {
    console.warn("advance_topic_to_round threw:", e);
  }

  // 4) Fetch matchups (AFTER advancing so winners are filled in)
  const { data: matchups } = await supabase
    .from("matchups")
    .select(
      `
      id,
      round,
      matchup_index,
      winner_entry_id,
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

  // 5) Counts for results bars
  const { data: voteRows } = await supabase
    .from("votes")
    .select("matchup_id, choice_entry_id")
    .in("matchup_id", matchupIds.length ? matchupIds : ["00000000-0000-0000-0000-000000000000"]);

  const counts: Record<string, number> = {};
  for (const v of voteRows ?? []) {
    const key = `${v.matchup_id}:${v.choice_entry_id}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }

  // Voting flag: BracketBoard already restricts voting to currentRound
  const votingOpen = true;

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
        votedMatchupIds={[]}          {/* client still loads voter’s votes */}
        matchups={(matchups ?? []) as any}
        counts={counts}
      />
    </main>
  );
}
