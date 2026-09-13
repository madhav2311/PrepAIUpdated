'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

const THEMES = ['aurora', 'ocean', 'grape'] as const;
type Theme = (typeof THEMES)[number];

const LABEL: Record<Theme, string> = { aurora: 'Aurora', ocean: 'Ocean', grape: 'Grape' };

export function ThemePaletteMenu() {
  const [theme, setTheme] = useState<Theme>('aurora');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem('palette') as Theme) || 'aurora';
    if (THEMES.includes(saved)) setTheme(saved);
    document.documentElement.dataset.palette = saved;
  }, []);

  const pick = (t: Theme) => {
    setTheme(t);
    localStorage.setItem('palette', t);
    document.documentElement.dataset.palette = t;
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="glass hover:bg-slate-800/60 text-slate-300 p-2 rounded-xl transition"
        title="Change color palette"
      >
        <Sun className="w-4 h-4 text-orange-400" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-40 glass rounded-xl p-2 shadow-2xl z-50 animate-fade-up">
          {THEMES.map((t) => (
            <button
              key={t}
              onClick={() => pick(t)}
              className={`w-full text-left text-sm px-3 py-2 rounded-lg transition flex items-center gap-2 ${theme === t ? 'text-orange-400 bg-orange-500/10' : 'text-slate-200 hover:bg-slate-800/70'
                }`}
            >
              <span
                className={`w-3.5 h-3.5 rounded-full ${t === 'aurora' ? 'bg-gradient-to-br from-orange-400 to-fuchsia-500'
                    : t === 'ocean' ? 'bg-gradient-to-br from-cyan-400 to-blue-600'
                      : 'bg-gradient-to-br from-violet-500 to-indigo-600'
                  }`}
              />
              {LABEL[t]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('mode');
    const d = saved !== 'light';
    setDark(d);
    document.documentElement.dataset.mode = d ? 'dark' : 'light';
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem('mode', next ? 'dark' : 'light');
    document.documentElement.dataset.mode = next ? 'dark' : 'light';
  };

  return (
    <button
      onClick={toggle}
      className="glass hover:bg-slate-800/60 text-slate-300 p-2 rounded-xl transition"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-indigo-300" />}
    </button>
  );
}
