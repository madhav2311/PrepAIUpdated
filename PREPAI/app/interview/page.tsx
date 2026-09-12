'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Sparkles, Mic, MicOff, Send, Volume2, SkipForward, FileText, Briefcase, UserRound, GraduationCap, Gauge, Signal, ClipboardCheck, CheckCircle2, TrendingUp, Target } from 'lucide-react';
import { speak, stopSpeaking, loadVoices } from '@/lib/speech';

const ROLE_PRESETS: { label: string; jd: string }[] = [
  { label: 'Frontend Engineer', jd: 'Frontend Engineer — React, Next.js, TypeScript, performance optimization, accessibility, component architecture.' },
  { label: 'Backend Engineer', jd: 'Backend Engineer — Node.js/Python, REST & GraphQL APIs, databases (SQL/NoSQL), system design, scalability, caching.' },
  { label: 'Full-Stack Engineer', jd: 'Full-Stack Engineer — end-to-end product delivery, React + Node.js, databases, auth, deployment, CI/CD.' },
  { label: 'Data Scientist', jd: 'Data Scientist — Python, pandas, ML model building, statistics, experimentation, communicating insights.' },
  { label: 'DevOps / SRE', jd: 'DevOps / SRE — Linux, Docker, Kubernetes, CI/CD pipelines, monitoring, incident response, infrastructure as code.' },
  { label: 'Product Manager (Tech)', jd: 'Technical Product Manager — product strategy, roadmaps, prioritization, working with engineers, metrics-driven decisions.' },
];

