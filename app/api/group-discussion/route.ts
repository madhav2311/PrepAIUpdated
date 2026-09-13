import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const PERSONAS: Record<string, { gender: string; brief: string }> = {
  Sara: {
    gender: "female",
    brief:
      "Sara (Female AI) – Persona: Devil's Advocate / Skeptical & Critical Thinker. You challenge assumptions, spot logical loopholes, and stress-test every claim.",
  },
  Nikhil: {
    gender: "male",
    brief:
      "Nikhil (Male AI) – Persona: Data-Driven Analyst. You focus on metrics, edge cases, feasibility, benchmarks, and real-world constraints.",
  },
  Ananya: {
    gender: "female",
    brief:
      "Ananya (Female AI) – Persona: Consensus Builder. You focus on collaboration, user experience, and the big picture, synthesizing shared ground.",
  },
  Rohan: {
    gender: "male",
    brief:
      "Rohan (Male AI) – Persona: Pragmatist / Execution Focus. You care about deadlines, cost, resourcing, and what can actually ship.",
  },
  Meera: {
    gender: "female",
    brief:
      "Meera (Female AI) – Persona: Storyteller / Customer Advocate. You bring user stories, ethics, and human impact into the debate.",
  },
};

// Fixed seating order for round-robin (user speaks first, then these in order)
const PERSONA_ORDER = ["Sara", "Nikhil", "Ananya", "Rohan", "Meera"];
const MIN_PARTICIPANTS = 2; // user + 1 AI
const MAX_PARTICIPANTS = 6; // user + 5 AI

const STRENGTH_CYCLE: string[] = ["moderate", "strong", "weak"];

interface Turn {
  speaker: string;
  statement: string;
  argumentStrength?: string;
}

interface OrchestratorResponse {
  activeSpeaker: string;
  speakerGender: string;
  argumentStrength: string;
  statement: string;
  userTurnAllowed: boolean;
  coachingTip: string;
}

function fallback(
  history: Turn[],
  nextSpeaker: string,
  interrupt: boolean,
): OrchestratorResponse {
  const idx = STRENGTH_CYCLE.indexOf(
    (history[history.length - 1] as any)?.argumentStrength ?? "moderate",
  );
  const strength = interrupt
    ? "strong"
    : STRENGTH_CYCLE[(idx + 1) % STRENGTH_CYCLE.length];

  const canned: Record<string, string> = {
    Moderator:
      "Thank you. Let us keep the discussion focused. Who would like to build on that point?",
    Sara: "I appreciate the confidence, but I am not convinced. That assumes ideal conditions — what happens when that assumption fails under production pressure?",
    Nikhil:
      "From a data standpoint, I would like to see measurable evidence. What KPIs would validate that approach, and what is the failure rate at the edge cases?",
    Ananya:
      "Those are valid concerns from both sides. Perhaps the strongest position acknowledges the trade-off while keeping the user experience at the center.",
    Rohan:
      "Good in theory — but what does this cost us in time and headcount? Can we ship a leaner version first and measure?",
    Meera:
      "Let me bring this back to the people affected. I have seen users struggle with exactly this trade-off.",
  };

  return {
    activeSpeaker: nextSpeaker,
    speakerGender:
      nextSpeaker === "Moderator"
        ? "neutral"
        : (PERSONAS[nextSpeaker]?.gender ?? "neutral"),
    argumentStrength: nextSpeaker === "Moderator" ? "intro" : strength,
    statement: canned[nextSpeaker] ?? "Please continue.",
    userTurnAllowed: false,
    coachingTip: "Keep your points structured: claim, evidence, impact.",
  };
}

