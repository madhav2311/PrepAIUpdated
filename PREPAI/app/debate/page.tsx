'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Flame, Mic, MicOff, PhoneOff, Timer, Trophy, Loader2, Send, Volume2 } from 'lucide-react';
import { speak, stopSpeaking, loadVoices } from '@/lib/speech';

interface Turn {
  speaker: 'user' | 'opponent';
  text: string;
}

const SIDES = ['For', 'Against'];
type Mode = 'ai' | 'friend';

export default function DebatePage() {
  const [step, setStep] = useState<'setup' | 'live' | 'result'>('setup');
  const [mode, setMode] = useState<Mode>('ai');
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [topic, setTopic] = useState('Should college degrees be required for software engineering jobs?');
  const [userSide, setUserSide] = useState('For');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [turnCount, setTurnCount] = useState(0);
  const [opponentTyping, setOpponentTyping] = useState(false);
  const [userText, setUserText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [verdict, setVerdict] = useState<any>(null);
  const [ending, setEnding] = useState(false);
  // ---- Friend mode state ----
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [friendVerdict, setFriendVerdict] = useState<any>(null);
  const [opponentName, setOpponentName] = useState('Friend');
  const recognitionRef = useRef<any>(null);
  const historyRef = useRef<Turn[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadVoices();
    fetch('/api/auth')
      .then((r) => setAuthed(r.ok))
      .catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    if (step !== 'live') return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [step]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, opponentTyping]);

  // ---- Friend mode: poll room state while waiting or live ----
  const roomPollRef = useRef<any>(null);
  useEffect(() => {
    if (mode !== 'friend' || step === 'result') return;
    if (roomPollRef.current) return;
    roomPollRef.current = setInterval(async () => {
      if (!roomCode) return;
      try {
        const res = await fetch(`/api/debate-room?code=${roomCode}`);
        if (!res.ok) return;
        const d = await res.json();
        const room = d.room;
        if (!room) return;
        if (room.status === 'active' && step === 'setup') {
          // Friend joined — go live with the HOST's chosen topic/side
          setStep('live');
        }
        if (room.status === 'active' || room.status === 'ended') {
          const mapped: Turn[] = (room.turns || []).map((t: any) => ({ speaker: t.speaker === 'you' ? 'user' : 'opponent', text: t.text }));
          if (JSON.stringify(mapped) !== JSON.stringify(historyRef.current)) {
            historyRef.current = mapped;
            setTurns(mapped);
            setTurnCount(mapped.length);
            const last = mapped[mapped.length - 1];
            if (last?.speaker === 'opponent') speak(last.text, { gender: 'male', rate: 1.1 });
          }
        }
        if (room.status === 'ended' && room.verdict && step === 'live') {
          if (roomPollRef.current) { clearInterval(roomPollRef.current); roomPollRef.current = null; }
          setFriendVerdict(room.verdict);
          setStep('result');
        }
      } catch { }
    }, 2500);
    return () => { if (roomPollRef.current) { clearInterval(roomPollRef.current); roomPollRef.current = null; } };
  }, [mode, step, roomCode]);

  const opponentSide = userSide === 'For' ? 'Against' : 'For';
  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  const opponentReply = async (history: Turn[]) => {
    setOpponentTyping(true);
    try {
      const res = await fetch('/api/debate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, userSide, opponentSide, difficulty, action: 'speak', history }),
      });
      const d = await res.json();
      const argument = d.argument || "I'll push back on that — your position leans on an assumption that doesn't hold in practice.";
      historyRef.current = [...history, { speaker: 'opponent', text: argument }];
      setTurns(historyRef.current);
      setTurnCount((c) => c + 1);
      speak(argument, { gender: 'female', rate: 1.15 });
    } catch {
      setError('Connection hiccup — try again.');
    } finally {
      setOpponentTyping(false);
    }
  };

  const startDebate = () => {
    setStep('live');
    historyRef.current = [];
    setTurns([]);
    setTurnCount(0);
    setSeconds(0);
    setError('');
    if (mode === 'friend') return; // friend debates start via the room poller
    // Opponent opens the debate
    setTimeout(() => opponentReply([]), 400);
  };

  const submitArgument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userText.trim() || opponentTyping) return;
    stopSpeaking();
    const sent = userText;
    setUserText('');
    if (mode === 'friend') {
      // ---- Friend mode: post to shared room; polling renders both sides ----
      setOpponentTyping(true);
      fetch('/api/debate-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'speak', code: roomCode, text: sent }),
      }).finally(() => setOpponentTyping(false));
      return;
    }
    historyRef.current = [...historyRef.current, { speaker: 'user', text: sent }];
    setTurns(historyRef.current);
    setTurnCount((c) => c + 1);
    opponentReply(historyRef.current);
  };

  const toggleMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return alert('Speech recognition requires Chrome or Edge.');
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { }
      recognitionRef.current = null;
      setIsRecording(false);
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onstart = () => setIsRecording(true);
    rec.onresult = (ev: any) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) {
          const t = ev.results[i][0].transcript;
          setUserText((prev: string) => (prev ? `${prev} ${t}` : t));
        }
      }
    };
    rec.onerror = () => { };
    rec.onend = () => {
      if (recognitionRef.current === rec) recognitionRef.current = null;
      setIsRecording(false);
    };
    recognitionRef.current = rec;
    rec.start();
  };

  const endDebate = async () => {
    stopSpeaking();
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { }
      recognitionRef.current = null;
      setIsRecording(false);
    }
    if (mode === 'friend') {
      // ---- Friend mode: ask the server to judge the shared transcript ----
      setEnding(true);
      try {
        await fetch('/api/debate-room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'verdict', code: roomCode }),
        });
        // Polling effect will pick up the verdict; set a timeout fallback
        setTimeout(() => {
          if (step === 'live') { setFriendVerdict({ winner: 'tie', summary: 'Judging is taking a while — check back or rematch.' }); setStep('result'); }
        }, 12000);
      } catch {
        setError('Could not judge the debate.');
        setEnding(false);
      }
      return;
    }
    setEnding(true);
    try {
      const res = await fetch('/api/debate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, userSide, opponentSide, action: 'verdict', history: historyRef.current }),
      });
      const d = await res.json();
      setVerdict(d);
      setStep('result');
      // Persist session
      await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionType: 'debate',
          transcript: historyRef.current.map((t) => ({ sender: t.speaker === 'user' ? 'You' : 'Riya', message: t.text })),
          metrics: {
            technicalScore: d.userScore ?? 50,
            communicationScore: d.userScore ?? 50,
            confidenceScore: d.userScore ?? 50,
          },
        }),
      });
    } catch {
      setError('Could not judge the debate — but your session still counts.');
      setStep('result');
    } finally {
      setEnding(false);
    }
  };

  // ---- Friend mode: create a shared room ----
  const createFriendRoom = async () => {
    setError('');
    try {
      const res = await fetch('/api/debate-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', topic, side: userSide }),
      });
      const d = await res.json();
      if (!d.code) throw new Error(d.error || 'Could not create room');
      setRoomCode(d.code);
    } catch (e: any) { setError(e.message); }
  };

  // ---- Friend mode: join a friend's room ----
  const joinFriendRoom = async () => {
    setError('');
    try {
      const res = await fetch('/api/debate-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', code: joinCode.trim().toUpperCase() }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setRoomCode(joinCode.trim().toUpperCase());
      setStep('live');
    } catch (e: any) { setError(e.message); }
  };

  if (authed === false) {
    return (
      <div className="min-h-screen aurora text-slate-100 p-8 flex items-center justify-center relative">
        <div className="max-w-md w-full glass rounded-2xl p-8 text-center relative z-10 animate-fade-up">
          <div className="p-3 bg-orange-500/10 text-orange-400 rounded-xl ring-1 ring-orange-500/30 w-fit mx-auto mb-4">
            <Flame className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-gradient mb-2">Sign in to debate</h1>
          <p className="text-sm text-slate-400 mb-6">1-on-1 live voice debates are for signed-in members. Create a free account to step into the arena.</p>
          <Link href="/login" className="btn-hot w-full bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 text-slate-950 font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30">
            <Flame className="w-4 h-4" /> Sign In
          </Link>
          <p className="text-xs text-slate-500 mt-4">New here? <Link href="/signup" className="text-orange-400 hover:underline">Create an account</Link></p>
        </div>
      </div>
    );
  }

  if (step === 'setup') {
    return (
      <div className="min-h-screen aurora text-slate-100 p-8 flex items-center justify-center relative">
        <div className="max-w-xl w-full glass rounded-2xl p-8 shadow-2xl relative z-10 animate-fade-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-orange-500/10 text-orange-400 rounded-xl ring-1 ring-orange-500/30">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gradient">1-on-1 Voice Debate</h1>
              <p className="text-xs text-slate-400">Debate the AI (Riya) or invite a friend with a room code.</p>
            </div>
          </div>

          <label className="text-xs font-medium text-slate-300 block mb-1.5">Opponent</label>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {([
              { id: 'ai', label: 'AI — Riya' },
              { id: 'friend', label: 'Invite a Friend' },
            ] as const).map((m) => (
              <button
                key={m.id}
                onClick={() => { setMode(m.id); setRoomCode(''); }}
                className={`text-sm font-semibold py-2.5 rounded-xl border transition ${mode === m.id
                  ? 'bg-orange-500/15 border-orange-500/50 text-orange-300'
                  : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-600'
                  }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {mode === 'friend' && roomCode && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center mb-4">
              <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">Share this room code</span>
              <div className="text-2xl font-bold text-white tracking-widest my-1">{roomCode}</div>
              <p className="text-[10px] text-slate-400">Waiting for your friend to join… the debate starts automatically.</p>
            </div>
          )}

          {mode === 'friend' && !roomCode && (
            <div className="flex gap-2 mb-4">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Or enter a friend's code…"
                className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-orange-500 uppercase tracking-widest"
              />
              <button onClick={joinFriendRoom} className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-semibold px-4 rounded-xl hover:bg-emerald-500/25 transition">
                Join
              </button>
            </div>
          )}

          <label className="text-xs font-medium text-slate-300 block mb-1.5">Debate Topic</label>
          <textarea
            rows={3}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-orange-500 mb-4"
          />

          <label className="text-xs font-medium text-slate-300 block mb-1.5">Your Side</label>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {SIDES.map((s) => (
              <button
                key={s}
                onClick={() => setUserSide(s)}
                className={`text-sm font-semibold py-2.5 rounded-xl border transition ${userSide === s
                  ? 'bg-orange-500/15 border-orange-500/50 text-orange-300'
                  : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-600'
                  }`}
              >
                {s}
              </button>
            ))}
          </div>

          <label className="text-xs font-medium text-slate-300 block mb-1.5">Opponent Intensity</label>
          <div className="grid grid-cols-3 gap-2 mb-6">
            {(['easy', 'medium', 'hard'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`text-xs font-semibold py-2.5 rounded-xl border transition capitalize ${difficulty === d
                  ? 'bg-fuchsia-500/15 border-fuchsia-500/50 text-fuchsia-300'
                  : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-600'
                  }`}
              >
                {d}
              </button>
            ))}
          </div>

          {mode === 'friend' && roomCode ? (
            <button
              onClick={() => setStep('live')}
              className="btn-hot w-full bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 text-slate-950 font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30"
            >
              <Flame className="w-4 h-4" /> Go to Debate Room
            </button>
          ) : (
            <button
              onClick={startDebate}
              className="btn-hot w-full bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 text-slate-950 font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30"
            >
              <Flame className="w-4 h-4" /> Start the Debate Call
            </button>
          )}
        </div>
      </div>
    );
  }

  if (step === 'result') {
    return (
      <div className="min-h-screen aurora text-slate-100 p-8 flex items-center justify-center relative">
        <div className="max-w-xl w-full glass rounded-2xl p-8 relative z-10 animate-fade-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-orange-500/10 text-orange-400 rounded-xl ring-1 ring-orange-500/30">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gradient">Debate Verdict</h1>
              <p className="text-xs text-slate-400">{topic}</p>
            </div>
          </div>
          {(() => {
            const v = mode === 'friend' ? friendVerdict : verdict;
            const isFriend = mode === 'friend';
            if (!v) return <p className="text-sm text-slate-400">{error || (isFriend ? 'Waiting for the AI judge…' : 'No verdict available.')}</p>;
            if (isFriend) {
              // Friend verdict is host/guest-perspective with real names
              const winName = v.winner === 'host' ? v.hostName : v.winner === 'guest' ? v.guestName : null;
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="glass rounded-xl p-4">
                      <div className="text-2xl font-bold text-orange-400">{v.hostScore ?? '—'}</div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">{v.hostName ?? 'Host'}</div>
                    </div>
                    <div className="glass rounded-xl p-4 flex flex-col items-center justify-center">
                      <span className={`text-sm font-bold ${winName ? 'text-orange-400' : 'text-slate-300'}`}>
                        {winName ? `${winName} wins!` : 'Tie'}
                      </span>
                    </div>
                    <div className="glass rounded-xl p-4">
                      <div className="text-2xl font-bold text-fuchsia-400">{v.guestScore ?? '—'}</div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">{v.guestName ?? 'Guest'}</div>
                    </div>
                  </div>
                  {v.summary && <p className="text-sm text-slate-300 leading-relaxed">{v.summary}</p>}
                  {v.hostStrengths && <div className="bg-orange-500/10 border border-orange-500/25 rounded-xl p-3 text-xs text-slate-300"><span className="font-semibold text-orange-400">{v.hostName}: </span>{v.hostStrengths}</div>}
                  {v.guestStrengths && <div className="bg-fuchsia-500/10 border border-fuchsia-500/25 rounded-xl p-3 text-xs text-slate-300"><span className="font-semibold text-fuchsia-400">{v.guestName}: </span>{v.guestStrengths}</div>}
                </div>
              );
            }
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="glass rounded-xl p-4">
                    <div className="text-2xl font-bold text-orange-400">{v.userScore ?? '—'}</div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">You</div>
                  </div>
                  <div className="glass rounded-xl p-4 flex flex-col items-center justify-center">
                    <span className={`text-sm font-bold ${v.winner === 'user' ? 'text-orange-400' : v.winner === 'opponent' ? 'text-fuchsia-400' : 'text-slate-300'}`}>
                      {v.winner === 'user' ? 'You win!' : v.winner === 'opponent' ? 'Riya wins' : 'Tie'}
                    </span>
                  </div>
                  <div className="glass rounded-xl p-4">
                    <div className="text-2xl font-bold text-fuchsia-400">{v.opponentScore ?? '—'}</div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">Riya</div>
                  </div>
                </div>
                {v.summary && <p className="text-sm text-slate-300 leading-relaxed">{v.summary}</p>}
                {v.userStrengths && (
                  <div className="bg-orange-500/10 border border-orange-500/25 rounded-xl p-3 text-xs text-slate-300">
                    <span className="font-semibold text-orange-400">Strengths: </span>{v.userStrengths}
                  </div>
                )}
                {v.userImprovements && (
                  <div className="bg-fuchsia-500/10 border border-fuchsia-500/25 rounded-xl p-3 text-xs text-slate-300">
                    <span className="font-semibold text-fuchsia-400">Improvements: </span>{v.userImprovements}
                  </div>
                )}
              </div>
            );
          })()}
          <div className="flex gap-3 mt-6">
            <button onClick={() => setStep('setup')} className="btn-hot flex-1 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 text-slate-950 font-semibold py-3 rounded-xl transition shadow-lg shadow-orange-500/30">
              Rematch
            </button>
            <Link href="/dashboard" className="glass hover:bg-slate-800/60 text-slate-200 font-medium py-3 px-5 rounded-xl transition flex items-center">
              <ArrowLeft className="w-4 h-4 mr-2" /> Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---- Live call ----
  return (
    <div className="min-h-screen aurora text-slate-100 p-6 md:p-8 relative">
      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Call header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-900">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="p-2 rounded-lg glass hover:bg-slate-800/60 text-slate-400 hover:text-white transition">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center font-bold text-white shadow-lg shadow-fuchsia-500/30">
                R
              </div>
              <div>
                <span className="block text-xs font-semibold text-fuchsia-400 uppercase tracking-wider">Live Voice Debate</span>
                <h1 className="text-lg font-bold text-gradient leading-tight">Riya <span className="text-slate-500 text-xs font-normal">· {opponentSide}</span></h1>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="glass px-4 py-2 rounded-xl flex items-center gap-2 text-xs text-slate-300">
              <Timer className="w-4 h-4 text-orange-400" /> {mmss}
            </div>
            <div className="glass px-4 py-2 rounded-xl text-xs text-slate-300">
              Turn <span className="text-orange-400 font-bold">{turnCount + 1}</span>
            </div>
            <button
              onClick={endDebate}
              disabled={ending}
              className="flex items-center gap-2 text-xs bg-rose-500/15 border border-rose-500/40 text-rose-400 px-4 py-2 rounded-xl hover:bg-rose-500/25 transition disabled:opacity-50"
            >
              <PhoneOff className="w-4 h-4" /> {ending ? 'Judging…' : 'End Call'}
            </button>
          </div>
        </div>

        {error && <div className="glass rounded-xl px-4 py-2.5 mb-4 text-xs text-rose-400">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="glass card-glow rounded-2xl p-6 animate-fade-up">
              <span className="text-xs bg-orange-950/60 text-orange-400 border border-orange-700/40 px-2.5 py-1 rounded-md font-medium">
                Topic · You argue {userSide}
              </span>
              <h2 className="text-lg font-bold text-gradient mt-3">{topic}</h2>
            </div>

            <div className="glass rounded-2xl p-6 animate-fade-up" style={{ animationDelay: '0.08s' }}>
              <form onSubmit={submitArgument} className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-orange-400">Your Argument</span>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">{isRecording ? '🔴 Mic live — click to stop' : 'Voice or text'}</span>
                </div>
                <textarea
                  rows={4}
                  value={userText}
                  onChange={(e) => setUserText(e.target.value)}
                  placeholder={opponentTyping ? 'Riya is responding…' : 'Make your point — or keep the mic open and just talk…'}
                  disabled={opponentTyping}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 focus:outline-none focus:border-orange-500 disabled:opacity-60"
                />
                <div className="flex justify-between items-center">
                  <button
                    type="button"
                    onClick={toggleMic}
                    className={`px-4 py-2 rounded-xl text-xs font-medium border flex items-center gap-2 transition ${isRecording ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse-ring' : 'glass text-slate-300'}`}
                  >
                    {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    {isRecording ? 'Stop Mic' : 'Use Mic'}
                  </button>
                  <button
                    type="submit"
                    disabled={opponentTyping || !userText.trim()}
                    className="btn-hot bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 text-slate-950 font-semibold px-6 py-2.5 rounded-xl transition shadow-lg shadow-orange-500/30 flex items-center gap-2 text-sm disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" /> Deliver
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="glass rounded-2xl p-5 flex flex-col h-[520px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-sm font-semibold text-white">Debate Flow</h3>
              <span className="text-[10px] text-fuchsia-400 bg-fuchsia-950/60 px-2 py-0.5 rounded border border-fuchsia-700/40">1 v 1</span>
            </div>
            <div ref={feedRef} className="flex-1 overflow-y-auto space-y-3 pr-1">
              {turns.map((t, i) => (
                <div key={i} className={`p-3 rounded-xl text-xs animate-fade-up ${t.speaker === 'user' ? 'bg-orange-500/10 border border-orange-500/25 text-slate-200 ml-4' : 'bg-slate-950/60 border border-slate-800/60 text-slate-300 mr-4'}`}>
                  <span className={`font-semibold block mb-1 text-[10px] uppercase tracking-wider ${t.speaker === 'user' ? 'text-orange-400' : 'text-fuchsia-400'}`}>
                    {t.speaker === 'user' ? 'You' : 'Riya'}
                  </span>
                  <p className="leading-relaxed">{t.text}</p>
                </div>
              ))}
              {opponentTyping && (
                <div className="p-3 rounded-xl text-xs text-slate-400 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-fuchsia-400" /> Riya is crafting her rebuttal…
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
