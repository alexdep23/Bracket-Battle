"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { getAnonVoterId } from "@/lib/anonVoter";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

      const { error } = await supabase.from("votes").insert({
        matchup_id: matchupId,
        choice_entry_id: entryId,
        voter_id: voterId,
      });

      if (error) {
        const isDuplicate =
          (error as any)?.code === "23505" ||
          String(error.message).toLowerCase().includes("duplicate");

        if (!isDuplicate) {
          console.error(error);
          alert(error.message);
          return;
        }
      }

      // ✅ optimistic UI update (this is what drives the fill animation)
      onVoted?.(matchupId, entryId);
    } finally {
      setLoading(false);
    }
  }

  const pad = size === "small" ? "4px 8px" : "5px 9px";
  const fontSize = size === "small" ? 12 : 13;

  return (
    <button
      type="button"
      onClick={vote}
      disabled={disabled || loading}
      style={{
        fontFamily: "inherit", // ✅ matches site font
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
