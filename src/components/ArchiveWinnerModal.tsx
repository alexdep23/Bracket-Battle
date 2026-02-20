"use client";

import { useEffect, useState } from "react";

type Winner = {
  id: string;
  name: string;
  seed: number;
  description?: string | null;
  image_url?: string | null;
};

export default function ArchiveWinnerModal({
  title,
  status,
  winner,
}: {
  title: string;
  status: string;
  winner: Winner | null;
}) {
  const [open, setOpen] = useState(true);

  // Auto-open when page loads (what you asked for)
  useEffect(() => {
    setOpen(true);
  }, []);

  if (!open) return null;

  const interrupted = status === "archived" && !winner;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{
          width: "min(720px, 100%)",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(12,12,14,0.98)",
          color: "rgba(255,255,255,0.92)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          <div style={{ fontWeight: 800, letterSpacing: 0.5 }}>
            {(title ?? "Tournament").toUpperCase()}
          </div>

          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "transparent",
              color: "rgba(255,255,255,0.9)",
              fontSize: 18,
              cursor: "pointer",
              lineHeight: "34px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 16 }}>
          {interrupted ? (
            <>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>
                Tournament archived early
              </div>
              <div style={{ opacity: 0.85, lineHeight: 1.45 }}>
                This tournament was paused due to a scheduling issue. The bracket
                below shows votes up to the point it was archived. No winner was
                declared.
              </div>
            </>
          ) : winner ? (
            <>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Winner</div>

              <div
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "flex-start",
                }}
              >
                {winner.image_url ? (
                  <img
                    src={winner.image_url}
                    alt={winner.name}
                    style={{
                      width: 92,
                      height: 92,
                      borderRadius: 14,
                      objectFit: "cover",
                      border: "1px solid rgba(255,255,255,0.12)",
                      flex: "0 0 auto",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 92,
                      height: 92,
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.06)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 900,
                      opacity: 0.85,
                      flex: "0 0 auto",
                    }}
                  >
                    #{winner.seed}
                  </div>
                )}

                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 20, fontWeight: 900 }}>
                    {winner.name}
                  </div>
                  <div style={{ opacity: 0.8, marginTop: 2 }}>
                    Seed #{winner.seed}
                  </div>

                  {winner.description ? (
                    <div style={{ marginTop: 10, opacity: 0.86, lineHeight: 1.45 }}>
                      {winner.description}
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>
                No winner recorded
              </div>
              <div style={{ opacity: 0.85, lineHeight: 1.45 }}>
                This tournament has no winner saved. You can still view the bracket
                results below.
              </div>
            </>
          )}

          <div style={{ marginTop: 14, opacity: 0.7, fontSize: 13 }}>
            Click ✕ to view the bracket.
          </div>
        </div>
      </div>
    </div>
  );
}