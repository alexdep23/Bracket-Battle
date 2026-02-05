import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "bb_voter_id";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // If cookie already exists, do nothing
  if (req.cookies.get(COOKIE_NAME)?.value) return res;

  // Create a voter id cookie once per browser
  const id = crypto.randomUUID();

  res.cookies.set(COOKIE_NAME, id, {
    path: "/",
    httpOnly: false, // client needs to read it too
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return res;
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|.*\\..*).*)"],
};
