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
            Bracket Battle • Built with Next.js + Supabase
          </div>
        </footer>
      </body>
    </html>
  );
}
