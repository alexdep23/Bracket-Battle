import Link from "next/link";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Topic = {
  id: string;
  title: string | null;
  starts_at: string | null;
  status: string;
};

export default async function ArchivePage() {
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("topics")
    .select("id,title,starts_at,status")
    .not("starts_at", "is", null)
    .lte("starts_at", nowIso)
    .in("status", ["archived", "finished"])
    .order("starts_at", { ascending: false });

  if (error) {
    return <main className="bb-page">Error loading archive.</main>;
  }

  // ✅ Guard: drop any rows missing an id (should never happen, but prevents /undefined)
  const topics = ((data ?? []) as Topic[]).filter(
    (t) => typeof t.id === "string" && t.id.length > 0
  );

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
        </div>

        <div className="bb-bannerRight">
          <Link
            href="/"
            className="bb-iconBtn"
            aria-label="Back"
            style={{ textDecoration: "none" }}
          >
            ←
          </Link>
          <div
            className="bb-iconBtn bb-iconBtnMuted"
            aria-label="Archive"
            style={{ cursor: "default" }}
          >
            📁
          </div>
        </div>
      </div>

      <div className="bb-archiveGrid">
        {topics.length === 0 ? (
          <div style={{ opacity: 0.8, padding: "10px 6px" }}>
            No past tournaments yet.
          </div>
        ) : (
          topics.map((t) => {
            const started = t.starts_at
              ? new Date(t.starts_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : "Unknown";

            return (
              <Link key={t.id} href={`/archive/${t.id}`} className="bb-archiveTile">
                <div className="bb-archiveTileInner">
                  <div className="bb-archiveTitle">
                    {(t.title ?? "Untitled").toUpperCase()}
                  </div>
                  <div className="bb-archiveMeta">Started {started}</div>
                </div>

                <div className="bb-archiveCta">VIEW →</div>
              </Link>
            );
          })
        )}
      </div>
    </main>
  );
}