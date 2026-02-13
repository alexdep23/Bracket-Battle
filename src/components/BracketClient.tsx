"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { getAnonVoterId } from "@/lib/anonVoter";

type Entry = { id: string; name: string; seed: number };
type MatchupRow = {
  id: string;
  round: number;
  matchup_index: number;
  a_entry: Entry | null;
  b_entry: Entry | null;
};

type Topic = {
  id: string;
  title: string;
  starts_at: string;
  current_round: number;
};

type Props = {
  topic: Topic;
  votingOpen: boolean;
  matchups: MatchupRow[];
  counts: Record<string, number>;
  matchupsError: string | null;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.at(-1)?.[0] ?? "")).toUpperCase();
}

function bubbleFillPct(a: number, b: number, which: "a" | "b") {
  const t = a + b;
  if (!t) return 0;
  return Math.round(((which === "a" ? a : b) / t) * 100);
}

export default function BracketClient({
  topic,
  votingOpen,
  matchups,
  counts: initialCounts,
  matchupsError,
}: Props) {
  const [voterId, setVoterId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts);
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  useEffect(() => {
    setVoterId(getAnonVoterId());
  }, []);

  useEffect(() => {
    async function loadMyVotes() {
      if (!voterId || matchups.length === 0) return;

      const ids = matchups.map((m) => m.id);
      const { data } = await supabase
        .from("votes")
        .select("matchup_id")
        .eq("voter_id", voterId)
        .in("matchup_id", ids);

      const s = new Set<string>();
      for (const r of data ?? []) s.add(r.matchup_id);
      setVoted(s);
      setRevealed(new Set(s));
    }
    loadMyVotes();
  }, [voterId, matchups]);

  const rounds = useMemo(() => {
    const by = new Map<number, MatchupRow[]>();
    for (const m of matchups) {
      if (!by.has(m.round)) by.set(m.round, []);
      by.get(m.round)!.push(m);
    }
    for (const v of by.values()) v.sort((a, b) => a.matchup_index - b.matchup_index);
    return by;
  }, [matchups]);

  async function handleVote(matchupId: string, entryId: string) {
    if (!voterId) return;

    setRevealed((p) => new Set(p).add(matchupId));
    setVoted((p) => new Set(p).add(matchupId));
    setCounts((p) => ({
      ...p,
      [`${matchupId}:${entryId}`]: (p[`${matchupId}:${entryId}`] ?? 0) + 1,
    }));

    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          matchupId,
          choiceEntryId: entryId,
          voterId,
        }),
      });

      if (res.status === 409) return;

      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j?.error ?? "Vote failed");
    } catch (err: any) {
      setVoted((p) => {
        const n = new Set(p);
        n.delete(matchupId);
        return n;
      });
      setCounts((p) => {
        const n = { ...p };
        n[`${matchupId}:${entryId}`] = Math.max(
          0,
          (n[`${matchupId}:${entryId}`] ?? 1) - 1
        );
        return n;
      });
      alert(`Vote failed: ${err?.message ?? String(err)}`);
    }
  }

  return (
    <main className="min-h-screen p-6 sm:p-10">
      <div className="mx-auto max-w-[1400px]">
        {matchupsError && (
          <pre className="mb-4 rounded-xl bg-black/30 p-4 text-sm">
            {matchupsError}
          </pre>
        )}

        <div className="grid grid-cols-4 gap-8">
          {[1, 2, 3, 4].map((r) => {
            const ms = rounds.get(r) ?? [];
            return (
              <div key={r}>
                <div className="mb-2 text-sm text-white/70">
                  Round {r}
                </div>

                {ms.map((m) => {
                  let a = m.a_entry;
                  let b = m.b_entry;
                  if (a && b && a.seed > b.seed) [a, b] = [b, a];

                  const aCount = a ? counts[`${m.id}:${a.id}`] ?? 0 : 0;
                  const bCount = b ? counts[`${m.id}:${b.id}`] ?? 0 : 0;
                  const show = revealed.has(m.id);
                  const canVote = r === topic.current_round && votingOpen && !voted.has(m.id);

                  return (
                    <div key={m.id} className="mb-4">
                      {a && (
                        <button
                          disabled={!canVote}
                          onClick={() => handleVote(m.id, a.id)}
                        >
                          {a.seed}. {a.name} ({aCount})
                        </button>
                      )}
                      {b && (
                        <button
                          disabled={!canVote}
                          onClick={() => handleVote(m.id, b.id)}
                        >
                          {b.seed}. {b.name} ({bCount})
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
