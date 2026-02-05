import BracketBoard from "@/components/BracketBoard";
import { supabase } from "@/lib/supabase";

function activeRoundFromDay(now: Date) {
  const day = now.getDay(); // 0=Sun..6=Sat
  // Sun(0)-Mon(1) => Round 1
  if (day === 0 || day === 1) return 1;
  // Tue(2)-Wed(3) => Round 2
  if (day === 2 || day === 3) return 2;
  // Thu(4)-Fri(5) => Round 3
  if (day === 4 || day === 5) return 3;
  // Sat(6) => Round 4
  return 4;
}

export default async function Home() {
  const { data: topic, error: topicError } = await supabase
    .from("topics")
    .select("*")
    .eq("status", "active")
    .order("starts_at", { ascending: false })
    .limit(1)
    .single();

  if (topicError || !topic) {
    return (
      <main className="min-h-screen p-8">
        <h1 className="text-3xl font-bold">Bracket Battle</h1>
        <p className="mt-4">
          No active topic found. Set a topic to <code>active</code> in Supabase.
        </p>
        <pre className="mt-6 rounded bg-black/5 p-4 text-sm overflow-auto">
          {JSON.stringify({ topicError }, null, 2)}
        </pre>
      </main>
    );
  }

  // ✅ “Always open” (you only get blocked if you already voted)
  const votingOpen = true;

  // ✅ Round determined by day schedule (your rule)
  const scheduledRound = activeRoundFromDay(new Date());

  const { data: matchups, error: matchupsError } = await supabase
    .from("matchups")
    .select(
      `
      id,
      round,
      matchup_index,
      a_entry:entries!matchups_a_entry_id_fkey (
        id,
        name,
        seed,
        description,
        image_url
      ),
      b_entry:entries!matchups_b_entry_id_fkey (
        id,
        name,
        seed,
        description,
        image_url
      )
    `
    )
    .eq("topic_id", topic.id)
    .order("round", { ascending: true })
    .order("matchup_index", { ascending: true });

  const matchupIds = (matchups ?? []).map((m: any) => m.id);

  const { data: voteRows } = await supabase
    .from("votes")
    .select("matchup_id, choice_entry_id")
    .in(
      "matchup_id",
      matchupIds.length ? matchupIds : ["00000000-0000-0000-0000-000000000000"]
    );

  const counts: Record<string, number> = {};
  for (const v of voteRows ?? []) {
    const key = `${v.matchup_id}:${v.choice_entry_id}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return (
    <main className="bb-page">
      <div className="bb-banner">
        <div className="bb-bannerLeft">
          {/* keep same look; just show scheduledRound */}
          <div className="bb-roundBig">Round {scheduledRound}</div>
        </div>

        <div className="bb-bannerCenter">
          <div className="bb-logoTitle">Bracket Battle</div>
          <div className="bb-tourTitle">
            {topic.title?.toUpperCase?.() ?? topic.title}
          </div>

          <div className="bb-meta">
            <span>Starts {new Date(topic.starts_at).toLocaleString()}</span>
            <span className="bb-dot">•</span>
            <span className={votingOpen ? "bb-open" : "bb-closed"}>
              {votingOpen ? "Voting open" : "Voting closed"}
            </span>
          </div>
        </div>

        <div className="bb-bannerRight">
          <div className="bb-iconBtn" aria-hidden>
            🕒
          </div>
          <div className="bb-iconBtn" aria-hidden>
            i
          </div>
        </div>
      </div>

      {matchupsError ? (
        <pre className="mt-6 rounded bg-black/10 p-4 text-sm overflow-auto text-white">
          {JSON.stringify({ matchupsError }, null, 2)}
        </pre>
      ) : (
        <BracketBoard
          currentRound={scheduledRound}
          votingOpen={votingOpen}
          votedMatchupIds={[]}
          matchups={(matchups ?? []) as any}
          counts={counts}
        />
      )}
    </main>
  );
}