export async function POST(req: NextRequest) {
  try {
    const {
      jdContext,
      resumeContext,
      topic,
      history,
      interrupted,
      participantCount: rawCount,
    } = await req.json();

    // Total participants including the user (2-6). AI panelists = total - 1.
    const participantCount = Math.min(
      MAX_PARTICIPANTS,
      Math.max(MIN_PARTICIPANTS, Number(rawCount) || 4),
    );
    const panelists = PERSONA_ORDER.slice(0, participantCount - 1);

    const historyText = (history || [])
      .slice(-8) // keep prompt small — only the last 8 turns matter
      .map(
        (t: Turn) =>
          `${t.speaker} [${t.argumentStrength ?? "n/a"}]: ${t.statement}`,
      )
      .join("\n");

    const prompt = `
You are the master orchestrator and conversation engine for "PrepAI", a high-end multi-agent group discussion and interview simulation platform.

### 1. Room Configuration & Participants
${participantCount} total participants:
- 1 Human User (Role: Candidate / Active Speaker)
- ${panelists.length} AI Panelists:
${panelists.map((name, i) => `${i + 1}. ${PERSONAS[name].brief}`).join("\n")}

### 2. User Profile & Context (Injected from Resume & JD)
- Target Role / Job Description: ${jdContext || "Software Engineer"}
- Candidate Profile Summary & Keywords (Extracted from Resume): ${resumeContext || "Standard software engineering background"}
- Use this background context to tailor questions, expect relevant domain knowledge, and evaluate how well the user defends their points based on their actual resume experience.

### 3. Discussion Topic
- Current Topic: ${topic}

### 4. Turn-Based & Round-Robin Orchestration Rules
- Sequence Order: User -> ${panelists.join(" -> ")} -> (Repeat)
- The User always has first priority to speak. ${interrupted ? 'The user just used "Raise Hand / Interrupt": the current AI speaker must immediately wrap up their sentence or pause in one short closing line, yielding the floor back to the user.' : ""}
- The user cannot endlessly talk over people, but can cleanly seize the floor between turns.
- Argument Spectrum: Dynamically vary argumentative strength across turns. Some turns surface-level or flawed (weak) so the user can spot loopholes; others rigorous, sharp, data-backed (strong) to pressure-test the user's thesis.

### 5. Real-Time Flow & Output Format
Conversation so far (round-robin):
${historyText || "(Discussion start - as Moderator, welcome everyone to the panel, set the context of the resume/role, and invite the first speaker.)"}

Determine whose turn is next per the round-robin sequence and respond ONLY as that one speaker.

Output your response strictly as a JSON object, no markdown fences:
{
  "activeSpeaker": "${panelists.join(" | ")} | Moderator | User",
  "speakerGender": "female | male | neutral",
  "argumentStrength": "weak | moderate | strong | intro",
  "statement": "The dialogue or statement text...",
  "userTurnAllowed": true/false,
  "coachingTip": "Real-time observation or feedback snippet on the flow."
}
`;

    // Primary model, with automatic fallback to flash-lite (separate daily quota bucket)
    let rawText = "";
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        // Cap thinking + output length for snappy real-time turns
        config: {
          thinkingConfig: { thinkingBudget: 128 },
          maxOutputTokens: 600,
        },
      });
      rawText = (response.text || "")
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
    } catch (primaryErr: any) {
      if (!String(primaryErr?.message || "").includes("429"))
        console.error("GD primary model failed:", primaryErr?.message);
      try {
        const lite = await ai.models.generateContent({
          model: "gemini-flash-lite-latest",
          contents: prompt,
          config: { maxOutputTokens: 600 },
        });
        rawText = (lite.text || "")
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
      } catch (liteErr: any) {
        console.error("GD fallback model also failed:", liteErr?.message);
      }
    }

    let data: OrchestratorResponse;
    try {
      if (!rawText) throw new Error("empty");
      data = JSON.parse(rawText);
      if (!data.activeSpeaker || !data.statement) throw new Error("bad shape");
    } catch {
      // Model/API failure must NOT kill the room — serve the canned fallback.
      const lastSpeaker = history?.length
        ? history[history.length - 1].speaker
        : "User";
      const order = ["User", ...panelists];
      const nextSpeaker = interrupted
        ? "User"
        : order[(order.indexOf(lastSpeaker) + 1) % order.length];
      data = fallback(history || [], nextSpeaker, interrupted);
    }

    return NextResponse.json({ success: true, ...data });
  } catch (error: any) {
    console.error("Error in /api/group-discussion orchestrator:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 },
    );
  }
}
