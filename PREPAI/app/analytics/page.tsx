'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart2, Activity, Gauge } from 'lucide-react';

interface SessionMetrics {
  technicalScore: number;
  communicationScore: number;
  confidenceScore: number;
}

interface SessionLogEntry {
  _id: string;
  sessionType: 'technical' | 'group-discussion';
  transcript: { sender: string; message: string }[];
  metrics: SessionMetrics;
  createdAt: string;
}

const USER_ID = '658a1f2b3c4d5e6f7a8b9c0d';

export default function AnalyticsPage() {
  const [sessions, setSessions] = useState<SessionLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/sessions?userId=${USER_ID}`)
      .then((res) => res.json())
      .then((data) => setSessions(data.sessions || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const avg = (key: keyof SessionMetrics) =>
    sessions.length
      ? Math.round(sessions.reduce((sum, s) => sum + (s.metrics?.[key] ?? 0), 0) / sessions.length)
      : 0;

  const scorecards = [
    { label: 'Technical Accuracy', value: avg('technicalScore'), color: 'text-violet-400', bar: 'bg-blue-500' },
    { label: 'Communication Clarity', value: avg('communicationScore'), color: 'text-orange-400', bar: 'bg-emerald-500' },
    { label: 'Confidence', value: avg('confidenceScore'), color: 'text-amber-400', bar: 'bg-amber-500' },
  ];

  return (
    <main className="min-h-screen aurora text-slate-100 p-6 md:p-12 relative">
      <div className="max-w-5xl mx-auto space-y-8 relative z-10">
        <div className="flex items-center gap-4 border-b border-slate-800 pb-6">
          <Link href="/dashboard" className="p-2 glass hover:bg-slate-800/60 rounded-lg transition text-slate-300">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gradient">Session Analytics & Diagnostic Reports</h1>
            <p className="text-slate-400 text-sm mt-1">Post-session breakdown of technical accuracy, communication clarity, and confidence.</p>
          </div>
        </div>

        {loading ? (
          <p className="text-slate-400">Loading session data…</p>
        ) : sessions.length === 0 ? (
          <p className="text-slate-400">No completed sessions yet. Run an interview or group discussion to generate reports.</p>
        ) : (
          <>
            {/* Aggregate Scorecards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {scorecards.map((card) => (
                <div key={card.label} className="glass card-glow p-6 rounded-2xl animate-fade-up">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-400">{card.label}</p>
                    <Gauge className={`w-5 h-5 ${card.color}`} />
                  </div>
                  <h3 className={`text-3xl font-bold mt-2 ${card.color}`}>{card.value}/100</h3>
                  <div className="w-full bg-slate-800/70 rounded-full h-2 mt-4">
                    <div className={`h-2 rounded-full ${card.bar} shadow-[0_0_10px_rgba(16,185,129,0.4)] transition-all duration-700`} style={{ width: `${card.value}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Session History */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="w-5 h-5 text-fuchsia-400" /> Session History
              </h2>
              {sessions.map((s) => (
                <div key={s._id} className="glass card-glow rounded-2xl p-5 animate-fade-up">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-semibold px-2 py-1 rounded bg-fuchsia-500/10 text-fuchsia-400">
                      {s.sessionType === 'technical' ? '1-on-1 Technical' : 'Group Discussion'}
                    </span>
                    <span className="text-xs text-slate-500">{new Date(s.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                    <div><span className="text-slate-500">Technical:</span> <span className="font-bold text-violet-400">{s.metrics?.technicalScore ?? '—'}</span></div>
                    <div><span className="text-slate-500">Communication:</span> <span className="font-bold text-orange-400">{s.metrics?.communicationScore ?? '—'}</span></div>
                    <div><span className="text-slate-500">Confidence:</span> <span className="font-bold text-amber-400">{s.metrics?.confidenceScore ?? '—'}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
