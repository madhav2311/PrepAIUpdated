'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, Video, Users, BarChart2, Mic, ArrowRight, BrainCircuit, Zap, ShieldCheck } from 'lucide-react';

const FEATURES = [
  {
    icon: Video,
    title: '1-on-1 Voice Interview',
    desc: 'Adaptive AI interviewer grounded in your resume and target JD. Real-time speech synthesis & recognition — practice exactly like the real room.',
    color: 'text-violet-400 ring-violet-500/30 bg-violet-500/10',
  },
  {
    icon: Users,
    title: 'Multi-Agent GD Arena',
    desc: 'Round-robin panel with Sara (Devil\u2019s Advocate), Nikhil (Data Analyst) & Ananya (Consensus Builder). Raise your hand to seize the floor.',
    color: 'text-fuchsia-400 ring-fuchsia-500/30 bg-fuchsia-500/10',
  },
  {
    icon: BarChart2,
    title: 'Diagnostic Analytics',
    desc: 'Post-session scorecards breaking down technical accuracy, communication clarity, and confidence — with live coaching tips as you speak.',
    color: 'text-orange-400 ring-orange-500/30 bg-orange-500/10',
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen aurora text-slate-100 relative overflow-hidden">
      {/* Nav */}
      <nav className="relative z-10 max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-bold text-lg">
          <div className="p-2 bg-orange-500/10 text-orange-400 rounded-lg ring-1 ring-orange-500/30">
            <Sparkles className="w-5 h-5" />
          </div>
          Prep<span className="text-gradient">AI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-slate-300 hover:text-white transition px-4 py-2">
            Sign In
          </Link>
          <Link
            href="/signup"
            className="text-sm font-semibold bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 text-slate-950 px-5 py-2 rounded-xl shadow-lg shadow-orange-500/30 transition"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-16 pb-24 text-center">
        <div className="inline-flex items-center gap-2 text-xs text-orange-400 bg-orange-500/10 border border-orange-500/30 px-4 py-1.5 rounded-full mb-8 animate-fade-up">
          <Zap className="w-3.5 h-3.5" /> AI-powered placement simulation for campus & beyond
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.05] animate-fade-up">
          Crack the interview
          <br />
          <span className="text-gradient">before it counts.</span>
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto mt-6 text-lg animate-fade-up" style={{ animationDelay: '0.1s' }}>
          Practice high-stakes technical interviews and multi-agent group discussions with AI panelists
          grounded in <span className="text-slate-200 font-medium">your resume</span> and{' '}
          <span className="text-slate-200 font-medium">target job description</span>.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10 animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <Link
            href="/signup"
            className="bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 text-slate-950 font-semibold px-8 py-3.5 rounded-xl shadow-xl shadow-orange-500/30 transition flex items-center gap-2"
          >
            Start Free Practice <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="glass card-glow font-medium px-8 py-3.5 rounded-xl text-slate-200 transition flex items-center gap-2"
          >
            I already have an account
          </Link>
        </div>

        {/* Voice visual */}
        <div className="mt-16 glass rounded-2xl max-w-3xl mx-auto p-8 animate-fade-up" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center justify-center gap-2 mb-4">
            <Mic className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-slate-400 uppercase tracking-widest">Voice-to-voice engine</span>
          </div>
          <div className="flex items-end justify-center gap-1.5 h-12">
            {[0.4, 0.7, 1, 0.6, 0.85, 0.5, 0.95, 0.65, 0.8, 0.45, 0.75, 0.55].map((h, i) => (
              <span
                key={i}
                className="eq-bar w-1.5 rounded-full bg-gradient-to-t from-emerald-600 to-emerald-400"
                style={{ height: `${h * 100}%`, animationDelay: `${i * 0.09}s` }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="glass card-glow rounded-2xl p-7 animate-fade-up" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-5 ring-1 ${f.color}`}>
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Trust strip */}
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 mt-14 text-sm text-slate-500">
          <span className="flex items-center gap-2"><BrainCircuit className="w-4 h-4 text-fuchsia-400" /> Gemini-powered adaptive questions</span>
          <span className="flex items-center gap-2"><Mic className="w-4 h-4 text-orange-400" /> Web Speech API voice rooms</span>
          <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-violet-400" /> Session transcripts persisted to MongoDB</span>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/60 py-8 text-center text-xs text-slate-500">
        PrepAI — Autonomous Career Readiness & Placement Simulation Platform
      </footer>
    </main>
  );
}
