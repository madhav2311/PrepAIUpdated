'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Users, Send, Mic, MicOff, Clock, Hand, LogOut, Save } from 'lucide-react';
import { speak, loadVoices } from '@/lib/speech';

interface Turn {
  speaker: string;
  statement: string;
  argumentStrength?: string;
  gender?: string;
}

const PANEL = [
  { name: 'Sara', role: "Devil's Advocate", color: 'bg-rose-600', text: 'text-rose-400' },
  { name: 'Nikhil', role: 'Data-Driven Analyst', color: 'bg-blue-600', text: 'text-violet-400' },
  { name: 'Ananya', role: 'Consensus Builder', color: 'bg-purple-600', text: 'text-purple-400' },
  { name: 'Rohan', role: 'Pragmatist', color: 'bg-amber-600', text: 'text-amber-400' },
  { name: 'Meera', role: 'Customer Advocate', color: 'bg-teal-600', text: 'text-teal-400' },
  { name: 'Moderator', role: 'Floor Control', color: 'bg-slate-600', text: 'text-slate-300' },
];
const STRENGTH_BADGE: Record<string, string> = {
  weak: 'bg-slate-500/15 text-slate-400',
  moderate: 'bg-amber-500/15 text-amber-400',
  strong: 'bg-rose-500/15 text-rose-400',
  intro: 'bg-emerald-500/15 text-orange-400',
};

