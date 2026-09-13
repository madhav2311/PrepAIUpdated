import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import dbConnect from "@/lib/mongodb";
import { User } from "@/models/User";
import { ensureUsername } from "@/lib/session";

// Unified OAuth login for Google, GitHub and LinkedIn.
// Config via .env.local: GOOGLE_CLIENT_ID/SECRET, GITHUB_CLIENT_ID/SECRET, LINKEDIN_CLIENT_ID/SECRET

const PROVIDERS: Record<
  string,
  {
    authUrl: string;
    tokenUrl: string;
    userInfo: (
      accessToken: string,
    ) => Promise<{ id: string; email: string; name: string; avatar?: string }>;
    scope: string;
  }
> = {
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid email profile",
    userInfo: async (token) => {
      const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      return {
        id: d.sub,
        email: d.email,
        name: d.name || d.email,
        avatar: d.picture,
      };
    },
  },
  github: {
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scope: "read:user user:email",
    userInfo: async (token) => {
      const res = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      });
      const d = await res.json();
      let email = d.email;
      if (!email) {
        const er = await fetch("https://api.github.com/user/emails", {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
          },
        });
        if (er.ok) {
          const emails = await er.json();
          email = emails.find((e: any) => e.primary)?.email ?? emails[0]?.email;
        }
      }
      return {
        id: String(d.id),
        email,
        name: d.name || d.login,
        avatar: d.avatar_url,
      };
    },
  },
  linkedin: {
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scope: "openid profile email",
    userInfo: async (token) => {
      const res = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      return {
        id: d.sub,
        email: d.email,
        name: d.name || d.email,
        avatar: d.picture,
      };
    },
  },
};

function providerConfig(provider: string) {
  const envKey = provider.toUpperCase();
  const clientId = process.env[`${envKey}_CLIENT_ID`];
  const clientSecret = process.env[`${envKey}_CLIENT_SECRET`];
  if (!clientId || !clientSecret || !PROVIDERS[provider]) return null;
  return { clientId, clientSecret, ...PROVIDERS[provider] };
}

const COOKIE_NAME = "prep_session";
const SECRET = process.env.AUTH_SECRET || "prep-ai-dev-secret-change-me";

function signPayload(payload: string) {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
}

function createToken(user: { _id: unknown; name: string; email: string }) {
  const payload = Buffer.from(
    JSON.stringify({
      id: String(user._id),
      name: user.name,
      email: user.email,
    }),
  ).toString("base64url");
  return `${payload}.${signPayload(payload)}`;
}

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
  secure: process.env.NODE_ENV === "production",
};

export async function GET(req: NextRequest, ctx: any) {
  const provider = (await ctx?.params)?.provider;
  const config = providerConfig(provider);
  if (!config)
    return NextResponse.json(
      { error: `Unknown or unconfigured provider: ${provider}` },
      { status: 404 },
    );

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const redirectUri = `${url.origin}/api/auth/oauth/${provider}`;

  // ---- Step 1: redirect to the provider's consent screen ----
  if (!code) {
    const state = crypto.randomBytes(16).toString("hex");
    const auth = new URL(config.authUrl);
    auth.searchParams.set("client_id", config.clientId);
    auth.searchParams.set("redirect_uri", redirectUri);
    auth.searchParams.set("response_type", "code");
    auth.searchParams.set("scope", config.scope);
    auth.searchParams.set("state", state);
    const res = NextResponse.redirect(auth.toString());
    res.cookies.set("oauth_state", state, {
      httpOnly: true,
      path: "/",
      maxAge: 600,
    });
    return res;
  }

  // ---- Step 2: exchange the code, load the profile, upsert the user ----
  try {
    const state = url.searchParams.get("state");
    if (!state || state !== req.cookies.get("oauth_state")?.value) {
      return NextResponse.redirect(
        new URL("/login?error=invalid_state", req.url),
      );
    }
    const tokenRes = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return NextResponse.redirect(
        new URL("/login?error=oauth_token", req.url),
      );
    }
    const info = await config.userInfo(tokenData.access_token);
    if (!info.email)
      return NextResponse.redirect(
        new URL("/login?error=oauth_email", req.url),
      );

    await dbConnect();
    let user = await User.findOne({ provider, providerId: info.id });
    if (!user) user = await User.findOne({ email: info.email.toLowerCase() });
    if (!user) {
      user = await User.create({
        name: info.name,
        email: info.email.toLowerCase(),
        provider,
        providerId: info.id,
        avatar: info.avatar,
        xp: 0,
        streak: 0,
      });
    } else {
      // Link the provider + backfill avatar if the user hasn't uploaded one
      user.provider = provider;
      user.providerId = info.id;
      if (info.avatar && !user.avatar) user.avatar = info.avatar;
      await user.save();
    }
    await ensureUsername(user);

    const res = NextResponse.redirect(new URL("/dashboard", req.url));
    res.cookies.set(COOKIE_NAME, createToken(user), COOKIE_OPTS);
    res.cookies.set("oauth_state", "", { ...COOKIE_OPTS, maxAge: 0 });
    return res;
  } catch (error: any) {
    console.error(`OAuth ${provider} failed:`, error);
    return NextResponse.redirect(new URL("/login?error=oauth_failed", req.url));
  }
}
