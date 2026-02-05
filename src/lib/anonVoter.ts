const COOKIE_NAME = "bb_voter_id";

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${oneYear}; SameSite=Lax`;
}

export function getAnonVoterId(): string {
  if (typeof window === "undefined") return "server";

  // 1) Prefer cookie (server + client shared)
  let id = readCookie(COOKIE_NAME);
  if (id) return id;

  // 2) Fallback to localStorage (older sessions)
  const KEY = "bracket_voter_id";
  id = localStorage.getItem(KEY);

  // 3) Create if missing
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }

  // 4) Sync into cookie so server sees it next load
  writeCookie(COOKIE_NAME, id);

  return id;
}
