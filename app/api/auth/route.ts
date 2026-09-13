import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import dbConnect from "@/lib/mongodb";
import { User } from "@/models/User";

function hashPassword(password: string, salt?: string) {
  const useSalt = salt ?? crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, useSalt, 64).toString("hex");
  return `${useSalt}:${hash}`;
}

function verifyPassword(password: string, stored: string) {
  const [salt] = stored.split(":");
  return hashPassword(password, salt) === stored;
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

function verifyToken(token: string) {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (signPayload(payload) !== sig) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
}

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
  secure: process.env.NODE_ENV === "production",
};

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? verifyToken(token) : null;
  if (!session) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user: session });
}

export async function POST(req: NextRequest) {
  try {
    const { action, name, email, password } = await req.json();

    if (action === "logout") {
      const res = NextResponse.json({ success: true });
      res.cookies.set(COOKIE_NAME, "", { ...COOKIE_OPTS, maxAge: 0 });
      return res;
    }

    await dbConnect();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    if (action === "signup") {
      if (!name) {
        return NextResponse.json(
          { error: "Name is required for signup" },
          { status: 400 },
        );
      }
      const existing = await User.findOne({ email });
      if (existing) {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 409 },
        );
      }
      const user = await User.create({
        name,
        email,
        passwordHash: hashPassword(password),
        readinessScore: 0,
      });
      const res = NextResponse.json(
        {
          success: true,
          user: { id: user._id, name: user.name, email: user.email },
        },
        { status: 201 },
      );
      res.cookies.set(COOKIE_NAME, createToken(user), COOKIE_OPTS);
      return res;
    }

    // login
    const user = await User.findOne({ email });
    if (
      !user ||
      !user.passwordHash ||
      !verifyPassword(password, user.passwordHash)
    ) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }
    const res = NextResponse.json({
      success: true,
      user: { id: user._id, name: user.name, email: user.email },
    });
    res.cookies.set(COOKIE_NAME, createToken(user), COOKIE_OPTS);
    return res;
  } catch (error: any) {
    console.error("Error in /api/auth:", error);
    return NextResponse.json(
      { error: error.message ?? "Internal Server Error" },
      { status: 500 },
    );
  }
}
