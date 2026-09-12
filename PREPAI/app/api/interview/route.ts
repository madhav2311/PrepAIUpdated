import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const FALLBACK_QUESTIONS: Record<string, string[]> = {
  easy: [
    "To start, could you tell me a bit about yourself and your background?",
    "What first got you interested in this field?",
    "Walk me through a project you enjoyed working on recently.",
    "Which tools or technologies do you feel most comfortable with day to day?",
    "What are you hoping to learn or grow into in your next role?",
    "Tell me about a small challenge you solved recently that you were proud of.",
  ],
  medium: [
    "Walk me through the architecture of your most significant project and the trade-offs you made.",
    "How would you scale that system to 10x the current load? What breaks first?",
    "Describe a time you disagreed with a teammate on a technical decision. How did you resolve it?",
    "How do you approach debugging a production issue that only happens intermittently?",
    "If you had to redesign one part of your past work, what would you change and why?",
  ],
  hard: [
    "Design the end-to-end architecture for a system handling 10 million daily active users. Walk me through every layer.",
    "Your service is failing with a 0.1% intermittent error rate under peak load. How do you find the root cause with no obvious pattern?",
    "Defend a technical decision you made that your leadership disagreed with. What was the cost of being wrong?",
    "What is the most non-obvious performance bottleneck you have ever chased, and how did you prove it?",
    "How would you migrate a live system with zero downtime to a completely different data model?",
  ],
};

// Hard cap: an interview session is exactly this many questions, then a final report.
const MAX_QUESTIONS = 7;

const DIFFICULTY_LADDER: Record<string, string[]> = {
  easy: ["easy", "easy", "easy", "medium", "medium", "medium"],
  medium: [
    "easy",
    "easy",
    "medium",
    "medium",
    "medium",
    "hard",
    "hard",
    "hard",
  ],
  hard: ["easy", "medium", "medium", "hard", "hard", "hard"],
};

