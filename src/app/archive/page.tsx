// src/app/archive/page.tsx
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type TopicRow = {
  id: string;
  title: string;
  starts_at: string;
  status: string | null;
};

export default async function ArchivePage() {
  const nowIso = new Date().toISOString();

  // Only show topics that have started (no future topics)
  const { data: topics, error } = await supabase
    .from("topics")
    .select("id,title,starts_at,status")
    .lte("starts_at", nowIso)
    .order("starts_at", { ascending: false });

  if (error) {
    return (
      <main className="bb-page p-6 text-white">
        <pre className="rounded bg-black/20 p-4 text-sm overflow-auto">
          {JSON.stringify({ error: error.message }, null, 2)}
        </pre>
      </main>
    );
  }

  return (
    <main className="bb-page">
      <div className="bb-banner">
        <div className="bb-bannerLeft">
          <div className="bb-roundBig">Archive</div>
        </div>

        <div className="bb-bannerCenter">
          <div className="bb-bannerLogo">
            <img src="/logo.png" alt="Bracket Battle" className="bb-logoImg" />
          </div>

          <div className="bb-bannerTopic">
            <div className="bb-tourTitle">PAST TOURNAMENTS</div>
          </div>

          {/* remove “read-only” line entirely */}
        </div>

        <div className="bb-bannerRight">
          <Link href="/" className="bb-iconBtn" aria-label="Back home">
            ←
          </Link>
          <div className="bb-iconBtn" aria-hidden>
            🗂️
          </div>
        </div>
      </div>

      <div className="bb-archiveGrid">
        {(topics ?? []).map((t) => (
          <Link key={t.id} href={`/archive/${t.id}`} className="bb-archiveTile">
            <div className="bb-archiveTileInner">
              <div className="bb-archiveTitle">
                {t.title?.toUpperCase?.() ?? t.title}
              </div>

              <div className="bb-archiveMeta">
                Started{" "}
                {new Date(t.starts_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </div>

            <div className="bb-archiveCta">VIEW →</div>
          </Link>
        ))}

        {(!topics || topics.length === 0) && (
          <div className="p-6 text-white/80">No past tournaments yet.</div>
        )}
      </div>
    </main>
  );
}
