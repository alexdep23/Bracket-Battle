// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bracket Battle",
  description: "Vote through the bracket.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bb-site">
        <main className="bb-siteMain">{children}</main>

        <footer className="bb-footerWrap">
          <div className="bb-footerBubble">
            <div style={{ fontWeight: 900, opacity: 0.92 }}>
              Bracket Battle • Built with Next.js + Supabase
            </div>
            <div style={{ marginTop: 6, opacity: 0.72, lineHeight: 1.35 }}>
              Fan-made voting project. Not affiliated with or endorsed by any
              brand. All trademarks and images belong to their respective
              owners.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
