import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "prep_session";
const SECRET = process.env.AUTH_SECRET || "prep-ai-dev-secret-change-me";

// Edge-compatible HMAC-SHA256 verification using Web Crypto
async function signPayload(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyToken(token: string): Promise<boolean> {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = await signPayload(payload);
  return expected === sig;
}

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/interview",
  "/group-discussion",
  "/analytics",
  "/profile",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtectedPage = PROTECTED_PREFIXES.some((p) =>
    pathname.startsWith(p),
  );

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const authed = token ? await verifyToken(token) : false;

  // Redirect unauthenticated users to login (preserve intended destination)
  if (isProtectedPage && !authed) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authed users away from auth pages
  if ((pathname === "/login" || pathname === "/signup") && authed) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/interview/:path*",
    "/group-discussion/:path*",
    "/analytics/:path*",
    "/profile/:path*",
    "/login",
    "/signup",
  ],
};
