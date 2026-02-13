"use client";

import { useState } from "react";
import { getAnonVoterId } from "@/lib/anonVoter";

export default function VoteButton({
  matchupId,
  entryId,
  disabled,
  onVoted,
  size = "normal",
}: {
  matchupId: string;
  entryId: string;
  disabled?: boolean;
  onVoted?: (matchupId: string, entryId: string) => void;
  size?: "normal" | "small";
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

      // duplicate vote: treat as already voted
      if (res.status === 409) return;

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error ?? "Vote failed");
      }

      // optimistic UI hook
      onVoted?.(matchupId, entryId);
    } catch (err: any) {
      alert(`Vote failed: ${err?.message ?? String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  // keep your sizing behavior (TeamBubble expects this)
  const pad = size === "small" ? "4px 8px" : "5px 9px";
  const fontSize = size === "small" ? 12 : 13;

  return (
    <button
      type="button"
      onClick={vote}
      disabled={disabled || loading}
      style={{
        fontFamily: "inherit",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.18)",
        background:
          disabled || loading
            ? "rgba(255,255,255,0.08)"
            : "rgba(255,255,255,0.14)",
        color: "rgba(255,255,255,0.88)",
        padding: pad,
        fontWeight: 800,
        fontSize,
        lineHeight: "16px",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.75 : 1,
        whiteSpace: "nowrap",
      }}
    >
      {loading ? "..." : "Vote"}
    </button>
  );
}
