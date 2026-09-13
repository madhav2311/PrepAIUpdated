import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface DebateTurn {
  speaker: "user" | "opponent";
  text: string;
}

const FALLBACK_REBUTTALS = [
  "I hear your point, but you're assuming the benefits land evenly for everyone. Consider who bears the cost when that assumption fails — that's where your position weakens.",
  "That's an appeal to what should happen, not what does happen. Can you point to real-world evidence where this worked at scale without serious drawbacks?",
  "Interesting framing, but you've widened the definition to make your case easier. If we use the narrower, practical definition, your conclusion doesn't follow.",
  "You've described the ideal case. But policy and engineering are decided at the margins — what happens in the worst 10% of cases under your position?",
  "Strong claim. Now, if I grant you that, you must also accept the second-order effects — and those cut against you. How do you reconcile that?",
];

// Primary model with automatic fallback to flash-lite (separate daily quota bucket)
async function callGemini(prompt: string, maxTokens: number): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 128 },
        maxOutputTokens: maxTokens,
      },
    });
    return (response.text || "")
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
  } catch (primaryErr: any) {
    if (!String(primaryErr?.message || "").includes("429"))
      console.error("Debate primary model failed:", primaryErr?.message);
    try {
      const lite = await ai.models.generateContent({
        model: "gemini-flash-lite-latest",
        contents: prompt,
        config: { maxOutputTokens: maxTokens },
      });
      return (lite.text || "")
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
    } catch (liteErr: any) {
      console.error("Debate fallback model also failed:", liteErr?.message);
      return "";
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const {
      topic,
      userSide,
      opponentSide,
      history,
      action,
      difficulty = "medium",
    } = await req.json();

    const turns: DebateTurn[] = Array.isArray(history) ? history.slice(-8) : [];
    const historyText =
      turns.length > 0
        ? turns
            .map(
              (t) => `${t.speaker === "user" ? "User" : "Opponent"}: ${t.text}`,
            )
            .join("\n")
        : "(Debate start — you speak first.)";

    // ---- Final verdict ----
    if (action === "verdict") {
      const transcript = (Array.isArray(history) ? history : [])
        .map((t) => `${t.speaker === "user" ? "User" : "Opponent"}: ${t.text}`)
        .join("\n");
      const prompt = `
You are a neutral debate judge. Score this 1-on-1 debate fairly and rigorously.

TOPIC: ${topic}
User argued: ${userSide}
Opponent argued: ${opponentSide}

TRANSCRIPT:
${transcript}

Judge on: argument quality, evidence, logical consistency, rebuttal handling, and persuasiveness. Be honest — do not inflate the user's score. Return JSON only:
{
  "winner": "user" | "opponent" | "tie",
  "userScore": 0-100,
  "opponentScore": 0-100,
  "summary": "2-3 sentence verdict explaining who won and why",
  "userStrengths": "1-2 specific things the user did well",
  "userImprovements": "2-3 specific, actionable improvements for next time"
}`;

      const raw = await callGemini(prompt, 600);
      try {
        const data = JSON.parse(raw);
        return NextResponse.json({ success: true, ...data });
      } catch {
        return NextResponse.json({
          success: true,
          winner: "tie",
          userScore: 50,
          opponentScore: 50,
          summary: "The debate was closely contested.",
          userStrengths: "You held your ground and responded to pushback.",
          userImprovements:
            "Anchor claims in concrete evidence and address the strongest counter-argument directly.",
        });
      }
    }

    // ---- Opponent rebuttal ----
    const difficultyHint =
      difficulty === "easy"
        ? "Keep rebuttals conversational and accessible — challenge gently, one clear point at a time."
        : difficulty === "hard"
          ? "Deliver sharp, senior-debater rebuttals: expose logical fallacies, demand evidence, attack the weakest premise. Stay respectful but relentless."
          : "Deliver balanced, well-structured rebuttals: acknowledge the good point, then pivot to a solid counter.";

    const prompt = `
You are "Riya", a skilled 1-on-1 debate opponent in a live voice debate. You speak your next turn ALOUD, so keep it natural spoken language: 2-4 sentences, no lists, no markdown, no headers.

TOPIC: ${topic}
You argue: ${opponentSide}
Your opponent (the user) argues: ${userSide}

DEBATE SO FAR:
${historyText}

${difficultyHint}

Respond with your next spoken rebuttal that directly engages the user's latest point. Vary your tactics across turns (attack assumptions, demand evidence, reframe, point out trade-offs) — never repeat a previous argument. Return JSON only:
{ "argument": "your spoken rebuttal", "tactic": "one of: assumption-attack | evidence-demand | reframe | trade-off | concession-pivot" }
`;

    let data: { argument?: string; tactic?: string };
    const raw = await callGemini(prompt, 400);
    try {
      if (!raw) throw new Error("empty");
      data = JSON.parse(raw);
      if (!data.argument) throw new Error("bad shape");
    } catch {
      data = {
        argument:
          FALLBACK_REBUTTALS[
            turns.filter((t) => t.speaker === "user").length %
              FALLBACK_REBUTTALS.length
          ],
        tactic: "assumption-attack",
      };
    }

    return NextResponse.json({ success: true, ...data });
  } catch (error: any) {
    console.error("Error in /api/debate:", error?.message ?? error);
    return NextResponse.json(
      { success: false, error: error?.message ?? "Internal error" },
      { status: 500 },
    );
  }
}
