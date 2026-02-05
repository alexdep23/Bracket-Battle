import { supabase } from "@/lib/supabase";
import { DateTime } from "luxon";

const TZ = "America/New_York";

/**
 * Business rules (ET):
 * - Voting days: Mon/Wed/Fri
 * - Finalize round at/after 11:59 PM ET on voting days
 * - Advance round immediately after finalize (so after midnight ET, next round exists)
 */
export async function tickTopics(nowUtc = new Date()) {
  const nowET = DateTime.fromJSDate(nowUtc, { zone: "utc" }).setZone(TZ);

  const votingDay = isVotingDayET(nowET); // Mon/Wed/Fri
  const afterFinalizeTime = isAfterFinalizeTimeET(nowET); // >= 11:59 PM

  // 1) Find active topic
  const { data: activeTopic, error: activeErr } = await supabase
    .from("topics")
    .select("*")
    .eq("status", "active")
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeErr) throw activeErr;

  if (activeTopic) {
    // Only finalize on voting days at/after 11:59 PM ET
    if (votingDay && afterFinalizeTime) {
      await maybeFinalizeCurrentRound(activeTopic);
    }
    return activeTopic;
  }

  // 2) No active topic -> activate next queued topic whose starts_at <= now (in UTC)
  const { data: nextTopic, error: nextErr } = await supabase
    .from("topics")
    .select("*")
    .eq("status", "queued")
    .lte("starts_at", nowUtc.toISOString())
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextErr) throw nextErr;
  if (!nextTopic) return null;

  // Activate it
  const { data: activated, error: actErr } = await supabase
    .from("topics")
    .update({ status: "active", current_round: 1, finalized_round: 0 })
    .eq("id", nextTopic.id)
    .select("*")
    .single();

  if (actErr) throw actErr;

  // Ensure Round 1 matchups exist
  await ensureRound1Matchups(activated.id);

  return activated;
}

/** Mon/Wed/Fri in America/New_York */
function isVotingDayET(dt: DateTime) {
  // Luxon weekday: 1=Mon .. 7=Sun
  return dt.weekday === 1 || dt.weekday === 3 || dt.weekday === 5;
}

/** true if >= 11:59 PM ET */
function isAfterFinalizeTimeET(dt: DateTime) {
  const cutoff = dt.set({ hour: 23, minute: 59, second: 0, millisecond: 0 });
  return dt >= cutoff;
}

/**
 * Finalize the active topic's current round ONLY ONCE.
 * - picks winners based on vote totals (tie-breaker: lower seed wins)
 * - generates next round matchups
 * - advances current_round
 * - completes topic after round 4
 */
async function maybeFinalizeCurrentRound(topic: any) {
  const topicId = topic.id as string;
  const currentRound = topic.current_round as number;
  const finalizedRound = (topic.finalized_round ?? 0) as number;

  // Already finalized this round -> do nothing
  if (currentRound <= finalizedRound) return;

  // Fetch matchups for this round
  const { data: matchups, error: mErr } = await supabase
    .from("matchups")
    .select(
      `
      id,
      matchup_index,
      a_entry:entries!matchups_a_entry_id_fkey ( id, seed ),
      b_entry:entries!matchups_b_entry_id_fkey ( id, seed )
    `
    )
    .eq("topic_id", topicId)
    .eq("round", currentRound)
    .order("matchup_index", { ascending: true });

  if (mErr) throw mErr;
  if (!matchups || matchups.length === 0) return;

  const matchupIds = matchups.map((m: any) => m.id);

  // Fetch votes for these matchups
  const { data: votes, error: vErr } = await supabase
    .from("votes")
    .select("matchup_id, choice_entry_id")
    .in("matchup_id", matchupIds);

  if (vErr) throw vErr;

  // Count votes per matchup per entry
  const counts = new Map<string, number>(); // key = `${matchupId}:${entryId}`
  for (const v of votes ?? []) {
    const key = `${v.matchup_id}:${v.choice_entry_id}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // Decide winner per matchup
  const winners: (string | null)[] = [];
  for (const m of matchups as any[]) {
    const aId = m.a_entry?.id ?? null;
    const bId = m.b_entry?.id ?? null;

    if (!aId && !bId) {
      winners.push(null);
      continue;
    }
    if (aId && !bId) {
      winners.push(aId);
      continue;
    }
    if (!aId && bId) {
      winners.push(bId);
      continue;
    }

    const aVotes = counts.get(`${m.id}:${aId}`) ?? 0;
    const bVotes = counts.get(`${m.id}:${bId}`) ?? 0;

    if (aVotes > bVotes) winners.push(aId);
    else if (bVotes > aVotes) winners.push(bId);
    else {
      // Tie-breaker: lower seed wins (deterministic)
      const aSeed = m.a_entry?.seed ?? 999;
      const bSeed = m.b_entry?.seed ?? 999;
      winners.push(aSeed <= bSeed ? aId : bId);
    }
  }

  // If final round, complete topic
  if (currentRound >= 4) {
    const { error: doneErr } = await supabase
      .from("topics")
      .update({ status: "completed", finalized_round: currentRound })
      .eq("id", topicId);

    if (doneErr) throw doneErr;
    return;
  }

  // Generate next round matchups if missing
  const nextRound = currentRound + 1;

  const { data: existingNext } = await supabase
    .from("matchups")
    .select("id")
    .eq("topic_id", topicId)
    .eq("round", nextRound)
    .limit(1);

  if (!existingNext || existingNext.length === 0) {
    const nextRows = [];
    for (let i = 0; i < winners.length; i += 2) {
      nextRows.push({
        topic_id: topicId,
        round: nextRound,
        matchup_index: i / 2,
        a_entry_id: winners[i] ?? null,
        b_entry_id: winners[i + 1] ?? null,
      });
    }

    const { error: insErr } = await supabase.from("matchups").insert(nextRows);
    if (insErr) throw insErr;
  }

  // Advance topic and mark this round finalized
  const { error: updErr } = await supabase
    .from("topics")
    .update({ current_round: nextRound, finalized_round: currentRound })
    .eq("id", topicId);

  if (updErr) throw updErr;
}

/**
 * Creates round-1 matchups for a topic if they do not exist.
 */
async function ensureRound1Matchups(topicId: string) {
  const { data: existing } = await supabase
    .from("matchups")
    .select("id")
    .eq("topic_id", topicId)
    .eq("round", 1)
    .limit(1);

  if (existing && existing.length > 0) return;

  const { data: entries, error: entriesErr } = await supabase
    .from("entries")
    .select("id, seed")
    .eq("topic_id", topicId);

  if (entriesErr) throw entriesErr;
  if (!entries || entries.length < 2) return;

  const bySeed = new Map<number, string>();
  for (const e of entries as any[]) bySeed.set(e.seed, e.id);

  const pairs: Array<[number, number]> = [
    [1, 16],
    [8, 9],
    [5, 12],
    [4, 13],
    [6, 11],
    [3, 14],
    [7, 10],
    [2, 15],
  ];

  const rows = pairs.map(([aSeed, bSeed], i) => ({
    topic_id: topicId,
    round: 1,
    matchup_index: i,
    a_entry_id: bySeed.get(aSeed) ?? null,
    b_entry_id: bySeed.get(bSeed) ?? null,
  }));

  const { error: insertErr } = await supabase.from("matchups").insert(rows);
  if (insertErr) throw insertErr;
}
