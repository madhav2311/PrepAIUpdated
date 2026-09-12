'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import UserBadge from '@/components/UserBadge';
import { BarChart2, Award, Video, FileText, ArrowRight, Users, TrendingUp, Flame, Trophy, Medal } from 'lucide-react';

interface SessionLog {
  _id: string;
  sessionType: string;
  createdAt: string;
  metrics?: { technicalScore?: number; communicationScore?: number; confidenceScore?: number };
}

interface GamifyStats {
  level: number;
  progress: number;
  nextLevelXp: number;
  badges: string[];
}

export default function DashboardPage() {
  const [user, setUser] = useState<{ name?: string } | null>(null);
  const [profile, setProfile] = useState<{ targetRole?: string; xp?: number; streak?: number; avatar?: string } | null>(null);
  const [stats, setStats] = useState<GamifyStats | null>(null);
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/auth').then((r) => (r.ok ? r.json() : null)).then((d) => setUser(d?.user ?? null)).catch(() => {});
    fetch('/api/profile').then((r) => (r.ok ? r.json() : null)).then((d) => {
      setProfile(d?.profile ?? null);
      setStats(d?.stats ?? null);
    }).catch(() => {});
    fetch('/api/sessions').then((r) => (r.ok ? r.json() : null)).then((d) => setSessions(d?.sessions ?? [])).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  const firstName = user?.name?.split(' ')[0] || 'there';
  const roleLabel = profile?.targetRole?.trim() || 'No target role set — add it in your Profile Hub';
  const total = sessions.length;
  const scored = sessions.filter((s) => typeof s.metrics?.technicalScore === 'number');
  const avg = (pick: (s: SessionLog) => number | undefined) => {
    const withVal = scored.filter((s) => typeof pick(s) === 'number');
    return withVal.length ? Math.round(withVal.reduce((a, s) => a + (pick(s) as number), 0) / withVal.length) : null;
  };
  const avgTech = avg((s) => s.metrics?.technicalScore);
  const avgComm = avg((s) => s.metrics?.communicationScore);
  const avgConf = avg((s) => s.metrics?.confidenceScore);
  const thisWeek = sessions.filter((s) => Date.now() - new Date(s.createdAt).getTime() < 7 * 864e5).length;
  const readiness = scored.length ? Math.min(100, Math.round((avgTech ?? 60) * 0.5 + (avgComm ?? 60) * 0.3 + Math.min(total, 20) * 1)) : null;

  // Derive a real weekly trend from session scores (last 7 buckets)
  const weekly = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const start = Date.now() - (7 - i) * 7 * 864e5;
    const end = start + 7 * 864e5;
    const inRange = scored.filter((s) => { const t = new Date(s.createdAt).getTime(); return t >= start && t < end; });
    return inRange.length ? Math.round(inRange.reduce((a, s) => a + (s.metrics?.technicalScore ?? 0), 0) / inRange.length) : 0;
  });

  return (
    <div className="min-h-screen aurora text-slate-100 p-6 md:p-10 font-sans relative">
      <div className="relative z-10">
        {/* Top Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <span className="text-xs uppercase tracking-widest text-orange-400 font-semibold bg-orange-950/40 px-2.5 py-1 rounded-full border border-orange-700/50 max-w-xs truncate inline-block">
              {roleLabel}
            </span>
            <h1 className="text-3xl font-bold tracking-tight text-gradient mt-2">Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/friends"
              className="glass text-slate-300 text-sm rounded-xl px-4 py-2 flex items-center gap-2 hover:bg-slate-800/60 transition"
            >
              <Users className="w-4 h-4 text-emerald-400" /> Friends
            </Link>
            <Link
              href="/leaderboard"
              className="glass text-slate-300 text-sm rounded-xl px-4 py-2 flex items-center gap-2 hover:bg-slate-800/60 transition"
            >
              <Trophy className="w-4 h-4 text-yellow-400" /> Leaderboard
            </Link>
            <UserBadge />
          </div>
        </div>

        {/* Hero Welcome Card */}
        <div className="glass rounded-2xl p-8 mb-8 relative overflow-hidden shadow-xl animate-fade-up">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl"></div>
          <div className="absolute top-4 right-6 glass text-slate-300 text-sm px-3 py-1 rounded-lg">
            Readiness <span className="text-orange-400 font-bold">{readiness !== null ? `${readiness}/100` : '—'}</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-2">
            Good to see you, {firstName}.{total > 0 ? ' Your next drill is ready.' : ' Let\u2019s get you interview-ready.'}
          </h2>
          <p className="text-slate-400 text-sm md:text-base max-w-2xl mb-6">
            {total > 0
              ? `You've completed ${total} session${total === 1 ? '' : 's'}${thisWeek ? ` — ${thisWeek} this week` : ''}. ${profile?.targetRole ? `Keep sharpening for ${profile.targetRole}.` : 'Add your resume & JD in the Profile Hub to ground your sessions.'}`
              : 'Set up your resume and target job description, then run your first mock interview or group discussion.'}
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/interview"
              className="bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 text-slate-950 font-semibold px-5 py-2.5 rounded-xl transition flex items-center gap-2 shadow-lg shadow-orange-500/30 hover:shadow-orange-500/40">
              <Video className="w-4 h-4" /> Start mock interview
            </Link>
            <Link
              href="/group-discussion"
              className="glass hover:bg-slate-800/60 text-slate-200 font-medium px-5 py-2.5 rounded-xl transition flex items-center gap-2">
              <Users className="w-4 h-4" /> Join group discussion
            </Link>
            <Link
              href="/debate"
              className="glass hover:bg-slate-800/60 text-slate-200 font-medium px-5 py-2.5 rounded-xl transition flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-400" /> 1-on-1 debate
            </Link>
          </div>
        </div>

        {/* Gamification — XP / Level / Streak / Badges */}
        {stats && (
          <div className="glass rounded-2xl p-6 mb-8 relative overflow-hidden animate-fade-up hover:bg-slate-800/40 transition">
            <div className="absolute -top-16 -left-16 w-48 h-48 bg-yellow-500/10 rounded-full blur-3xl"></div>
            <div className="flex flex-col md:flex-row md:items-center gap-6 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 flex items-center justify-center">
                  <Trophy className="w-7 h-7 text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-white leading-none">Level {stats.level}</p>
                  <p className="text-xs text-slate-400 mt-1">{profile?.xp ?? 0} XP earned</p>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-[11px] text-slate-400 mb-1.5">
                  <span>Level progress</span>
                  <span className="text-orange-400 font-semibold">{stats.progress}%</span>
                </div>
                <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-400 rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(251,146,60,0.4)]" style={{ width: `${stats.progress}%` }} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="glass rounded-xl px-4 py-3 flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <div>
                    <p className="text-lg font-bold text-white leading-none">{profile?.streak ?? 0}</p>
                    <p className="text-[10px] text-slate-400">day streak</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 max-w-xs">
                  {stats.badges.length === 0 ? (
                    <span className="text-[11px] text-slate-500">Complete a session to earn your first badge</span>
                  ) : (
                    stats.badges.map((b) => (
                      <span key={b} className="text-[10px] font-semibold bg-gradient-to-r from-violet-500/15 to-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30 px-2 py-1 rounded-full flex items-center gap-1">
                        <Medal className="w-3 h-3" /> {b}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="glass card-glow rounded-2xl p-5 animate-fade-up">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-1 flex justify-between items-center">
              Avg. Technical <BarChart2 className="w-4 h-4 text-orange-400" />
            </div>
            <div className="text-3xl font-bold text-white">{avgTech ?? '—'}</div>
            <div className="text-xs text-slate-400 mt-1">across {scored.length} scored sessions</div>
          </div>

          <div className="glass card-glow rounded-2xl p-5 animate-fade-up" style={{ animationDelay: '0.06s' }}>
            <div className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-1 flex justify-between items-center">
              Sessions <FileText className="w-4 h-4 text-orange-400" />
            </div>
            <div className="text-3xl font-bold text-white">{total}</div>
            <div className="text-xs text-slate-400 mt-1">{thisWeek} this week</div>
          </div>

          <div className="glass card-glow rounded-2xl p-5 animate-fade-up" style={{ animationDelay: '0.12s' }}>
            <div className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-1 flex justify-between items-center">
              Avg. Communication <Award className="w-4 h-4 text-orange-400" />
            </div>
            <div className="text-3xl font-bold text-white">{avgComm ?? '—'}</div>
            <div className="text-xs text-slate-400 mt-1">clarity & structure signal</div>
          </div>

          <div className="glass card-glow rounded-2xl p-5 animate-fade-up" style={{ animationDelay: '0.18s' }}>
            <div className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-1 flex justify-between items-center">
              Confidence <TrendingUp className="w-4 h-4 text-orange-400" />
            </div>
            <div className="text-3xl font-bold text-white">{avgConf !== null ? `${avgConf}%` : '—'}</div>
            <div className="text-xs text-slate-400 mt-1">from scored sessions</div>
          </div>
        </div>

        {/* Analytics & Skill Breakdown Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 glass rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-white">Score trend</h3>
              <span className="text-xs text-orange-400 cursor-pointer hover:underline">Full report →</span>
            </div>
            <div className="h-48 flex items-end justify-between gap-2 border-b border-slate-800 pb-2 px-2">
              {weekly.map((val, idx) => (
                <div key={idx} className="w-full bg-slate-800/40 rounded-t-lg relative flex flex-col justify-end h-full group">
                  <div
                    className="bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-lg transition-all group-hover:from-emerald-500 group-hover:to-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.25)]"
                    style={{ height: `${val}%`, transition: 'height 0.6s ease' }}
                  ></div>
                  <span className="text-[10px] text-slate-500 text-center mt-2">W{idx + 1}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-white mb-4">Skill breakdown</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-300">Fluency</span>
                  <span className="text-orange-400 font-semibold">{avgComm !== null ? `${avgComm}%` : '—'}</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${avgComm ?? 0}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-300">Confidence</span>
                  <span className="text-orange-400 font-semibold">{avgConf !== null ? `${avgConf}%` : '—'}</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${avgConf ?? 0}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-300">Technical</span>
                  <span className="text-orange-400 font-semibold">{avgTech !== null ? `${avgTech}%` : '—'}</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${avgTech ?? 0}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-300">Readiness</span>
                  <span className="text-orange-400 font-semibold">{readiness !== null ? `${readiness}%` : '—'}</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${readiness ?? 0}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}