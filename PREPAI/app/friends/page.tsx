'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Users, UserPlus, Loader2, Check, X, Trash2, Send, Flame, Trophy, Sparkles } from 'lucide-react';
import FriendCall from '@/components/FriendCall';

interface FriendUser {
  id: string;
  name: string;
  username: string | null;
  email: string;
  avatar: string | null;
  continent: string | null;
  xp: number;
  streak: number;
}

interface RequestItem {
  requestId: string;
  user: FriendUser;
}

export default function FriendsPage() {
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [incoming, setIncoming] = useState<RequestItem[]>([]);
  const [outgoing, setOutgoing] = useState<RequestItem[]>([]);
  const [suggestions, setSuggestions] = useState<FriendUser[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/friends');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load friends');
      setFriends(data.friends ?? []);
      setIncoming(data.incoming ?? []);
      setOutgoing(data.outgoing ?? []);
      setSuggestions(data.suggestions ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (action: string, payload: Record<string, string>) => {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setMessage(data.message || 'Done!');
      setQuery('');
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const avatarOrInitials = (u: FriendUser, size = 'w-11 h-11') =>
    u.avatar ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={u.avatar} alt={u.name} className={`${size} rounded-full object-cover ring-2 ring-emerald-500/30 transition hover:ring-emerald-400/60`} />
    ) : (
      <div className={`${size} rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-sm font-bold text-white`}>
        {u.name.trim()[0]?.toUpperCase() ?? '?'}
      </div>
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
              <span className="text-xs uppercase tracking-widest text-emerald-400 font-semibold bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-700/50 flex items-center gap-1.5 w-fit">
                <Users className="w-3.5 h-3.5" /> Social
              </span>
              <h1 className="text-3xl font-bold tracking-tight text-gradient mt-2">Friends</h1>
              <p className="text-sm text-slate-400 mt-1">Add prep buddies, compare XP, and climb the friend leaderboard together.</p>
            </div>
          </div>
          <Link href="/leaderboard" className="glass hover:bg-slate-800/60 text-slate-300 text-sm rounded-xl px-4 py-2 flex items-center gap-2 transition">
            <Trophy className="w-4 h-4 text-yellow-400" /> Leaderboard
          </Link>
        </div>

        {/* Send request — by @username or email */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const q = query.trim();
            if (!q) return;
            if (q.includes('@') && !q.startsWith('@')) act('send', { email: q });
            else act('send', { username: q });
          }}
          className="glass rounded-2xl p-5 mb-8 animate-fade-up"
        >
          <label className="text-xs font-medium text-slate-300 flex items-center gap-2 mb-2">
            <UserPlus className="w-4 h-4 text-emerald-400" /> Send a friend request
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              required
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="@username  or  friend@college.edu"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 hover:border-slate-700 transition"
            />
            <button
              type="submit"
              disabled={busy}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 hover:scale-[1.02] active:scale-[0.98] text-slate-950 font-semibold px-5 py-3 rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-500/30 disabled:opacity-60 text-sm"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send
            </button>
          </div>
          {message && <p className="text-xs text-emerald-400 mt-2">{message}</p>}
          {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
        </form>

        {/* Random suggestions */}
        {!loading && suggestions.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-fuchsia-400" /> People you may know
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {suggestions.map((s) => (
                <div key={s.id} className="glass rounded-2xl p-4 flex items-center gap-3 animate-fade-up hover:bg-slate-800/40 transition">
                  {avatarOrInitials(s, 'w-10 h-10')}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{s.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{s.username ? `@${s.username}` : s.email}{s.xp ? ` · ${s.xp} XP` : ''}</p>
                  </div>
                  <button
                    onClick={() => act('send', s.username ? { username: s.username } : { email: s.email })}
                    disabled={busy}
                    className="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 hover:scale-105 active:scale-95 p-2 rounded-xl transition disabled:opacity-50"
                    title="Send friend request"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {loading ? (
          <div className="glass rounded-2xl p-16 flex items-center justify-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Incoming requests */}
            {incoming.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-orange-400" /> Friend requests
                  <span className="text-[10px] bg-orange-500/15 text-orange-400 px-1.5 py-0.5 rounded-full">{incoming.length}</span>
                </h2>
                <div className="space-y-2">
                  {incoming.map((r) => (
                    <div key={r.requestId} className="glass rounded-2xl p-4 flex items-center gap-4 animate-fade-up">
                      {avatarOrInitials(r.user)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{r.user.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{r.user.username ? `@${r.user.username}` : r.user.email}</p>
                      </div>
                      <button
                        onClick={() => act('accept', { requestId: r.requestId })}
                        disabled={busy}
                        className="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 p-2 rounded-xl transition disabled:opacity-50"
                        title="Accept"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => act('reject', { requestId: r.requestId })}
                        disabled={busy}
                        className="bg-rose-500/10 text-rose-400 hover:bg-rose-500/25 p-2 rounded-xl transition disabled:opacity-50"
                        title="Reject"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Outgoing requests */}
            {outgoing.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-slate-300 mb-3">Pending invites</h2>
                <div className="space-y-2">
                  {outgoing.map((r) => (
                    <div key={r.requestId} className="glass rounded-2xl p-4 flex items-center gap-4 opacity-80">
                      {avatarOrInitials(r.user)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{r.user.name}</p>
                        <p className="text-[11px] text-slate-500">Waiting for response…</p>
                      </div>
                      <button
                        onClick={() => act('remove', { requestId: r.requestId })}
                        disabled={busy}
                        className="text-slate-500 hover:text-rose-400 p-2 rounded-xl hover:bg-rose-500/10 transition disabled:opacity-50"
                        title="Cancel request"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Friends list */}
            <section>
              <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" /> Your friends ({friends.length})
              </h2>
              {friends.length === 0 ? (
                <div className="glass rounded-2xl p-10 text-center text-slate-400 text-sm">
                  No friends yet — send a request above with their signup email.
                </div>
              ) : (
                <div className="space-y-2">
                  {friends.map((f) => (
                    <div key={f.id} className="glass rounded-2xl p-4 flex items-center gap-4 animate-fade-up hover:bg-slate-800/40 transition">
                      {avatarOrInitials(f)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{f.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{f.username ? `@${f.username}` : f.continent ?? ''}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-400">{f.xp} XP</p>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 justify-end">
                          <Flame className="w-3 h-3 text-orange-500" /> {f.streak}d
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Direct friend voice calls (WebRTC P2P) */}
            <FriendCall friends={friends.map((f) => ({ id: f.id, name: f.name, avatar: f.avatar }))} />
          </div>
        )}
      </div>
    </div>
  );
}
