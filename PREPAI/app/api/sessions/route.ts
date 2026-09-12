import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import dbConnect from "@/lib/mongodb";
import { SessionLog } from "@/models/SessionLog";
import { User } from "@/models/User";

const COOKIE_NAME = "prep_session";
const SECRET = process.env.AUTH_SECRET || "prep-ai-dev-secret-change-me";

function verifyToken(token: string) {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (crypto.createHmac("sha256", SECRET).update(payload).digest("hex") !== sig)
    return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const token = req.cookies.get(COOKIE_NAME)?.value;
    const session = token ? verifyToken(token) : null;
    // Fall back to explicit query param if no session cookie
    const userId = session?.id ?? new URL(req.url).searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: no session or userId" },
        { status: 401 },
      );
    }

    const sessions = await SessionLog.find({ userId }).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, sessions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();
    const token = req.cookies.get(COOKIE_NAME)?.value;
    const session = token ? verifyToken(token) : null;
    const { sessionType, transcript, metrics } = body;
    const userId = session?.id ?? body.userId;

    if (!userId || !sessionType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const newSession = await SessionLog.create({
      userId,
      sessionType,
      transcript: transcript || [],
      metrics: metrics || {
        technicalScore: 0,
        communicationScore: 0,
        confidenceScore: 0,
      },
    });

    // ---- Gamification: award XP + maintain daily streak ----
    try {
      const m = metrics || {};
      const avgScore = Math.round(
        ((m.technicalScore ?? 0) +
          (m.communicationScore ?? 0) +
          (m.confidenceScore ?? 0)) /
          3,
      );
      const earnedXp = Math.max(10, Math.round(avgScore));
      const user = await User.findById(userId);
      if (user) {
        const last = user.lastSessionDate
          ? new Date(user.lastSessionDate)
          : null;
        const today = new Date();
        const sameDay = last && last.toDateString() === today.toDateString();
        const yesterday = new Date(today.getTime() - 864e5);
        if (!sameDay) {
          user.streak =
            last && last.toDateString() === yesterday.toDateString()
              ? (user.streak ?? 0) + 1
              : 1;
          user.lastSessionDate = today;
        }
        user.xp = (user.xp ?? 0) + earnedXp;
        await user.save();
      }
    } catch (e) {
      console.error("Gamification update failed:", e);
    }

    return NextResponse.json(
      { success: true, session: newSession },
      { status: 201 },
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
