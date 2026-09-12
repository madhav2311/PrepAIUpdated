'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles, Mail, Lock, User as UserIcon, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';

export default function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(searchParams.get('error') ? 'Social sign-in failed — please try again.' : '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: mode, name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      router.push(searchParams.get('next') || '/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen aurora text-slate-100 flex items-center justify-center p-6 relative">
      <div className="max-w-md w-full glass rounded-2xl p-8 shadow-2xl relative z-10 animate-fade-up hover:shadow-emerald-500/10 transition-shadow duration-500">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl"></div>

        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl ring-1 ring-emerald-500/30">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gradient">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="text-xs text-slate-400">
              {mode === 'login' ? 'Continue your placement preparation.' : 'Start your placement preparation journey.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="text-xs font-medium text-slate-300 flex items-center gap-2 mb-1.5">
                <UserIcon className="w-4 h-4 text-emerald-400" /> Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 hover:border-slate-700 transition"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-300 flex items-center gap-2 mb-1.5">
              <Mail className="w-4 h-4 text-emerald-400" /> Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@college.edu"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 hover:border-slate-700 transition"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 flex items-center gap-2 mb-1.5">
              <Lock className="w-4 h-4 text-emerald-400" /> Password
            </label>
            <div className="relative group">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 hover:border-slate-700 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-emerald-400 transition p-1 rounded-lg hover:bg-emerald-500/10"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 hover:scale-[1.02] active:scale-[0.98] text-slate-950 font-semibold py-3 rounded-xl transition shadow-lg shadow-emerald-500/30 text-sm flex items-center justify-center gap-2 disabled:opacity-60 btn-hot"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                {mode === 'login' ? 'Sign In' : 'Create Account'} <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Social sign-in */}
        <div className="mt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px bg-slate-800 flex-1" />
            <span className="text-[11px] text-slate-500 uppercase tracking-wider">or continue with</span>
            <div className="h-px bg-slate-800 flex-1" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <a
              href="/api/auth/oauth/google"
              className="glass rounded-xl py-2.5 flex items-center justify-center gap-2 text-xs font-medium text-slate-200 hover:bg-slate-800/70 hover:scale-[1.03] active:scale-95 transition"
              title="Continue with Google"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" /><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" /></svg>
              Google
            </a>
            <a
              href="/api/auth/oauth/github"
              className="glass rounded-xl py-2.5 flex items-center justify-center gap-2 text-xs font-medium text-slate-200 hover:bg-slate-800/70 hover:scale-[1.03] active:scale-95 transition"
              title="Continue with GitHub"
            >
              <svg className="w-4 h-4 fill-slate-200" viewBox="0 0 24 24"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2 0 1.9 1.2 1.9 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.2-3.1-.1-.4-.5-1.6.2-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0A8.8 8.8 0 0 1 18.5 5c.7 1.6.3 2.8.2 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.9 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3z" /></svg>
              GitHub
            </a>
            <a
              href="/api/auth/oauth/linkedin"
              className="glass rounded-xl py-2.5 flex items-center justify-center gap-2 text-xs font-medium text-slate-200 hover:bg-slate-800/70 hover:scale-[1.03] active:scale-95 transition"
              title="Continue with LinkedIn"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#0A66C2" d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.55V9h3.57v11.45z" /></svg>
              LinkedIn
            </a>
          </div>
        </div>

        <p className="text-xs text-slate-400 text-center mt-6">
          {mode === 'login' ? (
            <>
              New to PrepAI?{' '}
              <Link href="/signup" className="text-emerald-400 font-semibold hover:underline">
                Create an account
              </Link>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <Link href="/login" className="text-emerald-400 font-semibold hover:underline">
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