export async function POST(req: Request) {
  try {
    const {
      resumeContext,
      jdContext,
      userResponse,
      conversationHistory,
      askedQuestions,
      questionIndex,
      role,
      difficulty = "medium",
    } = await req.json();

    const diff: string = ["easy", "medium", "hard"].includes(difficulty)
      ? difficulty
      : "medium";

    const askedList: string[] = Array.isArray(askedQuestions)
      ? askedQuestions
      : [];
    const idx =
      typeof questionIndex === "number" ? questionIndex : askedList.length;

    // ---- Session is capped at MAX_QUESTIONS questions. After the final answer,
    // ---- produce a complete evaluation report instead of another question.
    if (idx >= MAX_QUESTIONS) {
      const transcript = (
        Array.isArray(conversationHistory) ? conversationHistory : []
      )
        .map(
          (m: any) =>
            `${m.role === "interviewer" ? "Interviewer" : "Candidate"}: ${m.text}`,
        )
        .join("\n");
      const reportPrompt = `
You are a senior interviewer who just finished a ${MAX_QUESTIONS}-question mock interview.
Target Role / JD: ${jdContext || role || "General Software Engineer"}
Candidate Resume Summary: ${resumeContext || "Standard developer background"}

FULL TRANSCRIPT:
${transcript}

Write a rigorous, honest evaluation of the CANDIDATE across the whole session. Score 0-100 each.
Return JSON only (no markdown fences):
{
  "overallScore": 0-100,
  "technicalScore": 0-100,
  "communicationScore": 0-100,
  "confidenceScore": 0-100,
  "summary": "2-3 sentence overall verdict",
  "strengths": "2-3 specific things done well (one line each)",
  "improvements": "3 specific, actionable improvements",
  "questionFeedback": [
    { "question": "short question text", "feedback": "one-line feedback on their answer" }
  ]
}`;
      let raw = "";
      try {
        const res = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: reportPrompt,
          config: {
            thinkingConfig: { thinkingBudget: 128 },
            maxOutputTokens: 900,
          },
        });
        raw = (res.text || "")
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
      } catch (e: any) {
        if (!String(e?.message || "").includes("429"))
          console.error("Report primary failed:", e?.message);
      }
      if (!raw) {
        try {
          const lite = await ai.models.generateContent({
            model: "gemini-flash-lite-latest",
            contents: reportPrompt,
            config: { maxOutputTokens: 900 },
          });
          raw = (lite.text || "")
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();
        } catch (e: any) {
          console.error("Report fallback failed:", e?.message);
        }
      }
      let report: any;
      try {
        report = JSON.parse(raw);
      } catch {
        report = null;
      }
      if (!report?.overallScore) {
        report = {
          overallScore: 60,
          technicalScore: 60,
          communicationScore: 60,
          confidenceScore: 60,
          summary:
            "Interview complete. The AI judge was unavailable, so scores are provisional.",
          strengths:
            "You completed the full session and answered every question.",
          improvements:
            "Review the transcript and tighten one concrete example per answer.",
          questionFeedback: [],
        };
      }
      return NextResponse.json({ success: true, finished: true, report });
    }

    // Q1 is ALWAYS a natural human opener — no AI call, instant, can never skip the warm-up.
    if (idx === 0) {
      return NextResponse.json({
        success: true,
        evaluation: "",
        nextQuestion:
          "Hi, thanks so much for taking the time to chat with me today. I've gone through your resume — before we dive into anything technical, I'd love to hear your story. Tell me a bit about yourself: your background, what you've worked on, and what you're looking for in your next role.",
        currentLevel: "easy",
      });
    }
    const askedBlock =
      askedList.length > 0
        ? `\n\nCRITICAL — Already asked (do NOT repeat or rephrase any of these; ask something genuinely NEW in topic or depth):\n${askedList
            .map((q, i) => `${i + 1}. ${q}`)
            .join("\n")}`
        : "";

    // Realistic interview ramp: questions start easy and warm up before deepening.
    const ladder = DIFFICULTY_LADDER[diff];
    const currentLevel = ladder[Math.min(idx, ladder.length - 1)] ?? diff;

    const levelHints: Record<string, string> = {
      easy: "Keep this EASY and conversational — a warm-up. Focus on background, motivation, projects they enjoyed, career story, or high-level fundamentals. STRICTLY FORBIDDEN: asking about tech stacks, specific frameworks, libraries, or system design at this stage. Do not quiz them yet — you are still getting to know them like the first 10 minutes of a real interview.",
      medium:
        "Ask a MODERATE question now: a project deep-dive, a practical design or debugging scenario, or a behavioral probe tied to their resume. Reasonable difficulty a mid-level interviewer would use.",
      hard: "Now push HARD: advanced system design, trade-off stress-tests, edge cases at scale, or a challenging behavioral judgment call. Senior-level difficulty — but stay grounded in their resume and the target role.",
    };

    const rampNote =
      idx === 0
        ? "This is the very FIRST question of the interview: open naturally and warmly, exactly like a human interviewer would (a brief friendly acknowledgment is fine), then ask an easy opener such as 'Tell me about yourself' or an invitation to walk through their background."
        : `Difficulty for this question: ${currentLevel.toUpperCase()} (the session is selected as '${diff}' and ramps up gradually — never jump to a hard topic before earlier levels have been covered).`;

    const prompt = `
      You are an expert technical interviewer conducting a live mock interview.
      Target Role / Job Description: ${jdContext || role || "General Software Engineer"}
      Candidate Resume Summary: ${resumeContext || "Standard developer background"}

      Conversation History (recent only):
      ${JSON.stringify((Array.isArray(conversationHistory) ? conversationHistory : []).slice(-6))}

      The candidate's latest response: "${userResponse ?? ""}"
      Question number in this session: ${idx + 1}.
      ${rampNote}
      ${levelHints[currentLevel]}${askedBlock}
      Vary the question type (background, project deep-dive, system design, debugging, behavioral, trade-offs) so no two questions feel alike. NEVER ask a question similar to one already asked.

      Your task: Evaluate their response briefly (encouraging and specific — like a real interviewer acknowledging a good point), and ask the next adaptive question based strictly on their resume, the target job description, and the CURRENT difficulty level. Keep it concise, professional, and natural. Return JSON only (no markdown fences):
      {
        "evaluation": "Short feedback on their last answer",
        "nextQuestion": "The next interview question",
        "currentLevel": "${currentLevel}"
      }
    `;

    // Primary model, with automatic fallback to flash-lite (separate daily quota bucket)
    let resultText = "";
    try {
      const response = await ai.models.generateContent({
        // 3.6-flash with a small thinking budget: much richer questions than flash-lite,
        // still fast (~1.5s). Q1 is hardcoded above so the opener is always instant.
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          thinkingConfig: { thinkingBudget: 128 },
          maxOutputTokens: 600,
        },
      });
      resultText = response.text || "";
    } catch (primaryErr: any) {
      if (!String(primaryErr?.message || "").includes("429"))
        console.error("Interview primary model failed:", primaryErr?.message);
      try {
        const lite = await ai.models.generateContent({
          model: "gemini-flash-lite-latest",
          contents: prompt,
          config: { maxOutputTokens: 600 },
        });
        resultText = lite.text || "";
      } catch (liteErr: any) {
        console.error(
          "Interview fallback model also failed:",
          liteErr?.message,
        );
      }
    }

    resultText = resultText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const data = resultText ? JSON.parse(resultText) : {};

    // Variety guard: if the model returned nothing (or an exact repeat), use a rotating fallback.
    if (
      !data.nextQuestion ||
      askedList.some(
        (q) =>
          q.trim().toLowerCase() ===
          String(data.nextQuestion).trim().toLowerCase(),
      )
    ) {
      data.nextQuestion =
        FALLBACK_QUESTIONS[currentLevel][
          idx % FALLBACK_QUESTIONS[currentLevel].length
        ] ?? FALLBACK_QUESTIONS[currentLevel][0];
    }

    return NextResponse.json({ success: true, ...data });
  } catch (error: any) {
    console.error("Error in /api/interview:", error?.message ?? error);
    return NextResponse.json(
      { success: false, error: error?.message ?? "Internal error" },
      { status: 500 },
    );
  }
}
