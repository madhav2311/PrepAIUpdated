'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, Briefcase, Save, CheckCircle2, UserRound, Loader2, ImagePlus, Link2, Code, Globe, Trophy, Flame } from 'lucide-react';

export default function ProfilePage() {
  const [targetRole, setTargetRole] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [jdText, setJdText] = useState('');
  const [userName, setUserName] = useState('');
  const [myUsername, setMyUsername] = useState('');
  const [avatar, setAvatar] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [github, setGithub] = useState('');
  const [continent, setContinent] = useState('');
  const [continents, setContinents] = useState<string[]>([]);
  const [stats, setStats] = useState<{ level: number; progress: number; nextLevelXp: number; badges: string[] } | null>(null);
  const [xp, setXp] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/profile', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/auth', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([profileData, authData]) => {
        if (profileData?.profile) {
          setTargetRole(profileData.profile.targetRole ?? '');
          setResumeText(profileData.profile.resumeText ?? '');
          setJdText(profileData.profile.jdText ?? '');
          setAvatar(profileData.profile.avatar ?? '');
          setMyUsername(profileData.profile.username ?? '');
          setLinkedin(profileData.profile.linkedin ?? '');
          setGithub(profileData.profile.github ?? '');
          setContinent(profileData.profile.continent ?? '');
          setXp(profileData.profile.xp ?? 0);
        }
        if (profileData?.stats) setStats(profileData.stats);
        if (profileData?.continents) setContinents(profileData.continents);
        if (authData?.user?.name) setUserName(authData.user.name);
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetRole, resumeText, jdText, avatar, linkedin, github, continent, username: myUsername }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save profile');
      }
      setSaved(true);
      window.dispatchEvent(new Event('profile-updated'));
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatar = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Downscale to 256px square and compress so the data URL stays small
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const min = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
        setAvatar(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const completion =
    [
      targetRole.trim().length > 3,
      resumeText.trim().length > 50,
      jdText.trim().length > 50,
    ].filter(Boolean).length;

  return (
    <div className="min-h-screen aurora text-slate-100 p-6 md:p-10 font-sans relative">
      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-slate-800/80 pb-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="p-2 rounded-lg glass hover:bg-slate-800/60 text-slate-400 hover:text-white transition">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <span className="text-xs uppercase tracking-widest text-orange-400 font-semibold bg-orange-950/40 px-2.5 py-1 rounded-full border border-orange-700/50">
                Context Hub
              </span>
              <h1 className="text-3xl font-bold tracking-tight text-gradient mt-2">Your Profile</h1>
              <p className="text-sm text-slate-400 mt-1">
                {userName ? `Welcome, ${userName.split(' ')[0]}. ` : ''}Ground every AI session in your real resume & target role.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300 glass px-4 py-2 rounded-xl">
            <UserRound className="w-4 h-4 text-orange-400" />
            Profile strength: {completion}/3
          </div>
        </div>

        {loading ? (
          <div className="glass rounded-2xl p-16 flex items-center justify-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Identity: avatar + links + continent + gamification */}
            <div className="glass rounded-2xl p-6 animate-fade-up">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-xl ring-1 ring-cyan-500/30">
                  <UserRound className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-white">Your Identity</h2>
                  <p className="text-xs text-slate-400">Picture, social links & region (used for leaderboards)</p>
                </div>
                {stats && (
                  <div className="ml-auto text-right">
                    <p className="text-xs text-slate-400 flex items-center gap-1 justify-end">
                      <Trophy className="w-3.5 h-3.5 text-yellow-400" /> Level {stats.level} · {xp} XP
                      <Flame className="w-3.5 h-3.5 text-orange-500 ml-2" /> Streak
                    </p>
                    <div className="w-40 h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-orange-500 to-yellow-400 rounded-full transition-all duration-700" style={{ width: `${stats.progress}%` }} />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-6">
                {/* Avatar picker */}
                <div className="flex flex-col items-center gap-2">
                  <div className="relative group">
                    {avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatar} alt="Profile picture" className="w-24 h-24 rounded-full object-cover ring-2 ring-cyan-500/40 shadow-lg" />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-slate-950 border-2 border-dashed border-slate-700 flex items-center justify-center text-slate-500">
                        <UserRound className="w-8 h-8" />
                      </div>
                    )}
                    <label
                      htmlFor="avatar-upload"
                      className="absolute inset-0 rounded-full bg-slate-950/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer"
                      title="Upload profile picture"
                    >
                      <ImagePlus className="w-6 h-6 text-cyan-300" />
                    </label>
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatar(f); }}
                    />
                  </div>
                  {avatar && (
                    <button type="button" onClick={() => setAvatar('')} className="text-[11px] text-slate-500 hover:text-rose-400 transition">
                      Remove picture
                    </button>
                  )}
                </div>

                {/* Links + continent */}
                <div className="flex-1 space-y-3">
                  <div className="relative">
                    <UserRound className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={myUsername}
                      onChange={(e) => setMyUsername(e.target.value.replace(/[^a-zA-Z0-9_@]/g, ''))}
                      placeholder="@username (used to find & add you)"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 hover:border-slate-700 transition"
                    />
                  </div>
                  <div className="relative">
                    <Link2 className="w-4 h-4 text-cyan-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="url"
                      value={linkedin}
                      onChange={(e) => setLinkedin(e.target.value)}
                      placeholder="https://linkedin.com/in/your-handle"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 hover:border-slate-700 transition"
                    />
                  </div>
                  <div className="relative">
                    <Code className="w-4 h-4 text-cyan-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="url"
                      value={github}
                      onChange={(e) => setGithub(e.target.value)}
                      placeholder="https://github.com/your-handle"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 hover:border-slate-700 transition"
                    />
                  </div>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-cyan-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={continent}
                      onChange={(e) => setContinent(e.target.value)}
                      className="w-full appearance-none bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 hover:border-slate-700 transition"
                    >
                      <option value="">Select your continent (for leaderboards)</option>
                      {continents.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Target Role */}
            <div className="glass rounded-2xl p-6 animate-fade-up">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-violet-500/10 text-violet-400 rounded-xl ring-1 ring-violet-500/30">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-white">Target Role</h2>
                  <p className="text-xs text-slate-400">The role you're preparing for</p>
                </div>
              </div>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="e.g. Backend Engineer - SDE II at a fintech startup"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-orange-500"
              />
            </div>

            {/* Resume */}
            <div className="glass rounded-2xl p-6 animate-fade-up" style={{ animationDelay: '0.08s' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-orange-500/10 text-orange-400 rounded-xl ring-1 ring-orange-500/30">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-white">Resume / Key Experience</h2>
                  <p className="text-xs text-slate-400">Paste highlights — projects, tech stack, achievements</p>
                </div>
              </div>
              <textarea
                rows={8}
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder={'e.g.\n- Built a real-time chat service with Node.js, Redis pub/sub serving 50k concurrent users\n- Final year project: ML-based resume screener (Python, FastAPI)\n- Tech stack: TypeScript, Next.js, MongoDB, Docker'}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 focus:outline-none focus:border-orange-500 leading-relaxed"
              />
            </div>

            {/* Job Description */}
            <div className="glass rounded-2xl p-6 animate-fade-up" style={{ animationDelay: '0.16s' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-fuchsia-500/10 text-fuchsia-400 rounded-xl ring-1 ring-fuchsia-500/30">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-white">Target Job Description</h2>
                  <p className="text-xs text-slate-400">Paste the JD — AI questions will map to these requirements</p>
                </div>
              </div>
              <textarea
                rows={8}
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                placeholder={'e.g.\nRequirements: 2+ years of backend experience, strong grasp of system design, REST APIs, databases, CI/CD...'}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 focus:outline-none focus:border-orange-500 leading-relaxed"
              />
            </div>

            {/* Save */}
            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={saving}
                className="bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 text-slate-950 font-semibold px-6 py-3 rounded-xl transition flex items-center gap-2 shadow-lg shadow-orange-500/30 disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Profile Context'}
              </button>
              {saved && <span className="text-sm text-orange-400">Your AI sessions will now use this context.</span>}
              {error && <span className="text-sm text-rose-400">{error}</span>}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
