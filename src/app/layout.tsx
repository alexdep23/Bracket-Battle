import "./globals.css";
import { Sora, Space_Grotesk } from "next/font/google";

const sora = Sora({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-sora",
});

const space = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="bb-site">
          <div className="bb-siteMain">{children}</div>

          <footer className="bb-footerWrap">
            <div className="bb-footerBubble" role="note" aria-label="Copyright notice">
              All images, titles, and trademarks are the property of their respective owners
              and are used for identification and informational purposes only. Bracket Battle is not
              affiliated with or endorsed by any rights holders.
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
