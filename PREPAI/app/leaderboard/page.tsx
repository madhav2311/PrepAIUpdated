'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trophy, Globe, Users, Flame, Loader2, Crown } from 'lucide-react';

interface Entry {
  rank: number;
  id: string;
  name: string;
  email?: string;
  avatar: string | null;
  continent: string | null;
  xp: number;
  streak: number;
  isMe: boolean;
  level: number;
  progress: number;
  badges: string[];
}

type Scope = 'world' | 'continent' | 'friends';

const TABS: { id: Scope; label: string; icon: React.ReactNode }[] = [
  { id: 'world', label: 'World', icon: <Globe className="w-4 h-4" /> },
  { id: 'continent', label: 'My Continent', icon: <Trophy className="w-4 h-4" /> },
  { id: 'friends', label: 'Friends', icon: <Users className="w-4 h-4" /> },
];

const RANK_STYLE: Record<number, string> = {
  1: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10',
  2: 'text-slate-300 border-slate-400/40 bg-slate-400/10',
  3: 'text-orange-400 border-orange-500/40 bg-orange-500/10',
};

export default function LeaderboardPage() {
  const [scope, setScope] = useState<Scope>('world');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [myContinent, setMyContinent] = useState('');

  const load = useCallback(async (s: Scope) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/leaderboard?scope=${s}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load leaderboard');
      setEntries(data.entries ?? []);
      const me = (data.entries ?? []).find((e: Entry) => e.isMe);
      if (me?.continent) setMyContinent(me.continent);
    } catch (err: any) {
      setError(err.message);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(scope);
  }, [scope, load]);

  const rankBadge = (rank: number) =>
    rank <= 3 ? (
      <span className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-sm ${RANK_STYLE[rank]}`}>
        {rank === 1 ? <Crown className="w-4 h-4" /> : rank}
      </span>
    ) : (
      <span className="w-8 h-8 rounded-full border border-slate-800 bg-slate-900/60 flex items-center justify-center text-slate-400 text-xs font-semibold">
        #{rank}
      </span>
    );

  return (
    <div className="min-h-screen aurora text-slate-100 p-6 md:p-10 font-sans relative">
      <div className="relative z-10 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-800/80 pb-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="p-2 rounded-lg glass hover:bg-slate-800/60 text-slate-400 hover:text-white transition">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <span className="text-xs uppercase tracking-widest text-yellow-400 font-semibold bg-yellow-950/40 px-2.5 py-1 rounded-full border border-yellow-700/50 flex items-center gap-1.5 w-fit">
                <Trophy className="w-3.5 h-3.5" /> Rankings
              </span>
              <h1 className="text-3xl font-bold tracking-tight text-gradient mt-2">Leaderboard</h1>
              <p className="text-sm text-slate-400 mt-1">Climb by completing sessions — every session earns XP.</p>
            </div>
          </div>
          <Link
            href="/friends"
            className="glass hover:bg-slate-800/60 text-slate-300 text-sm rounded-xl px-4 py-2 flex items-center gap-2 transition"
          >
            <Users className="w-4 h-4 text-emerald-400" /> Friends
          </Link>
        </div>

        {/* Scope tabs */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setScope(t.id)}
              className={`flex items-center justify-center gap-2 text-sm font-medium py-3 rounded-xl border transition ${scope === t.id
                ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-300 shadow-lg shadow-yellow-500/5'
                : 'glass border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {scope === 'continent' && myContinent && (
          <p className="text-xs text-slate-500 mb-4">Region: <span className="text-orange-400 font-semibold">{myContinent}</span></p>
        )}

        {loading ? (
          <div className="glass rounded-2xl p-16 flex items-center justify-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : error ? (
          <div className="glass rounded-2xl p-10 text-center">
            <p className="text-rose-400 text-sm">{error}</p>
            <Link href="/profile" className="text-orange-400 text-xs hover:underline mt-2 inline-block">
              Set your continent in your profile →
            </Link>
          </div>
        ) : entries.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center text-slate-400 text-sm">
            No ranked users yet in this view. Complete sessions to earn XP and appear here.
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((e, i) => (
              <div
                key={e.id}
                className={`glass rounded-2xl p-4 flex items-center gap-4 animate-fade-up transition hover:bg-slate-800/40 ${e.isMe ? 'ring-1 ring-orange-500/50 bg-orange-500/5' : ''
                  }`}
                style={{ animationDelay: `${Math.min(i * 0.04, 0.4)}s` }}
              >
                {rankBadge(e.rank)}
                {e.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.avatar} alt={e.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-700" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-sm font-bold text-slate-300">
                    {e.name.trim()[0]?.toUpperCase() ?? '?'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate flex items-center gap-2">
                    {e.name}
                    {e.isMe && <span className="text-[10px] bg-orange-500/15 text-orange-400 px-1.5 py-0.5 rounded-full">YOU</span>}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    Level {e.level} {e.continent ? `· ${e.continent}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-orange-400">{e.xp} XP</p>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1 justify-end">
                    <Flame className="w-3 h-3 text-orange-500" /> {e.streak}d streak
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
