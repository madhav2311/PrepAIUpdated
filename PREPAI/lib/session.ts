import crypto from "crypto";
import { NextRequest } from "next/server";
import dbConnect from "@/lib/mongodb";
import { User, IUser } from "@/models/User";

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 17);
}

const COOKIE_NAME = "prep_session";
const SECRET = process.env.AUTH_SECRET || "prep-ai-dev-secret-change-me";

function signPayload(payload: string) {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
}

export function verifyToken(token: string) {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (signPayload(payload) !== sig) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
}

export async function getSessionUser(req: NextRequest): Promise<IUser | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? verifyToken(token) : null;
  if (!session?.id) return null;
  await dbConnect();
  return User.findById(session.id);
}

export const CONTINENTS = [
  "Africa",
  "Asia",
  "Europe",
  "North America",
  "South America",
  "Oceania",
  "Antarctica",
];

/** Ensure a user has a unique @username; derive from name/email, dedupe with suffixes. */
export async function ensureUsername(user: IUser): Promise<string> {
  if (user.username) return user.username;
  const base = slugify(user.name || user.email.split("@")[0]) || "user";
  let candidate = base;
  for (let i = 0; i < 50; i++) {
    const clash = await User.findOne({ username: candidate }).lean();
    if (!clash || String((clash as any)._id) === String(user._id)) break;
    candidate = `${base}${Math.floor(Math.random() * 9000) + 100}`;
  }
  user.username = candidate;
  // Explicit update — robust even if the compiled model is stale
  await User.updateOne({ _id: user._id }, { $set: { username: candidate } });
  return candidate;
}

export function isValidUsername(u: string) {
  return /^[a-z0-9_]{3,20}$/.test(u);
}

/** Derive gamification stats (level, badges) from XP. */
export function gamify(xp: number) {
  const level = Math.max(1, Math.floor(Math.sqrt(xp / 50)) + 1);
  const nextLevelXp = 50 * level * level;
  const prevXp = 50 * (level - 1) * (level - 1);
  const progress = Math.min(
    100,
    Math.round(((xp - prevXp) / (nextLevelXp - prevXp)) * 100),
  );
  const badges: string[] = [];
  if (xp >= 50) badges.push("First Steps");
  if (xp >= 250) badges.push("Consistent Learner");
  if (xp >= 600) badges.push("Interview Warrior");
  if (xp >= 1200) badges.push("Placement Pro");
  if (xp >= 2500) badges.push("Legend");
  return { level, nextLevelXp, progress, badges };
}
