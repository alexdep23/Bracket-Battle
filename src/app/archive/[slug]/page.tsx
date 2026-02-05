import { createClient } from "@supabase/supabase-js";
import BracketBoard from "@/components/BracketBoard";

function supabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default async function ArchiveTopicPage({
  params,
}: {
  params: { slug: string };
}) {
  // ✅ Guard against bad routes like /archive/undefined
  if (!params?.slug || params.slug === "undefined") {
    return <div className="p-6">Not found.</div>;
  }

  const supabase = supabaseAnon();

  const { data: topic, error: topicError } = await supabase
    .from("topics")
    .select("*")
    .eq("id", params.slug)
    .maybeSingle();

  if (topicError) {
    return <div className="p-6">Error: {topicError.message}</div>;
  }

  if (!topic) {
    return <div className="p-6">Not found.</div>;
  }

  const { data: matchups, error: matchupsError } = await supabase
    .from("matchups")
    .select(
      `
        id,
        round,
        matchup_index,
        a_entry:entries!matchups_a_entry_id_fkey(id,name,seed),
        b_entry:entries!matchups_b_entry_id_fkey(id,name,seed)
      `
    )
    .eq("topic_id", topic.id)
    .order("round", { ascending: true })
    .order("matchup_index", { ascending: true });

  if (matchupsError) {
    return <div className="p-6">Error: {matchupsError.message}</div>;
  }

  const { data: votes, error: votesError } = await supabase
    .from("votes")
    .select("matchup_id,entry_id")
    .eq("topic_id", topic.id);

  if (votesError) {
    return <div className="p-6">Error: {votesError.message}</div>;
  }

  const counts: Record<string, number> = {};

  for (const v of votes ?? []) {
    const key = `${v.matchup_id}:${v.entry_id}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">
        {(topic as any)?.title ?? (topic as any)?.name ?? "Tournament"}
      </h1>

      <div className="text-sm opacity-70 mb-6">Read-only</div>

      <BracketBoard
        currentRound={(topic as any)?.current_round ?? 1}
        votingOpen={false}
        votedMatchupIds={[]}
        matchups={(matchups as any) ?? []}
        counts={counts}
      />
    </div>
  );
}