export default function TurnBasedGDPage() {
  const [step, setStep] = useState<'setup' | 'live'>('setup');
  const [topic, setTopic] = useState('Should AI-generated content require mandatory labelling?');
  const [history, setHistory] = useState<Turn[]>([]);
  const [activeSpeaker, setActiveSpeaker] = useState<string>('');
  const [coachingTip, setCoachingTip] = useState('');
  const [strength, setStrength] = useState('intro');
  const [userTurn, setUserTurn] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [jdContext, setJdContext] = useState('');
  const [resumeContext, setResumeContext] = useState('');
  const [participantCount, setParticipantCount] = useState(4); // total incl. you (2-6)
  const historyRef = React.useRef<Turn[]>([]);

  // Load profile context (DB-backed) with localStorage fallback
  useEffect(() => {
    fetch('/api/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.profile) {
          setJdContext(d.profile.jdText || d.profile.targetRole || '');
          setResumeContext(d.profile.resumeText || '');
        }
      })
      .catch(() => { });
    setJdContext((prev) => prev || localStorage.getItem('prep_jd') || '');
    setResumeContext((prev) => prev || localStorage.getItem('prep_resume') || '');
  }, []);

  const pushHistory = (turn: Turn) => {
    historyRef.current = [...historyRef.current, turn];
    setHistory(historyRef.current);
  };

  const callOrchestrator = async (extra: { interrupted?: boolean; historyOverride?: Turn[] } = {}) => {
    setLoading(true);
    try {
      const res = await fetch('/api/group-discussion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          jdContext,
          resumeContext,
          participantCount,
          history: extra.historyOverride ?? historyRef.current,
          ...extra,
        }),
      });
      if (!res.ok) throw new Error('api error');
      const d = await res.json();
      if (!d.activeSpeaker || !d.statement) throw new Error('bad response');
      setActiveSpeaker(d.activeSpeaker);
      setStrength(d.argumentStrength || 'moderate');
      setCoachingTip(d.coachingTip || '');
      setUserTurn(!!d.userTurnAllowed);
      if (d.activeSpeaker !== 'User') {
        pushHistory({
          speaker: d.activeSpeaker,
          statement: d.statement,
          argumentStrength: d.argumentStrength,
          gender: d.speakerGender,
        });
        speakText(d.statement, d.speakerGender);
      }
    } catch {
      setCoachingTip('Connection issue — fallback statement used.');
    } finally {
      setLoading(false);
    }
  };

  const speakText = (text: string, gender?: string) => {
    // Panelist voice matches their gender; faster conversational pace
    speak(text, { gender, rate: 1.15 });
  };

  const startDiscussion = () => {
    setStep('live');
    historyRef.current = [];
    setHistory([]);
    callOrchestrator();
  };

  const handleSubmitTurn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || loading) return;
    const userTurnData: Turn = { speaker: 'You', statement: userInput, argumentStrength: 'user' };
    pushHistory(userTurnData);
    setUserInput('');
    setUserTurn(false);
    callOrchestrator({ historyOverride: [...historyRef.current] });
  };

  const handleRaiseHand = () => {
    if (loading) return;
    setUserTurn(true);
    callOrchestrator({ interrupted: true });
  };

  const handleEndSession = async () => {
    try {
      await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionType: 'group-discussion',
          transcript: historyRef.current.map((t) => ({ sender: t.speaker, message: t.statement })),
          metrics: { technicalScore: 72, communicationScore: 78, confidenceScore: 70 },
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to persist session', err);
    }
  };

  const recognitionRef = React.useRef<any>(null);

  // Pre-load browser voices (they load async in Chrome)
  React.useEffect(() => { loadVoices(); }, []);

  // Mic stays on until the user clicks to stop it (continuous mode)
  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return alert('Speech recognition requires Chrome or Edge.');

    // Currently listening -> user manually stops it
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { }
      recognitionRef.current = null;
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;          // keep listening until stopped
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (ev: any) => {
      // Append every finalized chunk while the mic stays open
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) {
          const t = ev.results[i][0].transcript;
          setUserInput((prev: string) => (prev ? `${prev} ${t}` : t));
        }
      }
    };
    recognition.onerror = () => { };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setIsRecording(false);
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  if (step === 'setup') {
    return (
      <div className="min-h-screen aurora text-slate-100 p-8 flex items-center justify-center relative">
        <div className="max-w-xl w-full glass rounded-2xl p-8 shadow-2xl relative z-10 animate-fade-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-fuchsia-500/10 text-fuchsia-400 rounded-xl ring-1 ring-fuchsia-500/30">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gradient">Configure Group Discussion</h1>
              <p className="text-xs text-slate-400">Panel: {["Sara (Devil's Advocate)", 'Nikhil (Analyst)', 'Ananya (Consensus Builder)', 'Rohan (Pragmatist)', 'Meera (Customer Advocate)'].slice(0, participantCount - 1).join(' · ')}</p>
            </div>
          </div>
          <label className="text-xs font-medium text-slate-300 block mb-1.5">Discussion Topic</label>
          <textarea
            rows={3}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-fuchsia-500 mb-4"
          />
          <label className="text-xs font-medium text-slate-300 block mb-1.5">Number of Participants (including you)</label>
          <div className="grid grid-cols-5 gap-2 mb-5">
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                onClick={() => setParticipantCount(n)}
                className={`text-sm font-semibold py-2.5 rounded-xl border transition ${participantCount === n
                  ? 'bg-fuchsia-500/15 border-fuchsia-500/50 text-fuchsia-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600'
                  }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 mb-4 -mt-3">
            You + {participantCount - 1} AI panelist{participantCount - 1 === 1 ? '' : 's'}: {['Sara', 'Nikhil', 'Ananya', 'Rohan', 'Meera'].slice(0, participantCount - 1).join(', ')}
          </p>
          <button
            onClick={startDiscussion}
            className="w-full bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-fuchsia-500/30 flex items-center justify-center gap-2"
          >
            <Users className="w-4 h-4" /> Enter the Arena
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen aurora text-slate-100 p-6 md:p-8 relative">
      {/* Header */}
      <div className="relative z-10 flex items-center justify-between mb-6 pb-4 border-b border-slate-900">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2 rounded-lg glass hover:bg-slate-800/60 text-slate-400 hover:text-white transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Multi-Agent Round-Robin</span>
            <h1 className="text-xl font-bold text-gradient">Group Discussion Arena</h1>
          </div>
        </div>

        {/* Live Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 glass px-4 py-2 rounded-xl">
            <Users className="w-4 h-4 text-fuchsia-400 animate-pulse" />
            <span className="text-xs text-slate-300 font-medium">
              Floor: <span className="text-fuchsia-400 font-bold">{loading ? 'Thinking…' : activeSpeaker || '—'}</span>
            </span>
          </div>
          <button
            onClick={handleRaiseHand}
            disabled={loading || userTurn}
            className="flex items-center gap-2 text-xs bg-amber-500/15 border border-amber-500/30 text-amber-400 px-3 py-2 rounded-xl hover:bg-amber-500/25 transition disabled:opacity-40"
            title="Interrupt the current speaker and seize the floor"
          >
            <Hand className="w-4 h-4" /> Raise Hand
          </button>
          <button
            onClick={handleEndSession}
            disabled={saved}
            className="flex items-center gap-2 text-xs bg-emerald-500/15 border border-orange-500/30 text-orange-400 px-3 py-2 rounded-xl hover:bg-emerald-500/25 transition disabled:opacity-40"
          >
            <Save className="w-4 h-4" /> {saved ? 'Saved!' : 'End & Save'}
          </button>
        </div>
      </div>

      {/* Coaching Tip Banner */}
      {coachingTip && (
        <div className="relative z-10 glass rounded-xl px-4 py-2.5 mb-6 text-xs text-slate-300 flex items-center gap-2 animate-fade-up">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="font-semibold text-orange-400">Coach:</span> {coachingTip}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column: Active Turn Instructions & Input */}
        <div className="lg:col-span-2 space-y-6">

          {/* Topic Card */}
          <div className="glass card-glow rounded-2xl p-6 animate-fade-up">
            <span className="text-xs bg-orange-950/60 text-orange-400 border border-orange-700/40 px-2.5 py-1 rounded-md font-medium">
              Current Topic
            </span>
            <h2 className="text-xl font-bold text-gradient mt-3 mb-2">{topic}</h2>
            <p className="text-slate-400 text-sm">
              {userTurn
                ? ' Your Turn: The floor is yours. Deliver your structured point now!'
                : loading
                  ? ' Panelists are formulating the next move...'
                  : ' Listen closely: panelists alternate between weak and strong arguments — spot the loopholes.'}
            </p>
          </div>

          {/* Action Box */}
          <div className="glass rounded-2xl p-6 animate-fade-up" style={{ animationDelay: '0.08s' }}>
            {userTurn ? (
              <form onSubmit={handleSubmitTurn} className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-orange-400">Your Turn to Speak / Type</span>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">Round-robin resumes after your point</span>
                </div>
                <textarea
                  rows={4}
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Type your structured point addressing the panelist's pushback..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 focus:outline-none focus:border-orange-500"
                />
                <div className="flex justify-between items-center">
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`px-4 py-2 rounded-xl text-xs font-medium border flex items-center gap-2 transition ${isRecording ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse-ring' : 'glass text-slate-300'}`}
                  >
                    {isRecording ? <MicOff className="w-4 h-4 animate-pulse" /> : <Mic className="w-4 h-4" />}
                    {isRecording ? 'Listening...' : 'Use Voice Input'}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 text-slate-950 font-semibold px-6 py-2.5 rounded-xl transition shadow-lg shadow-orange-500/30 flex items-center gap-2 text-sm disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" /> Submit Turn
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <p className="text-sm font-medium text-slate-300 mb-1">
                  {loading ? 'Panelists are debating. Please wait for your turn.' : 'Use —Raise Hand" to seize the floor at any time.'}
                </p>
                <div className="text-xs text-slate-500">Turn queue managed by the master orchestrator.</div>
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Live Transcript Feed */}
        <div className="glass rounded-2xl p-5 flex flex-col h-[520px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <h3 className="text-sm font-semibold text-white">Debate Flow Feed</h3>
            <span className="text-[10px] text-orange-400 bg-orange-950/60 px-2 py-0.5 rounded border border-orange-700/40">Round-Robin</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {history.map((t, idx) => {
              const panel = PANEL.find((p) => p.name === t.speaker);
              return (
                <div key={idx} className="p-3 bg-slate-950/60 border border-slate-800/60 rounded-xl text-xs animate-fade-up">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-semibold ${t.speaker === 'You' ? 'text-orange-400' : panel?.text ?? 'text-slate-400'}`}>
                      {t.speaker}
                    </span>
                    {t.argumentStrength && t.argumentStrength !== 'user' && (
                      <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${STRENGTH_BADGE[t.argumentStrength] ?? 'bg-slate-500/15 text-slate-400'}`}>
                        {t.argumentStrength}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-300 leading-relaxed">{t.statement}</p>
                </div>
              );
            })}
            {loading && (
              <div className="p-3 rounded-xl text-xs text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.15s]" />
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.3s]" />
                <span className="ml-1">Orchestrator is selecting the next speaker…</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}