export default function InterviewRoomPage() {
  const [step, setStep] = useState<'setup' | 'interview'>('setup');
  const [resume, setResume] = useState('');
  const [jd, setJd] = useState('');
  const [mode, setMode] = useState<'role' | 'profile' | 'manual'>('role');
  const [selectedRole, setSelectedRole] = useState(ROLE_PRESETS[0].label);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [currentLevel, setCurrentLevel] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profile, setProfile] = useState<{ targetRole?: string; resumeText?: string; jdText?: string } | null>(null);
  const askedRef = React.useRef<string[]>([]);
  const questionIndexRef = React.useRef(0);
  const [report, setReport] = useState<any>(null);
  const [savingReport, setSavingReport] = useState(false);

  const MAX_QUESTIONS = 7;

  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);

  const recognitionRef = React.useRef<any>(null);

  // Pre-load browser voices (they load async in Chrome)
  React.useEffect(() => { loadVoices(); }, []);

  const speakText = (text: string) => {
    // Interviewer voice: consistent persona, faster pace
    speak(text, { gender: 'male', rate: 1.15, onStart: () => setIsSpeaking(true), onEnd: () => setIsSpeaking(false) });
  };

  // Mic stays on until the user clicks to stop it (continuous mode)
  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome.");
      return;
    }

    // Currently listening -> user manually stops it
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { }
      recognitionRef.current = null;
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;          // keep listening until stopped
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsRecording(true);
      recognition.onresult = (event: any) => {
        // Append every finalized chunk while the mic stays open
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            const speechToText = event.results[i][0].transcript;
            setInput((prev: string) => (prev ? `${prev} ${speechToText}` : speechToText));
          }
        }
      };
      recognition.onerror = () => { };
      // Only fires when stopped externally (user click, permission loss) — do NOT auto-restart
      recognition.onend = () => {
        if (recognitionRef.current === recognition) recognitionRef.current = null;
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsRecording(false);
    }
  };

  const loadProfile = async () => {
    setProfileLoading(true);
    setProfileError('');
    try {
      const res = await fetch('/api/profile');
      if (!res.ok) throw new Error('Please sign in and save your profile first (via the Profile page).');
      const data = await res.json();
      if (!data?.profile || (!data.profile.resumeText && !data.profile.jdText && !data.profile.targetRole)) {
        throw new Error('Your profile is empty — fill it in on the Profile page first.');
      }
      setProfile(data.profile);
    } catch (err: any) {
      setProfileError(err.message);
    } finally {
      setProfileLoading(false);
    }
  };

  // Resolve the effective resume/JD for the chosen mode
  const resolveContext = () => {
    if (mode === 'profile' && profile) {
      return {
        resume: profile.resumeText || 'Not provided',
        jd: profile.jdText || profile.targetRole || 'General Software Engineer',
      };
    }
    if (mode === 'role') {
      const preset = ROLE_PRESETS.find((r) => r.label === selectedRole);
      return { resume: resume || 'Standard developer background', jd: preset?.jd || selectedRole };
    }
    return { resume, jd };
  };

  const startInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep('interview');
    setLoading(true);
    setReport(null);
    askedRef.current = [];
    questionIndexRef.current = 0;

    const ctx = resolveContext();

    try {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeContext: ctx.resume,
          jdContext: ctx.jd,
          userResponse: "Hello, I am ready for the interview based on my resume and the job description.",
          conversationHistory: [],
          askedQuestions: [],
          questionIndex: 0,
          difficulty
        })
      });
      const data = await res.json();
      const initialQ = data.nextQuestion || "To start, could you tell me a bit about yourself and your background?";
      setCurrentLevel(data.currentLevel || 'easy');
      askedRef.current = [initialQ];
      questionIndexRef.current = 1;
      setMessages([{ role: 'interviewer', text: initialQ }]);
      speakText(initialQ);
    } catch {
      const fallbackQ = "Let's begin. Could you tell me about yourself and your background?";
      setCurrentLevel('easy');
      askedRef.current = [fallbackQ];
      questionIndexRef.current = 1;
      setMessages([{ role: 'interviewer', text: fallbackQ }]);
      speakText(fallbackQ);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (userAnswer?: string) => {
    const msgToSend = userAnswer || input;
    if (!msgToSend.trim() || loading) return;

    stopSpeaking(); // cut the interviewer off as soon as you answer
    setInput('');
    const updatedMessages = [...messages, { role: 'user', text: msgToSend }];
    setMessages(updatedMessages);
    setLoading(true);

    const ctx = resolveContext();

    try {
      // After the last (7th) answer, ask for the final evaluation report instead of a new question.
      const isFinal = questionIndexRef.current >= MAX_QUESTIONS;
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeContext: ctx.resume,
          jdContext: ctx.jd,
          userResponse: msgToSend,
          conversationHistory: updatedMessages,
          askedQuestions: askedRef.current,
          questionIndex: questionIndexRef.current,
          difficulty
        })
      });

      const data = await res.json();

      if (isFinal && data.finished && data.report) {
        // ---- Interview complete: show the report and persist the session ----
        setReport(data.report);
        setSavingReport(true);
        try {
          await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionType: 'interview',
              transcript: updatedMessages.map((m) => ({ sender: m.role === 'interviewer' ? 'Interviewer' : 'You', message: m.text })),
              metrics: {
                technicalScore: data.report.technicalScore ?? 0,
                communicationScore: data.report.communicationScore ?? 0,
                confidenceScore: data.report.confidenceScore ?? 0,
              },
            }),
          });
        } catch { }
        setSavingReport(false);
        return;
      }

      const nextQ = data.nextQuestion || "Can you explain your approach to handling scalability and edge cases?";
      setCurrentLevel(data.currentLevel || '');
      askedRef.current = [...askedRef.current, nextQ];
      questionIndexRef.current += 1;
      setMessages(prev => [...prev, { role: 'interviewer', text: nextQ }]);
      speakText(nextQ);
    } catch {
      const fallbackNext = "Let's move on to the next architectural requirement. How do you ensure fault tolerance?";
      setMessages(prev => [...prev, { role: 'interviewer', text: fallbackNext }]);
      speakText(fallbackNext);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'setup') {
    return (
      <div className="min-h-screen aurora text-slate-100 p-8 flex items-center justify-center font-sans relative">
        <div className="max-w-xl w-full glass rounded-2xl p-8 shadow-2xl relative z-10 animate-fade-up">
          <div className="absolute -top-20 -right-20 w-56 h-56 bg-orange-500/10 rounded-full blur-3xl"></div>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-orange-500/10 text-orange-400 rounded-xl border border-orange-500/25">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gradient">Setup Your AI Mock Interview</h1>
              <p className="text-xs text-slate-400">Provide context so Gemini can tailor questions precisely to you.</p>
            </div>
          </div>

          {/* Mode selector */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            {([
              { id: 'role', label: 'Pick a Role', icon: <Briefcase className="w-3.5 h-3.5" /> },
              { id: 'profile', label: 'My Profile', icon: <UserRound className="w-3.5 h-3.5" /> },
              { id: 'manual', label: 'Manual Entry', icon: <FileText className="w-3.5 h-3.5" /> },
            ] as const).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => { setMode(m.id); if (m.id === 'profile' && !profile) loadProfile(); }}
                className={`flex items-center justify-center gap-1.5 text-xs font-medium py-2.5 rounded-xl border transition ${mode === m.id
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600'
                  }`}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>

          {/* Difficulty selector */}
          <div className="mb-4">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-2 mb-1.5">
              <Gauge className="w-4 h-4 text-orange-400" /> Difficulty Level
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'easy', label: 'Easy', desc: 'Warm & foundational' },
                { id: 'medium', label: 'Medium', desc: 'Balanced & probing' },
                { id: 'hard', label: 'Hard', desc: 'Senior stress-test' },
              ] as const).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDifficulty(d.id)}
                  className={`text-left px-3 py-2.5 rounded-xl border transition ${difficulty === d.id
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600'
                    }`}
                >
                  <span className="block text-xs font-semibold">{d.label}</span>
                  <span className="block text-[10px] text-slate-500 mt-0.5">{d.desc}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-2">The interview always starts with a natural warm-up and ramps up gradually — it never jumps straight to hard topics.</p>
          </div>

          <form onSubmit={startInterview} className="space-y-4">
            {mode === 'role' && (
              <div>
                <label className="text-xs font-medium text-slate-300 flex items-center gap-2 mb-1.5">
                  <GraduationCap className="w-4 h-4 text-orange-400" /> Target Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLE_PRESETS.map((r) => (
                    <button
                      key={r.label}
                      type="button"
                      onClick={() => setSelectedRole(r.label)}
                      className={`text-xs text-left px-3 py-2.5 rounded-xl border transition ${selectedRole === r.label
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600'
                        }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-2">Questions will target the {selectedRole} track. Optionally add resume context below.</p>
                <textarea
                  rows={3}
                  value={resume}
                  onChange={(e) => setResume(e.target.value)}
                  placeholder="(Optional) Paste resume highlights for personalised questions..."
                  className="w-full mt-2 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                />
              </div>
            )}

            {mode === 'profile' && (
              <div className="text-xs space-y-2">
                {profileLoading ? (
                  <div className="text-slate-400 py-6 text-center">Loading your profile…</div>
                ) : profileError ? (
                  <div className="text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3">{profileError}</div>
                ) : profile ? (
                  <div className="space-y-2">
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                      <span className="text-[10px] uppercase tracking-wider text-orange-400 font-semibold">Role</span>
                      <p className="text-slate-300 mt-1">{profile.targetRole || 'Not set'}</p>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                      <span className="text-[10px] uppercase tracking-wider text-orange-400 font-semibold">Resume</span>
                      <p className="text-slate-300 mt-1 line-clamp-3">{profile.resumeText || 'Not set'}</p>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                      <span className="text-[10px] uppercase tracking-wider text-orange-400 font-semibold">JD</span>
                      <p className="text-slate-300 mt-1 line-clamp-3">{profile.jdText || 'Not set'}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {mode === 'manual' && (
              <>
                <div>
                  <label className="text-xs font-medium text-slate-300 flex items-center gap-2 mb-1.5">
                    <Briefcase className="w-4 h-4 text-orange-400" /> Target Job Description / Role
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={jd}
                    onChange={(e) => setJd(e.target.value)}
                    placeholder="Paste job description or specify target role..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 flex items-center gap-2 mb-1.5">
                    <FileText className="w-4 h-4 text-orange-400" /> Resume Summary / Key Experience
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={resume}
                    onChange={(e) => setResume(e.target.value)}
                    placeholder="Paste your resume highlights, tech stack, and previous projects..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 text-slate-950 font-semibold py-3 rounded-xl transition shadow-lg shadow-orange-500/30 text-sm flex items-center justify-center gap-2 mt-4"
            >
              <Sparkles className="w-4 h-4" /> Initialize Voice Interview Room
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ---- Final evaluation report screen ----
  if (step === 'interview' && report) {
    const scoreRow = (label: string, v: number, icon: JSX.Element) => (
      <div className="glass rounded-xl p-4 text-center">
        <div className="flex items-center justify-center gap-1.5 text-orange-400 mb-1">{icon}<span className="text-lg font-bold text-white">{v}</span></div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      </div>
    );
    return (
      <div className="min-h-screen aurora text-slate-100 p-8 flex items-center justify-center relative">
        <div className="max-w-2xl w-full glass rounded-2xl p-8 shadow-2xl relative z-10 animate-fade-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl ring-1 ring-emerald-500/30"><ClipboardCheck className="w-6 h-6" /></div>
            <div>
              <h1 className="text-xl font-bold text-gradient">Interview Report</h1>
              <p className="text-xs text-slate-400">{MAX_QUESTIONS} questions evaluated · saved to your history</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 mb-5">
            {scoreRow('Overall', report.overallScore ?? 0, <Target className="w-3.5 h-3.5" />)}
            {scoreRow('Technical', report.technicalScore ?? 0, <Signal className="w-3.5 h-3.5" />)}
            {scoreRow('Comms', report.communicationScore ?? 0, <Volume2 className="w-3.5 h-3.5" />)}
            {scoreRow('Confidence', report.confidenceScore ?? 0, <TrendingUp className="w-3.5 h-3.5" />)}
          </div>
          {report.summary && <p className="text-sm text-slate-300 leading-relaxed mb-4">{report.summary}</p>}
          {report.strengths && (
            <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-3 text-xs text-slate-300 mb-3">
              <span className="font-semibold text-emerald-400 flex items-center gap-1.5 mb-1"><CheckCircle2 className="w-3.5 h-3.5" /> Strengths</span>{report.strengths}
            </div>
          )}
          {report.improvements && (
            <div className="bg-orange-500/10 border border-orange-500/25 rounded-xl p-3 text-xs text-slate-300 mb-3">
              <span className="font-semibold text-orange-400 flex items-center gap-1.5 mb-1"><TrendingUp className="w-3.5 h-3.5" /> Improvements</span>{report.improvements}
            </div>
          )}
          {Array.isArray(report.questionFeedback) && report.questionFeedback.length > 0 && (
            <div className="space-y-2 mb-5">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Per-question feedback</span>
              {report.questionFeedback.map((q: any, i: number) => (
                <div key={i} className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs">
                  <span className="text-orange-400 font-semibold">Q{i + 1}.</span> <span className="text-slate-200">{q.question}</span>
                  <p className="text-slate-400 mt-1">{q.feedback}</p>
                </div>
              ))}
            </div>
          )}
          {savingReport && <p className="text-xs text-slate-500 mb-3">Saving session…</p>}
          <div className="flex gap-3">
            <button onClick={() => { setStep('setup'); setReport(null); setMessages([]); }} className="btn-hot flex-1 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 text-slate-950 font-semibold py-3 rounded-xl transition shadow-lg shadow-orange-500/30">
              New Interview
            </button>
            <Link href="/dashboard" className="glass hover:bg-slate-800/60 text-slate-200 font-medium py-3 px-5 rounded-xl transition flex items-center">
              <ArrowLeft className="w-4 h-4 mr-2" /> Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen aurora text-slate-100 p-6 md:p-8 font-sans relative">
      <div className="relative z-10 flex items-center justify-between mb-6 pb-4 border-b border-slate-900">
        <div className="flex items-center gap-4">
          <button onClick={() => setStep('setup')} className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Live Voice Interview Session</span>
            <h1 className="text-xl font-bold text-gradient">AI Voice & Context Engine</h1>
          </div>
          {currentLevel && (
            <span className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold px-2.5 py-1 rounded-full border ${currentLevel === 'hard'
              ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
              : currentLevel === 'medium'
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                : 'bg-emerald-500/15 border-emerald-500/40 text-orange-400'
              }`}>
              <Signal className="w-3.5 h-3.5" /> {currentLevel}
            </span>
          )}
          <span className="text-[10px] uppercase tracking-wider font-semibold px-2.5 py-1 rounded-full border border-slate-700 text-slate-300">
            Q {Math.min(questionIndexRef.current + 1, MAX_QUESTIONS)} / {MAX_QUESTIONS}
          </span>
        </div>
        <button
          onClick={() => handleSendMessage("[Skipped Question]")}
          className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition"
        >
          <SkipForward className="w-4 h-4 text-orange-400" /> Skip Question
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass card-glow rounded-2xl p-6 relative animate-fade-up">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs bg-orange-950/60 text-orange-400 border border-orange-700/40 px-2.5 py-1 rounded-md font-medium flex items-center gap-2">
                Active Question
                {isSpeaking && (
                  <span className="flex items-end gap-0.5 h-3">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="eq-bar w-0.5 h-3 bg-emerald-400 rounded-full" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </span>
                )}
              </span>
              <button
                onClick={() => speakText(messages.filter(m => m.role === 'interviewer').slice(-1)[0]?.text || '')}
                className="text-xs text-orange-400 hover:underline flex items-center gap-1"
              >
                <Volume2 className="w-4 h-4" /> Replay Audio
              </button>
            </div>
            <h3 className="text-lg md:text-xl font-bold text-white leading-relaxed">
              {messages.filter(m => m.role === 'interviewer').slice(-1)[0]?.text || 'Loading question...'}
            </h3>
          </div>

          <div className="glass rounded-2xl p-6 space-y-4 animate-fade-up" style={{ animationDelay: '0.08s' }}>
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>Your Answer (Voice or Text)</span>
              <span>{isRecording ? ' Listening...' : 'Ready'}</span>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleListening}
                className={`p-3 rounded-xl border transition ${isRecording ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse-ring' : 'glass text-slate-300 hover:bg-slate-800/60'}`}
              >
                {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={loading ? "Analyzing response..." : questionIndexRef.current >= MAX_QUESTIONS ? "Final answer — the report follows this one…" : "Type your answer or use the microphone..."}
                disabled={loading}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-orange-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 text-slate-950 font-semibold p-3 rounded-xl transition flex items-center justify-center shadow-lg shadow-orange-500/30 disabled:opacity-50">
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>

        <div className="glass rounded-2xl p-5 flex flex-col h-[500px]">
          <h4 className="text-sm font-semibold text-white mb-3 pb-2 border-b border-slate-800">Session Transcript</h4>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
            {messages.map((m, i) => (
              <div key={i} className={`p-3 rounded-xl border animate-fade-up ${m.role === 'interviewer' ? 'bg-slate-950/60 border-slate-800 text-slate-300' : 'bg-orange-500/10 border-orange-500/30 text-slate-200 ml-4'}`}>
                <span className="font-semibold block mb-1 text-[10px] uppercase tracking-wider text-orange-400">
                  {m.role === 'interviewer' ? 'Interviewer' : 'You'}
                </span>
                <p className="leading-relaxed">{m.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}