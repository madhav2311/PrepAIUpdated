import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import dbConnect from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { Room, makeCode, IRoom } from "@/models/Room";
import { User } from "@/models/User";

// Friend-to-friend WebRTC call signaling.
// Both peers exchange SDP offer/answer + ICE candidates through this API via
// short polling — no websocket server required.

function serialize(room: IRoom, meId: string, since: number) {
  const isHost = String(room.host) === meId;
  const peerId = isHost ? room.guest : room.host;
  return {
    code: room.code,
    status: room.status,
    isHost,
    // Signals addressed to ME, newer than `since` index
    signals: room.signals
      .map((s, i) => ({
        by: s.by,
        kind: s.kind,
        payload: s.payload,
        at: s.at,
        idx: i,
      }))
      .filter(
        (s: any) => s.by !== (isHost ? "host" : "guest") && s.idx >= since,
      ),
    count: room.signals.length,
  };
}

export async function GET(req: NextRequest) {
  try {
    const me = await getSessionUser(req);
    if (!me)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await dbConnect();
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const since = parseInt(url.searchParams.get("since") || "0", 10);

    // No code -> check for an incoming ringing call for me
    if (!code) {
      const incoming = await Room.findOne({
        type: "call",
        status: "waiting",
        guest: me._id,
      });
      if (!incoming)
        return NextResponse.json({ success: true, incoming: null });
      const caller = await User.findById(incoming.host)
        .select("name avatar")
        .lean();
      return NextResponse.json({
        success: true,
        incoming: incoming
          ? { code: incoming.code, from: (caller as any)?.name ?? "Friend" }
          : null,
      });
    }

    const room = await Room.findOne({ code, type: "call" });
    if (!room)
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    const meId = String(me._id);
    if (String(room.host) !== meId && String(room.guest) !== meId)
      return NextResponse.json({ error: "Not a participant" }, { status: 403 });
    return NextResponse.json({
      success: true,
      call: serialize(room, meId, since),
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
    const { action, code, friendId, kind, payload, since, transcript } =
      await req.json();

    // ---- Start ringing a friend ----
    if (action === "invite") {
      if (!friendId)
        return NextResponse.json(
          { error: "friendId required" },
          { status: 400 },
        );
      const existing = await Room.findOne({
        type: "call",
        status: "waiting",
        host: me._id,
        guest: friendId,
      });
      if (existing)
        return NextResponse.json({ success: true, code: existing.code });
      const room = await Room.create({
        type: "call",
        code: makeCode(),
        host: me._id,
        guest: friendId,
        status: "waiting",
        signals: [],
      });
      return NextResponse.json({ success: true, code: room.code });
    }

    if (!code)
      return NextResponse.json({ error: "code required" }, { status: 400 });
    const room = await Room.findOne({ code: code.toUpperCase(), type: "call" });
    if (!room)
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    const meId = String(me._id);
    const isHost = String(room.host) === meId;
    if (!isHost && String(room.guest) !== meId)
      return NextResponse.json({ error: "Not a participant" }, { status: 403 });
    const by = isHost ? "host" : "guest";

    // ---- Accept incoming call ----
    if (action === "accept") {
      room.status = "active";
      await room.save();
      return NextResponse.json({ success: true });
    }

    // ---- Reject / hang up ----
    if (action === "reject" || action === "end") {
      if (action === "reject" && room.status === "waiting") {
        await room.deleteOne();
        return NextResponse.json({ success: true, rejected: true });
      }

      // Store MY side's speech transcript (from live speech-to-text) if provided
      if (transcript && String(transcript).trim()) {
        const existing = room.transcripts.findIndex((t) => t.by === by);
        if (existing >= 0) room.transcripts[existing].text = String(transcript);
        else room.transcripts.push({ by, text: String(transcript) });
      }
      room.signals.push({ by, kind: "hangup", payload: null });
      room.status = "ended";

      // ---- First ender triggers the AI evaluation of the practice call ----
      let verdict = room.verdict ?? null;
      if (!verdict) {
        const lines = room.transcripts
          .map((t) => `${t.by === "host" ? "Caller A" : "Caller B"}: ${t.text}`)
          .join("\n");
        const durationSec = Math.max(
          1,
          Math.round((Date.now() - new Date(room.createdAt).getTime()) / 1000),
        );
        const prompt = `
You are a communication coach evaluating a peer-to-peer VOICE PRACTICE CALL between two students preparing for interviews.
The call lasted about ${Math.round(durationSec / 60)} minutes.
Each participant's speech was transcribed locally (their own microphone only), so each side may miss what the other said.

TRANSCRIPT (may be one-sided or partial):
${lines || "(No speech was captured — treat as silence.)"}

Evaluate the PARTICIPANTS' practice conversation: fluency, clarity, structure, confidence, content quality, and how well they engaged each other. Be honest and encouraging. Return JSON only (no markdown fences):
{
  "overallScore": 0-100,
  "communicationScore": 0-100,
  "confidenceScore": 0-100,
  "summary": "2-3 sentence verdict of the practice call",
  "strengths": "2 specific things done well",
  "improvements": "2-3 specific, actionable improvements"
}`;
        let raw = "";
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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
            /* fall back to lite */
          }
          if (!raw) {
            try {
              const ai2 = new GoogleGenAI({
                apiKey: process.env.GEMINI_API_KEY,
              });
              const lite = await ai2.models.generateContent({
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
          try {
            verdict = JSON.parse(raw);
          } catch {
            verdict = null;
          }
        } catch {}
        if (!verdict?.overallScore) {
          verdict = {
            overallScore: 60,
            communicationScore: 60,
            confidenceScore: 60,
            summary:
              "Practice call completed. The AI judge was unavailable, so scores are provisional.",
            strengths: "You showed up and practiced live with a peer.",
            improvements:
              "Review what you said and prepare one clearer example for next time.",
          };
        }
        room.verdict = verdict;
      }
      await room.save();
      return NextResponse.json({ success: true, verdict });
    }

    // ---- Exchange WebRTC signals (offer / answer / ice) ----
    if (action === "signal") {
      if (!kind)
        return NextResponse.json({ error: "kind required" }, { status: 400 });
      room.signals.push({ by, kind, payload });
      if (room.signals.length > 200) room.signals = room.signals.slice(-200);
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
