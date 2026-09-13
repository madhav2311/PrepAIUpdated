import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import dbConnect from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { Room, makeCode, IRoom } from "@/models/Room";
import { User } from "@/models/User";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function serialize(room: IRoom, meId: string) {
  return {
    code: room.code,
    status: room.status,
    topic: room.topic,
    hostSide: room.hostSide,
    guestSide: room.guestSide,
    isHost: String(room.host) === meId,
    // Perspective-based turns: always render as "you" vs "opponent"
    turns: room.turns.map((t) => ({
      speaker:
        (t.speaker === "host") === (String(room.host) === meId)
          ? "you"
          : "opponent",
      text: t.text,
    })),
    verdict: room.verdict ?? null,
  };
}

async function nameOf(id: any) {
  const u = await User.findById(id).select("name username").lean();
  return (u as any)?.name ?? "Player";
}

export async function GET(req: NextRequest) {
  try {
    const me = await getSessionUser(req);
    if (!me)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await dbConnect();
    const code = new URL(req.url).searchParams.get("code");
    if (!code)
      return NextResponse.json({ error: "code required" }, { status: 400 });
    const room = await Room.findOne({ code, type: "debate" });
    if (!room)
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    if (
      String(room.host) !== String(me._id) &&
      String(room.guest) !== String(me._id)
    )
      return NextResponse.json({ error: "Not a participant" }, { status: 403 });
    return NextResponse.json({
      success: true,
      room: serialize(room, String(me._id)),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await getSessionUser(req);
    if (!me)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await dbConnect();
    const {
      action,
      code,
      topic,
      side,
      text,
      difficulty = "medium",
    } = await req.json();

    // ---- Create a debate room (host picks topic + side) ----
    if (action === "create") {
      const room = await Room.create({
        type: "debate",
        code: makeCode(),
        host: me._id,
        topic:
          (topic || "").trim() ||
          "Should college degrees be required for software engineering jobs?",
        hostSide: side === "Against" ? "Against" : "For",
        guestSide: side === "Against" ? "For" : "Against",
        status: "waiting",
        turns: [],
      });
      return NextResponse.json({ success: true, code: room.code });
    }

    if (!code)
      return NextResponse.json({ error: "code required" }, { status: 400 });
    const room = await Room.findOne({
      code: code.toUpperCase(),
      type: "debate",
    });
    if (!room)
      return NextResponse.json({ error: "Room not found" }, { status: 404 });

    // ---- Join as guest ----
    if (action === "join") {
      if (room.status !== "waiting")
        return NextResponse.json(
          { error: "Room is not joinable" },
          { status: 409 },
        );
      if (String(room.host) === String(me._id))
        return NextResponse.json(
          { error: "You created this room — waiting for your friend" },
          { status: 400 },
        );
      room.guest = me._id;
      room.status = "active";
      await room.save();
      return NextResponse.json({ success: true });
    }

    const isHost = String(room.host) === String(me._id);
    const isGuest = String(room.guest) === String(me._id);
    if (!isHost && !isGuest)
      return NextResponse.json({ error: "Not a participant" }, { status: 403 });

    // ---- Post an argument ----
    if (action === "speak") {
      if (room.status !== "active")
        return NextResponse.json(
          { error: "Debate is not active" },
          { status: 409 },
        );
      if (!text?.trim())
        return NextResponse.json({ error: "Empty argument" }, { status: 400 });
      room.turns.push({
        speaker: isHost ? "host" : "guest",
        text: String(text).trim(),
      });
      await room.save();
      return NextResponse.json({ success: true });
    }

    // ---- End & AI-judge the debate ----
    if (action === "verdict") {
      if (room.turns.length < 2)
        return NextResponse.json(
          { error: "Not enough arguments to judge" },
          { status: 400 },
        );
      const hostName = await nameOf(room.host);
      const guestName = room.guest ? await nameOf(room.guest) : "Guest";
      const transcript = room.turns
        .map(
          (t) =>
            `${t.speaker === "host" ? hostName : guestName} (${t.speaker === "host" ? room.hostSide : room.guestSide}): ${t.text}`,
        )
        .join("\n");

      const prompt = `
You are a neutral debate judge. Score this 1-on-1 debate fairly and rigorously.

TOPIC: ${room.topic}
${hostName} argued ${room.hostSide}. ${guestName} argued ${room.guestSide}.

TRANSCRIPT:
${transcript}

Judge on: argument quality, evidence, logical consistency, rebuttal handling, persuasiveness. Be honest. Return JSON only:
{
  "winner": "host" | "guest" | "tie",
  "hostScore": 0-100,
  "guestScore": 0-100,
  "summary": "2-3 sentence verdict explaining who won and why",
  "hostStrengths": "1-2 specific strengths of ${hostName}",
  "guestStrengths": "1-2 specific strengths of ${guestName}"
}`;
      let raw = "";
      try {
        const res = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: prompt,
          config: {
            thinkingConfig: { thinkingBudget: 128 },
            maxOutputTokens: 600,
          },
        });
        raw = (res.text || "")
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
      } catch {
        /* fall through to lite */
      }
      if (!raw) {
        try {
          const lite = await ai.models.generateContent({
            model: "gemini-flash-lite-latest",
            contents: prompt,
            config: { maxOutputTokens: 600 },
          });
          raw = (lite.text || "")
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();
        } catch {}
      }
      let verdict: any;
      try {
        verdict = JSON.parse(raw);
      } catch {
        verdict = null;
      }
      if (!verdict?.winner) {
        verdict = {
          winner: "tie",
          hostScore: 50,
          guestScore: 50,
          summary: "The debate was closely contested.",
          hostStrengths: "Held the position and responded to pushback.",
          guestStrengths: "Held the position and responded to pushback.",
        };
      }
      room.verdict = { ...verdict, hostName, guestName };
      room.status = "ended";
      await room.save();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? "Internal error" },
      { status: 500 },
    );
  }
}
