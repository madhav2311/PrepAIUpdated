'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart2, Activity, Gauge, FileJson, FileSpreadsheet, Printer, TrendingUp, TrendingDown, Minus, Loader2, Target } from 'lucide-react';

interface SessionMetrics {
  technicalScore: number;
  communicationScore: number;
  confidenceScore: number;
}

interface SessionReport {
  overallScore?: number;
  summary?: string;
  progress?: string;
  strengths?: string;
  improvements?: string;
}

interface SessionLogEntry {
  _id: string;
  sessionType: string;
  transcript: { sender: string; message: string }[];
  metrics: SessionMetrics;
  report?: SessionReport | null;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  interview: 'Mock Interview',
  technical: '1-on-1 Technical',
  'group-discussion': 'Group Discussion',
  debate: 'Debate',
  'debate-room': 'Debate Room',
  'friend-call': 'Practice Call',
};

function overall(s: SessionLogEntry) {
  if (s.report?.overallScore) return s.report.overallScore;
  const m = s.metrics || ({} as SessionMetrics);
  return Math.round(((m.technicalScore ?? 0) + (m.communicationScore ?? 0) + (m.confidenceScore ?? 0)) / 3);
}

export default function AnalyticsPage() {
  const [sessions, setSessions] = useState<SessionLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    fetch('/api/sessions', { cache: 'no-store' })
      .then(async (res) => {
        if (res.status === 401) { setUnauthorized(true); return null; }
        return res.json();
      })
      .then((data) => setSessions(((data?.sessions || []) as SessionLogEntry[]).slice().sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const n = sessions.length;
    const avgOf = (k: keyof SessionMetrics) => n ? Math.round(sessions.reduce((s, x) => s + (x.metrics?.[k] ?? 0), 0) / n) : 0;
    const overalls = sessions.map(overall);
    const avgOverall = n ? Math.round(overalls.reduce((a, b) => a + b, 0) / n) : 0;
    const trend = n >= 2 ? Math.round(overalls[n - 1] - overalls[n - 2]) : 0;
    const byType: Record<string, { count: number; avg: number }> = {};
    for (const s of sessions) {
      const t = s.sessionType;
      byType[t] = byType[t] || { count: 0, avg: 0 };
      byType[t].count += 1;
      byType[t].avg += overall(s);
    }
    Object.values(byType).forEach((v) => { v.avg = Math.round(v.avg / v.count); });
    // Most mentioned improvement themes across AI reports
    const words: Record<string, number> = {};
    sessions.forEach((s) => {
      (s.report?.improvements || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
        .filter((w) => w.length > 5 && !['because', 'session', 'would', 'should', 'could', 'answer', 'question', 'practice', 'always', 'every'].includes(w))
        .forEach((w) => { words[w] = (words[w] || 0) + 1; });
    });
    const topWeaknesses = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([w]) => ({ word: w }));
    const first5 = overalls.slice(0, Math.min(5, n));
    const last5 = overalls.slice(-5);
    return {
      n,
      technical: avgOf('technicalScore'),
      communication: avgOf('communicationScore'),
      confidence: avgOf('confidenceScore'),
      avgOverall,
      trend,
      byType,
      topWeaknesses,
      growth: n >= 2 ? Math.round(last5.reduce((a, b) => a + b, 0) / last5.length - first5.reduce((a, b) => a + b, 0) / first5.length) : 0,
    };
  }, [sessions]);

  // ---------- Downloads ----------
  const download = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    a.remove(); URL.revokeObjectURL(url);
  };

  const downloadJson = () => {
    download(JSON.stringify({
      exportedAt: new Date().toISOString(),
      summary: { totalSessions: stats.n, avgOverall: stats.avgOverall, avgTechnical: stats.technical, avgCommunication: stats.communication, avgConfidence: stats.confidence },
      sessions: sessions.map((s) => ({ date: s.createdAt, type: s.sessionType, overall: overall(s), metrics: s.metrics, report: s.report ?? undefined })),
    }, null, 2), `prepai-progress-${Date.now()}.json`, 'application/json');
  };

  const downloadCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Date', 'Type', 'Overall', 'Technical', 'Communication', 'Confidence', 'Summary', 'Improvements'].join(',')];
    sessions.forEach((s) => rows.push([
      new Date(s.createdAt).toLocaleDateString(), TYPE_LABELS[s.sessionType] || s.sessionType,
      overall(s), s.metrics?.technicalScore ?? '', s.metrics?.communicationScore ?? '', s.metrics?.confidenceScore ?? '',
      s.report?.summary ?? '', s.report?.improvements ?? '',
    ].map(esc).join(',')));
    download('\ufeff' + rows.join('\n'), `prepai-progress-${Date.now()}.csv`, 'text/csv');
  };

  const downloadPrintable = () => {
    const rows = sessions.map((s, i) => `
      <tr style="background:${i % 2 ? '#faf9fd' : '#fff'}">
        <td>${new Date(s.createdAt).toLocaleDateString()}</td>
        <td>${TYPE_LABELS[s.sessionType] || s.sessionType}</td>
        <td><b>${overall(s)}</b></td>
        <td>${s.metrics?.technicalScore ?? 'â€”'}</td>
        <td>${s.metrics?.communicationScore ?? 'â€”'}</td>
        <td>${s.metrics?.confidenceScore ?? 'â€”'}</td>
        <td style="font-size:10px">${s.report?.summary ?? ''} ${s.report?.improvements ? '<br><i>Focus: ' + String(s.report.improvements).replace(/</g, '&lt;') + '</i>' : ''}</td>
      </tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>PrepAI Progress Report</title>
      <style>
        body{font-family:'Segoe UI',system-ui,sans-serif;padding:36px;color:#1e1b2e;max-width:900px;margin:auto}
        h1{color:#ea580c;margin:0}
        .cards{display:flex;gap:14px;margin:22px 0}
        .card{flex:1;border:1px solid #e5e0f0;border-radius:14px;padding:16px;text-align:center;background:#faf9fd}
        .card b{font-size:30px;display:block}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th{background:#1e1b2e;color:#fff;text-align:left;padding:8px}
        td{padding:8px;border-bottom:1px solid #eee;vertical-align:top}
        .meta{color:#6b6787;font-size:12px}
        @media print{ .noprint{display:none} }
      </style></head><body>
      <h1>PrepAI Progress Report</h1>
      <p class="meta">Generated ${new Date().toLocaleString()} Â· ${stats.n} sessions Â· Avg overall ${stats.avgOverall}/100</p>
      <div class="cards">
        <div class="card"><span class="meta">Overall</span><b>${stats.avgOverall}</b></div>
        <div class="card"><span class="meta">Technical</span><b>${stats.technical}</b></div>
        <div class="card"><span class="meta">Communication</span><b>${stats.communication}</b></div>
        <div class="card"><span class="meta">Confidence</span><b>${stats.confidence}</b></div>
      </div>
      <table><thead><tr><th>Date</th><th>Type</th><th>Overall</th><th>Technical</th><th>Comm</th><th>Conf</th><th>AI Feedback</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="noprint" style="margin-top:24px"><button onclick="print()" style="padding:10px 22px;background:#ea580c;color:#fff;border:0;border-radius:8px;font-size:14px;cursor:pointer">Save as PDF / Print</button></p>
      </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  // ---------- Chart geometry ----------
  const W = 640, H = 220, PAD = 34;
  const linePath = useMemo(() => {
    const pts = sessions.map((s, i) => {
      const x = PAD + (i * (W - PAD * 2)) / Math.max(1, sessions.length - 1);
      const y = H - PAD - (overall(s) / 100) * (H - PAD * 2);
      return [x, y] as const;
    });
    return pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  }, [sessions]);

  const radar = useMemo(() => {
    const R = 78;
    const skills = [
      { label: 'Tech', v: stats.technical },
      { label: 'Comm', v: stats.communication },
      { label: 'Conf', v: stats.confidence },
      { label: 'Overall', v: stats.avgOverall },
    ];
    const angle = (i: number) => (Math.PI * 2 * i) / skills.length - Math.PI / 2;
    const pt = (i: number, scale: number): [number, number] => [110 + Math.cos(angle(i)) * R * scale, 110 + Math.sin(angle(i)) * R * scale];
    return { skills, poly: skills.map((s, i) => pt(i, s.v / 100).join(',')).join(' '), angle, pt };
  }, [stats]);

  if (loading) {
    return (
      <div className="min-h-screen aurora text-slate-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="min-h-screen aurora text-slate-100 flex items-center justify-center p-6">
        <div className="glass rounded-2xl p-8 max-w-sm text-center">
          <h1 className="text-lg font-bold text-gradient mb-2">Sign in to see your progress</h1>
          <p className="text-sm text-slate-400 mb-5">Analytics are built from your saved practice sessions.</p>
          <Link href="/login" className="bg-gradient-to-r from-orange-500 to-rose-500 text-slate-950 font-semibold px-6 py-2.5 rounded-xl text-sm">Sign In</Link>
        </div>
      </div>
    );
  }

  const trendIcon = stats.trend > 4 ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : stats.trend < -4 ? <TrendingDown className="w-4 h-4 text-rose-400" /> : <Minus className="w-4 h-4 text-slate-400" />;
  const trendText = stats.trend > 0 ? `+${stats.trend}` : `${stats.trend}`;

  return (
    <main className="min-h-screen aurora text-slate-100 p-6 md:p-12 relative">
      <div className="max-w-5xl mx-auto space-y-8 relative z-10">
        {/* Header + downloads */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-6 flex-wrap">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="p-2 glass hover:bg-slate-800/60 rounded-lg transition text-slate-300">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-gradient">Progress & Analytics</h1>
              <p className="text-slate-400 text-sm mt-1">Your growth across every practice session â€” charts, trends and downloadable reports.</p>
            </div>
          </div>
          {sessions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button onClick={downloadPrintable} className="glass hover:bg-slate-800/60 text-xs text-slate-200 rounded-xl px-3.5 py-2.5 flex items-center gap-1.5 transition" title="Open a printable scorecard you can save as PDF">
                <Printer className="w-4 h-4 text-cyan-400" /> PDF Report
              </button>
              <button onClick={downloadCsv} className="glass hover:bg-slate-800/60 text-xs text-slate-200 rounded-xl px-3.5 py-2.5 flex items-center gap-1.5 transition" title="Download spreadsheet-compatible CSV">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> CSV
              </button>
              <button onClick={downloadJson} className="glass hover:bg-slate-800/60 text-xs text-slate-200 rounded-xl px-3.5 py-2.5 flex items-center gap-1.5 transition" title="Download raw data as JSON">
                <FileJson className="w-4 h-4 text-fuchsia-400" /> JSON
              </button>
            </div>
          )}
        </div>

        {sessions.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <BarChart2 className="w-10 h-10 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-300 font-medium">No completed sessions yet.</p>
            <p className="text-slate-500 text-sm mt-1 mb-5">Run an interview, debate or group discussion â€” every session builds your analytics here.</p>
            <Link href="/interview" className="inline-block bg-gradient-to-r from-orange-500 to-rose-500 text-slate-950 font-semibold px-6 py-2.5 rounded-xl text-sm">Start Practicing</Link>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="glass card-glow p-5 rounded-2xl animate-fade-up">
                <p className="text-xs text-slate-400 flex items-center gap-1.5"><Target className="w-3.5 h-3.5 text-orange-400" /> Avg Overall</p>
                <h3 className="text-3xl font-bold mt-1 text-white">{stats.avgOverall}<span className="text-sm text-slate-500">/100</span></h3>
                <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">{trendIcon} {stats.trend === 0 ? 'no change' : `${trendText} vs last session`}</p>
              </div>
              <div className="glass card-glow p-5 rounded-2xl animate-fade-up" style={{ animationDelay: '0.05s' }}>
                <p className="text-xs text-slate-400 flex items-center gap-1.5"><Gauge className="w-3.5 h-3.5 text-violet-400" /> Technical</p>
                <h3 className="text-3xl font-bold mt-1 text-violet-400">{stats.technical}</h3>
                <div className="w-full bg-slate-800/70 rounded-full h-1.5 mt-2"><div className="h-full bg-violet-500 rounded-full" style={{ width: `${stats.technical}%` }} /></div>
              </div>
              <div className="glass card-glow p-5 rounded-2xl animate-fade-up" style={{ animationDelay: '0.1s' }}>
                <p className="text-xs text-slate-400 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-cyan-400" /> Communication</p>
                <h3 className="text-3xl font-bold mt-1 text-cyan-400">{stats.communication}</h3>
                <div className="w-full bg-slate-800/70 rounded-full h-1.5 mt-2"><div className="h-full bg-cyan-500 rounded-full" style={{ width: `${stats.communication}%` }} /></div>
              </div>
              <div className="glass card-glow p-5 rounded-2xl animate-fade-up" style={{ animationDelay: '0.15s' }}>
                <p className="text-xs text-slate-400 flex items-center gap-1.5"><Gauge className="w-3.5 h-3.5 text-amber-400" /> Confidence</p>
                <h3 className="text-3xl font-bold mt-1 text-amber-400">{stats.confidence}</h3>
                <div className="w-full bg-slate-800/70 rounded-full h-1.5 mt-2"><div className="h-full bg-amber-500 rounded-full" style={{ width: `${stats.confidence}%` }} /></div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Score over time line chart */}
              <div className="lg:col-span-2 glass rounded-2xl p-6 animate-fade-up" style={{ animationDelay: '0.2s' }}>
                <h2 className="text-sm font-semibold flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-orange-400" /> Score Over Time</h2>
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
                  {[0, 25, 50, 75, 100].map((v) => {
                    const y = H - PAD - (v / 100) * (H - PAD * 2);
                    return (
                      <g key={v}>
                        <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#33415580" strokeDasharray="3 4" strokeWidth="1" />
                        <text x={PAD - 8} y={y + 4} fill="#64748b" fontSize="10" textAnchor="end">{v}</text>
                      </g>
                    );
                  })}
                  <path d={linePath} fill="none" stroke="#fb923c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  {sessions.map((s, i) => {
                    const x = PAD + (i * (W - PAD * 2)) / Math.max(1, sessions.length - 1);
                    const y = H - PAD - (overall(s) / 100) * (H - PAD * 2);
                    return <circle key={s._id} cx={x} cy={y} r="4" fill="#fb923c" stroke="#0c0a14" strokeWidth="2"><title>{`${TYPE_LABELS[s.sessionType] || s.sessionType}: ${overall(s)}`}</title></circle>;
                  })}
                </svg>
                <p className="text-[10px] text-slate-500 mt-1">Each point is one practice session. {stats.growth !== 0 && <span className={stats.growth > 0 ? 'text-emerald-400' : 'text-rose-400'}>{stats.growth > 0 ? 'Improving' : 'Dipping'} {Math.abs(stats.growth)} pts since your first {Math.min(5, stats.n)} sessions.</span>}</p>
              </div>

              {/* Radar */}
              <div className="glass rounded-2xl p-6 animate-fade-up" style={{ animationDelay: '0.25s' }}>
                <h2 className="text-sm font-semibold flex items-center gap-2 mb-2"><Gauge className="w-4 h-4 text-cyan-400" /> Skill Balance</h2>
                <svg viewBox="0 0 220 220" className="w-full">
                  {[0.25, 0.5, 0.75, 1].map((s) => (
                    <polygon key={s} points={radar.skills.map((_, i) => radar.pt(i, s).join(',')).join(' ')} fill="none" stroke="#33415560" strokeWidth="1" />
                  ))}
                  {radar.skills.map((sk, i) => (
                    <text key={sk.label} x={110 + Math.cos(radar.angle(i)) * 96} y={110 + Math.sin(radar.angle(i)) * 96 + 4} fill="#94a3b8" fontSize="11" textAnchor="middle">{sk.label}</text>
                  ))}
                  <polygon points={radar.poly} fill="rgba(34,211,238,0.18)" stroke="#22d3ee" strokeWidth="2" />
                  {radar.skills.map((sk, i) => {
                    const [x, y] = radar.pt(i, sk.v / 100);
                    return <circle key={sk.label} cx={x} cy={y} r="3.5" fill="#22d3ee" />;
                  })}
                </svg>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sessions per type */}
              <div className="glass rounded-2xl p-6 animate-fade-up" style={{ animationDelay: '0.3s' }}>
                <h2 className="text-sm font-semibold flex items-center gap-2 mb-4"><BarChart2 className="w-4 h-4 text-fuchsia-400" /> Practice Mix</h2>
                <div className="space-y-3">
                  {Object.entries(stats.byType).map(([type, v]) => (
                    <div key={type}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">{TYPE_LABELS[type] || type}</span>
                        <span className="text-slate-500">{v.count} sessions Â· avg {v.avg}</span>
                      </div>
                      <div className="w-full bg-slate-800/70 rounded-full h-2">
                        <div className="h-full bg-gradient-to-r from-orange-500 to-rose-500 rounded-full transition-all duration-700" style={{ width: `${v.avg}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                {stats.topWeaknesses.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-slate-800">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Recurring focus areas from AI reports</p>
                    <div className="flex flex-wrap gap-1.5">
                      {stats.topWeaknesses.map((w) => (
                        <span key={w.word} className="text-[11px] bg-orange-500/10 text-orange-300 border border-orange-500/25 rounded-full px-2.5 py-1">{w.word}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Recent reports */}
              <div className="glass rounded-2xl p-6 animate-fade-up" style={{ animationDelay: '0.35s' }}>
                <h2 className="text-sm font-semibold flex items-center gap-2 mb-4"><Activity className="w-4 h-4 text-emerald-400" /> Latest AI Feedback</h2>
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {sessions.slice(-4).reverse().map((s) => (
                    <div key={s._id} className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-orange-400 font-semibold">{TYPE_LABELS[s.sessionType] || s.sessionType} Â· {overall(s)}/100</span>
                        <span className="text-slate-500">{new Date(s.createdAt).toLocaleDateString()}</span>
                      </div>
                      {s.report?.summary ? <p className="text-slate-400 leading-relaxed">{s.report.summary}</p> : <p className="text-slate-500 italic">No AI report recorded for this session.</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

