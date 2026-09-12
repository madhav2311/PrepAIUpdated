import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { User } from "@/models/User";
import { FriendRequest } from "@/models/FriendRequest";
import { gamify } from "@/lib/session";

// GET /api/leaderboard?scope=world|continent|friends&continent=Asia&limit=25
export async function GET(req: NextRequest) {
  try {
    const me = await getSessionUser(req);
    if (!me)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await dbConnect();

    const url = new URL(req.url);
    const scope = url.searchParams.get("scope") || "world";
    const limit = Math.min(50, Number(url.searchParams.get("limit")) || 25);

    let filter: any = {};
    if (scope === "continent") {
      const continent = url.searchParams.get("continent") || me.continent;
      if (!continent)
        return NextResponse.json(
          {
            error:
              "Set your continent in your profile to see the continent leaderboard",
          },
          { status: 400 },
        );
      filter = { continent };
    } else if (scope === "friends") {
      const frs = await FriendRequest.find({
        $or: [{ from: me._id }, { to: me._id }],
        status: "accepted",
      });
      const ids = frs.map((f) =>
        String(f.from) === String(me._id) ? f.to : f.from,
      );
      ids.push(me._id);
      filter = { _id: { $in: ids } };
    }

    const users = await User.find(
      filter,
      "name email avatar continent xp streak",
    )
      .sort({ xp: -1 })
      .limit(limit);

    const entries = users.map((u: any, i) => ({
      rank: i + 1,
      id: String(u._id),
      name: u.name,
      email: scope === "friends" ? u.email : undefined,
      avatar: u.avatar || null,
      continent: u.continent || null,
      xp: u.xp ?? 0,
      streak: u.streak ?? 0,
      isMe: String(u._id) === String(me._id),
      ...gamify(u.xp ?? 0),
    }));

    return NextResponse.json({ scope, entries });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "Internal Server Error" },
      { status: 500 },
    );
  }
}
