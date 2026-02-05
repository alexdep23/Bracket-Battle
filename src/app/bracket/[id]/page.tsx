import BracketBoard from "@/components/BracketBoard";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

type Winner = { id: string; name: string; image_url: string | null } | null;

export default async function BracketByIdPage({
  params,
}: {
  params: { id: string };
}) {
  const topicId = params.id;

  const { data: topic, error: topicError } = await supabase
    .from("topics")
    .select("*")
    .eq("id", topicId)
    .single();

  if (topicError || !topic) {
    return (
      <main className="bb-page">
        <div className="bb-banner">
          <div className="bb-bannerLeft">
            <div className="bb-roundBig">Archive</div>
          </div>

          <div className="bb-bannerCenter">
            <div className="bb-logoTitle">Bracket Battle</div>
            <div className="bb-tourTitle">NOT FOUND</div>
            <div className="bb-meta">
              <span>That topic ID does not exist.</span>
            </div>
          </div>

          <div className="bb-bannerRight">
            <Link href="/archive" className="bb-iconBtn" aria-label="Back">
              ←
            </Link>
            <div className="bb-iconBtn" aria-hidden>
              🕒
            </div>
          </div>
        </div>

        <pre className="mt-6 rounded bg-black/10 p-4 text-sm overflow-auto text-white">
          {JSON.stringify({ topicError }, null, 2)}
        </pre>
      </main>
    );
  }

  const { data: matchups, error: matchupsError } = await supabase
    .from("matchups")
    .select(
      `
      id,
      round,
      matchup_index,
      winner_entry_id,
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

  // Counts across all voters
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

  // ✅ Winner: final matchup is round 4, matchup_index 1
  // We read winner_entry_id then fetch entry.
  let winner: Winner = null;

  const finalMatchup = (matchups ?? []).find(
    (m: any) => m.round === 4 && m.matchup_index === 1
  );

  if (finalMatchup?.winner_entry_id) {
    const { data: w } = await supabase
      .from("entries")
      .select("id, name, image_url")
      .eq("id", finalMatchup.winner_entry_id)
      .single();

    winner = w ?? null;
  }

  return (
    <main className="bb-page">
      <div className="bb-banner">
        <div className="bb-bannerLeft">
          <div className="bb-roundBig">
            Final Round {Math.min(4, topic.current_round ?? 4)}
          </div>
        </div>

        <div className="bb-bannerCenter">
          <div className="bb-logoTitle">Bracket Battle</div>
          <div className="bb-tourTitle">
            {topic.title?.toUpperCase?.() ?? topic.title}
          </div>

          <div className="bb-meta">
            <span>Starts {new Date(topic.starts_at).toLocaleString()}</span>
            <span className="bb-dot">•</span>
            <span className="bb-closed">Archive (read-only)</span>

            {/* ✅ Winner badge in meta */}
            <span className="bb-dot">•</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ opacity: 0.75 }}>Winner:</span>
              {winner?.image_url ? (
                <img
                  src={winner.image_url}
                  alt={winner.name}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    objectFit: "cover",
                    border: "1px solid rgba(255,255,255,.18)",
                  }}
                  loading="lazy"
                />
              ) : null}
              <span style={{ fontWeight: 900 }}>
                {winner?.name ?? "TBD"}
              </span>
            </span>
          </div>
        </div>

        <div className="bb-bannerRight">
          <Link href="/archive" className="bb-iconBtn" aria-label="Back to archive">
            ←
          </Link>
          <div className="bb-iconBtn" aria-hidden>
            🕒
          </div>
        </div>
      </div>

      {matchupsError ? (
        <pre className="mt-6 rounded bg-black/10 p-4 text-sm overflow-auto text-white">
          {JSON.stringify({ matchupsError }, null, 2)}
        </pre>
      ) : (
        <BracketBoard
          currentRound={5}   // ✅ show all results
          votingOpen={false} // ✅ no voting
          votedMatchupIds={[]}
          matchups={(matchups ?? []) as any}
          counts={counts}
        />
      )}
    </main>
  );
}
