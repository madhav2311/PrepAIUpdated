'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, Settings, ChevronDown, Trophy, Palette } from 'lucide-react';
import ThemeToggle, { ThemePaletteMenu } from '../app/theme-toggle';

interface SessionUser {
  id: string;
  name: string;
  email: string;
}

export default function UserBadge() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [profile, setProfile] = useState<{ avatar?: string; xp?: number; username?: string } | null>(null);
  const [stats, setStats] = useState<{ level?: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const loadProfile = React.useCallback(() => {
    fetch('/api/auth', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data?.user ?? null))
      .catch(() => setUser(null));
    fetch('/api/profile', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setProfile(data?.profile ?? null);
        setStats(data?.stats ?? null);
      })
      .catch(() => { });
  }, []);

  useEffect(() => {
    loadProfile();
    // Re-fetch instantly when the profile is saved anywhere in the app
    window.addEventListener('profile-updated', loadProfile);
    return () => window.removeEventListener('profile-updated', loadProfile);
  }, [loadProfile]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setBusy(true);
    try {
      await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      });
      router.push('/');
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const initials = user?.name
    ? user.name.trim()[0].toUpperCase()
    : '··';

  return (
    <div className="relative" ref={ref}>
      {/* Avatar button — the user icon doubles as the profile entry point */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="group relative flex items-center gap-1.5 rounded-full p-0.5 avatar-glow hover:ring-2 hover:ring-orange-500/50 transition"
        title="Your profile"
      >
        {profile?.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar}
            alt={user?.name ?? 'You'}
            className="w-10 h-10 rounded-full object-cover ring-2 ring-orange-500/40 group-hover:ring-orange-400/70 transition shadow-lg"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center font-bold text-white shadow-lg shadow-orange-500/30 ring-2 ring-orange-500/40 group-hover:ring-orange-400/70 transition text-xs">
            {initials}
          </div>
        )}
        {stats?.level ? (
          <span className="absolute -bottom-1 -right-1 text-[9px] font-bold bg-slate-950 text-orange-400 border border-orange-500/50 rounded-full px-1.5 leading-4">
            {stats.level}
          </span>
        ) : null}
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown menu */}
      {open && (
        <div className="absolute right-0 mt-2 w-56 glass rounded-xl p-2 shadow-2xl z-50 animate-fade-up">
          <div className="px-3 py-2 border-b border-slate-800 mb-1">
            <p className="text-sm font-semibold text-white truncate">{user?.name ?? 'Guest'}</p>
            {profile?.username && (
              <p className="text-[11px] text-emerald-400">@{profile.username}</p>
            )}
            <p className="text-[11px] text-slate-400 truncate">{user?.email ?? ''}</p>
            <p className="text-[11px] text-orange-400 mt-1 flex items-center gap-1">
              <Trophy className="w-3 h-3" /> Level {stats?.level ?? 1} · {profile?.xp ?? 0} XP
            </p>
          </div>
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-800 mb-1">
            <span className="flex items-center gap-2 text-sm text-slate-200"><Palette className="w-4 h-4 text-fuchsia-400" /> Theme</span>
            <div className="flex items-center gap-1">
              <ThemePaletteMenu />
              <ThemeToggle />
            </div>
          </div>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 text-sm text-slate-200 hover:bg-slate-800/70 rounded-lg px-3 py-2 transition"
          >
            <Settings className="w-4 h-4 text-orange-400" /> Profile Hub
          </Link>
          <Link
            href="/leaderboard"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 text-sm text-slate-200 hover:bg-slate-800/70 rounded-lg px-3 py-2 transition"
          >
            <Trophy className="w-4 h-4 text-yellow-400" /> Leaderboard
          </Link>
          <button
            onClick={handleLogout}
            disabled={busy}
            className="w-full flex items-center gap-2 text-sm text-slate-200 hover:bg-rose-500/10 hover:text-rose-400 rounded-lg px-3 py-2 transition disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
