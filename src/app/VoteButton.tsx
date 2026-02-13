"use client";

import { useState } from "react";
import { getAnonVoterId } from "@/lib/anonVoter";

export default function VoteButton({
  matchupId,
  entryId,
  disabled,
  onVoted,
}: {
  matchupId: string;
  entryId: string;
  disabled?: boolean;
  onVoted?: (matchupId: string, entryId: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function vote() {
    if (disabled || loading) return;
    setLoading(true);

    try {
      const voterId = getAnonVoterId();

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

      onVoted?.(matchupId, entryId);
    } catch (err: any) {
      alert(`Vote failed: ${err?.message ?? String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={vote}
      disabled={disabled || loading}
      className="rounded-full px-3 py-1 bg-white/20 text-white"
    >
      {loading ? "…" : "Vote"}
    </button>
  );
}
