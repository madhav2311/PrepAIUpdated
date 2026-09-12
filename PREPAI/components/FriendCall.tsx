'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Phone, PhoneOff, Mic, MicOff, PhoneIncoming, Loader2, PhoneCall, Signal, AudioWaveform } from 'lucide-react';

// Friend-to-friend direct voice call over WebRTC P2P.
// Signaling (offer/answer/ICE) is exchanged through /api/call with polling.
// Caller = host (creates offer). Callee = guest (answers).

interface FriendCallProps {
  friends: { id: string; name: string; avatar?: string | null }[];
}

const POLL_MS = 1500;

export default function FriendCall({ friends }: FriendCallProps) {
  const [view, setView] = useState<'idle' | 'ringing-out' | 'call' | 'judging' | 'result'>('idle');
  const [callCode, setCallCode] = useState('');
  const [peerName, setPeerName] = useState('');
  const [incoming, setIncoming] = useState<{ code: string; from: string } | null>(null);
  const [muted, setMuted] = useState(false);
  const [err, setErr] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState<any>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const sinceRef = useRef(0);
  const pollRef = useRef<any>(null);
  const codeRef = useRef('');
  const isCallerRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const hangUpRef = useRef<() => void>(() => { });

  // ---- Poll for incoming calls ----
  useEffect(() => {
    const t = setInterval(async () => {
      if (view !== 'idle') return;
      try {
        const res = await fetch('/api/call');
        const d = await res.json();
        if (d.incoming) setIncoming(d.incoming);
      } catch { }
    }, 4000);
    return () => clearInterval(t);
  }, [view]);

  const cleanup = useCallback((keepCode = false) => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    try { recognitionRef.current?.stop(); } catch { }
    recognitionRef.current = null;
    try { pcRef.current?.getSenders().forEach((s) => s.track?.stop()); } catch { }
    try { localStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch { }
    try { pcRef.current?.close(); } catch { }
    pcRef.current = null;
    localStreamRef.current = null;
    sinceRef.current = 0;
    if (!keepCode) { codeRef.current = ''; setCallCode(''); }
    setView('idle');
    setConnecting(false);
    setMuted(false);
    setConnected(false);
    setSeconds(0);
    transcriptRef.current = '';
  }, []);

  // ---- Call duration timer ----
  useEffect(() => {
    if (view !== 'call' || !connected) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [view, connected]);

  const sendSignal = async (kind: string, payload: any) => {
    await fetch('/api/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'signal', code: codeRef.current, kind, payload }),
    });
  };

  // ---- Handle signals arriving from the peer ----
  const handleSignals = useCallback(async (signals: any[]) => {
    const pc = pcRef.current;
    if (!pc) return;
    for (const s of signals) {
      try {
        if (s.kind === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(s.payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal('answer', { type: answer.type, sdp: answer.sdp });
        } else if (s.kind === 'answer') {
          if (pc.signalingState !== 'stable' && pc.signalingState !== 'have-local-offer') continue;
          await pc.setRemoteDescription(new RTCSessionDescription(s.payload));
        } else if (s.kind === 'ice' && s.payload) {
          try { await pc.addIceCandidate(new RTCIceCandidate(s.payload)); } catch { }
        } else if (s.kind === 'hangup') {
          // Peer hung up first — still route through the full end-of-call flow
          hangUpRef.current();
          return;
        }
      } catch { /* transient ICE/SDP races are safe to ignore */ }
    }
  }, [cleanup]);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/call?code=${codeRef.current}&since=${sinceRef.current}`);
        if (!res.ok) return;
        const d = await res.json();
        const call = d.call;
        if (!call) return;
        sinceRef.current = call.count;
        if (call.signals?.length) await handleSignals(call.signals);
        if (call.status === 'ended') {
          // Peer ended first — still generate/collect my results
          hangUpRef.current();
          return;
        }
      } catch { }
    }, POLL_MS);
  }, [handleSignals, cleanup]);

  const buildPeer = useCallback(async () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
    });
    pcRef.current = pc;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStreamRef.current = stream;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    pc.ontrack = (ev) => {
      if (audioRef.current) {
        audioRef.current.srcObject = ev.streams[0];
        audioRef.current.play().catch(() => { });
      }
    };
    pc.onicecandidate = (ev) => {
      if (ev.candidate) sendSignal('ice', ev.candidate.toJSON());
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setConnected(true);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') setErr('Connection lost.');
    };
    return pc;
  }, []);

  // ---- Caller: ring a friend ----
  const callFriend = async (friendId: string, name: string) => {
    setErr('');
    setPeerName(name);
    setView('ringing-out');
    try {
      const res = await fetch('/api/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invite', friendId }),
      });
      const d = await res.json();
      if (!d.code) throw new Error(d.error || 'Could not start the call');
      codeRef.current = d.code;
      setCallCode(d.code);
      // Poll until the friend accepts
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/call?code=${codeRef.current}&since=${sinceRef.current}`);
          const c = await r.json();
          if (!c.call) return;
          sinceRef.current = c.call.count;
          if (c.call.status === 'active') {
            clearInterval(pollRef.current);
            pollRef.current = null;
            await beginCall(true);
          }
        } catch { }
      }, 2000);
    } catch (e: any) {
      setErr(e.message);
      setView('idle');
    }
  };

  // ---- Callee: accept incoming call ----
  const acceptIncoming = async () => {
    if (!incoming) return;
    setPeerName(incoming.from);
    codeRef.current = incoming.code;
    setCallCode(incoming.code);
    setIncoming(null);
    isCallerRef.current = false;
    await fetch('/api/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept', code: codeRef.current }),
    });
    await beginCall(false);
  };

  const rejectIncoming = async () => {
    if (!incoming) return;
    await fetch('/api/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', code: incoming.code }),
    });
    setIncoming(null);
  };

  const beginCall = async (asCaller: boolean) => {
    isCallerRef.current = asCaller;
    setView('call');
    setConnecting(true);
    setErr('');
    try {
      await buildPeer();
      startPolling();
      startTranscribing();
      if (asCaller) {
        const offer = await pcRef.current!.createOffer();
        await pcRef.current!.setLocalDescription(offer);
        await sendSignal('offer', { type: offer.type, sdp: offer.sdp });
      }
    } catch (e: any) {
      setErr('Microphone access denied or connection failed.');
      cleanup(true);
    } finally {
      setConnecting(false);
    }
  };

  // ---- Live speech-to-text of MY side during the call (for the end-of-call report) ----
  const startTranscribing = () => {
    try {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) return; // no STT — call still works, just no transcript
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = 'en-US';
      rec.onresult = (ev: any) => {
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          if (ev.results[i].isFinal) {
            const t = ev.results[i][0].transcript.trim();
            if (t) transcriptRef.current = transcriptRef.current ? `${transcriptRef.current} ${t}` : t;
          }
        }
      };
      rec.onerror = () => { };
      // Chrome auto-stops after silence — restart while the call is live
      rec.onend = () => {
        if (recognitionRef.current === rec) {
          try { rec.start(); } catch { }
        }
      };
      recognitionRef.current = rec;
      rec.start();
    } catch { }
  };

  const endCallRequest = async () => {
    try {
      await fetch('/api/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end', code: codeRef.current }),
      });
    } catch { }
  };

  const hangUp = async () => {
    // Stop the speech recognizer BEFORE reading the transcript
    try { recognitionRef.current?.stop(); } catch { }
    recognitionRef.current = null;
    const myTranscript = transcriptRef.current;
    setView('judging');
    let verdict: any = null;
    try {
      const res = await fetch('/api/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end', code: codeRef.current, transcript: myTranscript }),
      });
      const d = await res.json();
      verdict = d.verdict ?? null;
    } catch { }
    // Persist the session + award XP
    if (verdict) {
      try {
        await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionType: 'friend-call',
            transcript: [{ sender: 'You', message: myTranscript || '(no speech captured)' }],
            metrics: {
              technicalScore: verdict.overallScore ?? 0,
              communicationScore: verdict.communicationScore ?? 0,
              confidenceScore: verdict.confidenceScore ?? 0,
            },
          }),
        });
      } catch { }
    }
    transcriptRef.current = '';
    codeRef.current = '';
    setCallCode('');
    setResult(verdict);
    setView('result');
    setConnecting(false);
    setMuted(false);
    setConnected(false);
    setSeconds(0);
    // tear down media without resetting the result view
    try { pcRef.current?.getSenders().forEach((s) => s.track?.stop()); } catch { }
    try { localStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch { }
    try { pcRef.current?.close(); } catch { }
    pcRef.current = null;
    localStreamRef.current = null;
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  hangUpRef.current = hangUp;

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMuted(!track.enabled);
    }
  };

  // Cancel an outgoing ring
  const cancelRing = async () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    await endCallRequest();
    cleanup();
  };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  if (view === 'idle' && !incoming) {
    return (
      <div className="glass rounded-2xl p-5 animate-fade-up">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <PhoneCall className="w-3.5 h-3.5 text-white" />
            </span>
            Practice Calls
          </h3>
          <span className="text-[9px] uppercase tracking-widest text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full">P2P</span>
        </div>
        <p className="text-xs text-slate-400 mb-4">Tap a friend for a real 1-on-1 voice call — right in the browser.</p>
        {friends.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700/70 py-6 text-center">
            <p className="text-xs text-slate-500">No one to call yet — add friends above first.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {friends.map((f) => (
              <button
                key={f.id}
                onClick={() => callFriend(f.id, f.name)}
                className="w-full group flex items-center gap-3 bg-slate-950/50 hover:bg-slate-900/80 border border-slate-800/70 hover:border-emerald-500/40 rounded-xl px-3 py-2.5 transition text-left"
              >
                <span className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                  {f.name.charAt(0).toUpperCase()}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-semibold text-slate-200 truncate group-hover:text-white">{f.name}</span>
                  <span className="block text-[10px] text-slate-500">Tap to ring</span>
                </span>
                <span className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition">
                  <Phone className="w-3.5 h-3.5" />
                </span>
              </button>
            ))}
          </div>
        )}
        {err && <p className="text-xs text-rose-400 mt-3">{err}</p>}
      </div>
    );
  }

  if (view === 'idle' && incoming) {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[92%] max-w-sm animate-fade-up">
        <div className="rounded-2xl border border-emerald-500/40 bg-slate-950/90 backdrop-blur-xl p-4 shadow-2xl shadow-emerald-500/10">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold">
                {incoming.from.charAt(0).toUpperCase()}
              </div>
              <span className="absolute -inset-1 rounded-full border-2 border-emerald-400/60 animate-ping" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-semibold">Incoming call</p>
              <p className="text-sm font-semibold text-white truncate">{incoming.from}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={acceptIncoming} className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs py-2.5 rounded-xl transition shadow-lg shadow-emerald-500/30">
              <Phone className="w-3.5 h-3.5" /> Accept
            </button>
            <button onClick={rejectIncoming} className="flex-1 flex items-center justify-center gap-1.5 bg-rose-500/15 border border-rose-500/40 text-rose-400 text-xs font-semibold py-2.5 rounded-xl hover:bg-rose-500/25 transition">
              <PhoneOff className="w-3.5 h-3.5" /> Decline
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'ringing-out') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md animate-fade-up">
        <div className="text-center">
          <div className="relative inline-block mb-5">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center text-white font-bold text-2xl shadow-2xl shadow-orange-500/30">
              {peerName.charAt(0).toUpperCase()}
            </div>
            <span className="absolute -inset-2 rounded-full border-2 border-orange-400/50 animate-ping" />
            <span className="absolute -inset-4 rounded-full border border-orange-400/25 animate-ping [animation-delay:0.4s]" />
          </div>
          <h3 className="text-lg font-semibold text-white">Calling {peerName}…</h3>
          <p className="text-[11px] text-slate-500 mt-1 mb-6">Room {callCode} · waiting for them to pick up</p>
          <button
            onClick={cancelRing}
            className="mx-auto flex items-center gap-2 bg-rose-500 hover:bg-rose-400 text-white text-sm font-semibold px-6 py-3 rounded-full transition shadow-lg shadow-rose-500/30"
          >
            <PhoneOff className="w-4 h-4" /> Cancel
          </button>
        </div>
      </div>
    );
  }

  if (view === 'judging') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md animate-fade-up">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-orange-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white">Call ended</h3>
          <p className="text-xs text-slate-400 mt-1">The AI coach is grading your practice call…</p>
        </div>
      </div>
    );
  }

  if (view === 'result') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 backdrop-blur-xl p-6 animate-fade-up overflow-y-auto">
        <div className="max-w-lg w-full glass rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <PhoneCall className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gradient">Call Report</h1>
              <p className="text-xs text-slate-400">Practice call with {peerName} · saved to your history</p>
            </div>
          </div>
          {result ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                {[['Overall', result.overallScore], ['Comms', result.communicationScore], ['Confidence', result.confidenceScore]].map(([label, v]) => (
                  <div key={label as string} className="glass rounded-xl p-4">
                    <div className="text-2xl font-bold text-emerald-400">{v as number}</div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">{label as string}</div>
                  </div>
                ))}
              </div>
              {result.summary && <p className="text-sm text-slate-300 leading-relaxed">{result.summary}</p>}
              {result.strengths && (
                <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-3 text-xs text-slate-300">
                  <span className="font-semibold text-emerald-400 block mb-1">Strengths</span>{result.strengths}
                </div>
              )}
              {result.improvements && (
                <div className="bg-orange-500/10 border border-orange-500/25 rounded-xl p-3 text-xs text-slate-300">
                  <span className="font-semibold text-orange-400 block mb-1">Improvements</span>{result.improvements}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">The call ended, but the AI judge could not grade this session. It still counts toward your streak.</p>
          )}
          <button
            onClick={() => { setResult(null); setView('idle'); }}
            className="btn-hot w-full mt-6 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 text-slate-950 font-semibold py-3 rounded-xl transition shadow-lg shadow-orange-500/30"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // ---- In call: full-screen immersive call UI ----
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-slate-950/95 backdrop-blur-xl p-10 animate-fade-up overflow-hidden">
      <audio ref={audioRef} autoPlay />
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full bg-orange-500/5 blur-3xl" />
      </div>

      {/* Top status */}
      <div className="relative z-10 flex items-center gap-2 text-[11px] text-slate-400 mt-2">
        <AudioWaveform className="w-3.5 h-3.5 text-emerald-400" />
        {connected ? `Connected · ${mmss}` : connecting ? 'Connecting…' : 'Waiting for peer…'}
      </div>

      {/* Center avatar */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative mb-6">
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-4xl shadow-2xl shadow-emerald-500/30">
            {peerName.charAt(0).toUpperCase()}
          </div>
          {connected && (
            <>
              <span className="absolute -inset-2 rounded-full border-2 border-emerald-400/40 animate-ping" />
              <span className="absolute -inset-5 rounded-full border border-emerald-400/20 animate-ping [animation-delay:0.5s]" />
            </>
          )}
          {!connected && !connecting && (
            <span className="absolute -inset-2 rounded-full border-2 border-orange-400/40 animate-ping" />
          )}
          {muted && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-lg">
              Muted
            </span>
          )}
        </div>
        <h2 className="text-xl font-bold text-white">{peerName}</h2>
        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
          {connecting ? <><Loader2 className="w-3 h-3 animate-spin" /> establishing peer connection…</>
            : connected ? <><Signal className="w-3 h-3 text-emerald-400" /> peer-to-peer voice</>
              : 'ringing…'}
        </p>
        {err && <p className="text-xs text-rose-400 mt-2">{err}</p>}
      </div>

      {/* Controls */}
      <div className="relative z-10 flex items-center gap-4 mb-4">
        <button
          onClick={toggleMute}
          className={`p-4 rounded-full border transition ${muted ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-lg shadow-amber-500/30' : 'bg-slate-900/80 border-slate-700 text-slate-200 hover:bg-slate-800'}`}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>
        <button
          onClick={hangUp}
          className="p-4 rounded-full bg-rose-500 hover:bg-rose-400 text-white transition shadow-xl shadow-rose-500/40"
          title="Hang up"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
