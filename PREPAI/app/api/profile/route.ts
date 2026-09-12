import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import {
  getSessionUser,
  gamify,
  ensureUsername,
  isValidUsername,
  CONTINENTS,
} from "@/lib/session";
import { User } from "@/models/User";

// GET: return the signed-in user's profile (resume/JD context)
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await ensureUsername(user);
    return NextResponse.json({
      profile: {
        username: user.username ?? "",
        name: user.name,
        targetRole: user.targetRole ?? "",
        resumeText: user.resumeText ?? "",
        jdText: user.jdText ?? "",
        avatar: user.avatar ?? "",
        linkedin: user.linkedin ?? "",
        github: user.github ?? "",
        continent: user.continent ?? "",
        xp: user.xp ?? 0,
        streak: user.streak ?? 0,
      },
      stats: gamify(user.xp ?? 0),
      continents: CONTINENTS,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "Internal Server Error" },
      { status: 500 },
    );
  }
}

// POST: save profile context + identity
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const {
      targetRole,
      resumeText,
      jdText,
      avatar,
      linkedin,
      github,
      continent,
      username,
    } = await req.json();
    // Username changes — validate uniqueness + format
    if (typeof username === "string" && username.trim()) {
      const handle = username.trim().toLowerCase().replace(/^@/, "");
      if (!isValidUsername(handle)) {
        return NextResponse.json(
          {
            error: "Username must be 3-20 chars: letters, numbers, underscores",
          },
          { status: 400 },
        );
      }
      const clash = await User.findOne({ username: handle });
      if (clash && String(clash._id) !== String(user._id)) {
        return NextResponse.json(
          { error: "That username is already taken" },
          { status: 409 },
        );
      }
      user.username = handle;
    }
    if (typeof targetRole === "string")
      user.targetRole = targetRole.slice(0, 500);
    if (typeof resumeText === "string")
      user.resumeText = resumeText.slice(0, 20000);
    if (typeof jdText === "string") user.jdText = jdText.slice(0, 20000);
    // Avatars are stored as compressed data URLs — reject anything larger
    if (typeof avatar === "string") {
      if (avatar.length > 300_000)
        return NextResponse.json(
          { error: "Image too large — please pick a smaller picture" },
          { status: 413 },
        );
      user.avatar = avatar;
    }
    if (typeof linkedin === "string") user.linkedin = linkedin.slice(0, 300);
    if (typeof github === "string") user.github = github.slice(0, 300);
    if (typeof continent === "string") user.continent = continent.slice(0, 50);
    // Persist with an explicit $set update — instance .save() can silently drop
    // fields if the compiled model is older than the schema (stale dev server).
    await User.findByIdAndUpdate(
      user._id,
      {
        $set: {
          username: user.username,
          targetRole: user.targetRole,
          resumeText: user.resumeText,
          jdText: user.jdText,
          avatar: user.avatar,
          linkedin: user.linkedin,
          github: user.github,
          continent: user.continent,
        },
      },
      { new: true, runValidators: true },
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "Internal Server Error" },
      { status: 500 },
    );
  }
}
