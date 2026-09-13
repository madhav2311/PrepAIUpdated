import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { User } from "@/models/User";
import { FriendRequest } from "@/models/FriendRequest";

function publicUser(u: any) {
  return {
    id: String(u._id),
    name: u.name,
    username: u.username || null,
    email: u.email,
    avatar: u.avatar || null,
    continent: u.continent || null,
    linkedin: u.linkedin || null,
    github: u.github || null,
    xp: u.xp ?? 0,
    streak: u.streak ?? 0,
  };
}

// GET: friends list + pending incoming/outgoing requests
export async function GET(req: NextRequest) {
  try {
    const me = await getSessionUser(req);
    if (!me)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await dbConnect();

    const requests = await FriendRequest.find({
      $or: [{ from: me._id }, { to: me._id }],
      status: { $ne: "rejected" },
    })
      .populate("from", "name username email avatar continent xp streak")
      .populate("to", "name username email avatar continent xp streak");

    const friends: any[] = [];
    const incoming: any[] = [];
    const outgoing: any[] = [];
    const connectedIds = new Set<string>([String(me._id)]);
    for (const r of requests) {
      const from: any = r.from;
      const to: any = r.to;
      connectedIds.add(String(from._id));
      connectedIds.add(String(to._id));
      if (r.status === "accepted") {
        friends.push(
          String(from._id) === String(me._id)
            ? publicUser(to)
            : publicUser(from),
        );
      } else if (String(to._id) === String(me._id)) {
        incoming.push({ requestId: String(r._id), user: publicUser(from) });
      } else {
        outgoing.push({ requestId: String(r._id), user: publicUser(to) });
      }
    }

    // Random suggestions: users who aren't me / friends / already connected
    let suggestions: any[] = [];
    try {
      const sample = await User.aggregate([
        {
          $match: {
            _id: {
              $nin: [...connectedIds].map(
                (id) => new mongoose.Types.ObjectId(id),
              ),
            },
          },
        },
        { $sample: { size: 5 } },
        {
          $project: {
            name: 1,
            username: 1,
            email: 1,
            avatar: 1,
            continent: 1,
            xp: 1,
            streak: 1,
          },
        },
      ]);
      suggestions = sample.map(publicUser);
    } catch {
      suggestions = [];
    }

    friends.sort((a, b) => b.xp - a.xp);
    return NextResponse.json({ friends, incoming, outgoing, suggestions });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "Internal Server Error" },
      { status: 500 },
    );
  }
}

// POST: { action: 'send' | 'accept' | 'reject' | 'remove', email?, requestId? }
export async function POST(req: NextRequest) {
  try {
    const me = await getSessionUser(req);
    if (!me)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await dbConnect();
    const { action, email, username, requestId } = await req.json();

    if (action === "send") {
      // Accept either a @username or an email
      let query: any = null;
      let display = "";
      if (username && username.trim()) {
        const handle = username.trim().toLowerCase().replace(/^@/, "");
        query = { username: handle };
        display = `@${handle}`;
      } else if (email && email.trim()) {
        query = {
          email: {
            $regex: `^${email.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
            $options: "i",
          },
        };
        display = email.trim();
      }
      if (!query)
        return NextResponse.json(
          { error: "Enter a username or email" },
          { status: 400 },
        );
      const target = await User.findOne(query);
      if (!target)
        return NextResponse.json(
          { error: `No user found for ${display}` },
          { status: 404 },
        );
      if (String(target._id) === String(me._id))
        return NextResponse.json(
          { error: "You can't add yourself" },
          { status: 400 },
        );
      const existing = await FriendRequest.findOne({
        $or: [
          { from: me._id, to: target._id },
          { from: target._id, to: me._id, status: { $ne: "rejected" } },
        ],
      });
      if (existing) {
        if (existing.status === "accepted")
          return NextResponse.json(
            { error: "You're already friends" },
            { status: 409 },
          );
        return NextResponse.json(
          { error: "A request already exists" },
          { status: 409 },
        );
      }
      await FriendRequest.create({ from: me._id, to: target._id });
      return NextResponse.json({
        success: true,
        message: `Request sent to ${target.name}`,
      });
    }

    if (action === "accept" || action === "reject") {
      if (!requestId)
        return NextResponse.json(
          { error: "requestId is required" },
          { status: 400 },
        );
      const fr = await FriendRequest.findById(requestId);
      if (!fr || String(fr.to) !== String(me._id))
        return NextResponse.json(
          { error: "Request not found" },
          { status: 404 },
        );
      fr.status = action === "accept" ? "accepted" : "rejected";
      await fr.save();
      return NextResponse.json({ success: true });
    }

    if (action === "remove") {
      if (!requestId)
        return NextResponse.json(
          { error: "requestId is required" },
          { status: 400 },
        );
      const fr = await FriendRequest.findById(requestId);
      if (
        !fr ||
        (String(fr.from) !== String(me._id) && String(fr.to) !== String(me._id))
      )
        return NextResponse.json(
          { error: "Request not found" },
          { status: 404 },
        );
      await fr.deleteOne();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "Internal Server Error" },
      { status: 500 },
    );
  }
}
