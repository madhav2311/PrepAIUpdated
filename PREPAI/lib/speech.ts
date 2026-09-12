"use client";

// Pick a gender-appropriate voice from the browser's installed voices.
// Heuristic: some voice names include "Female"/"Male"; otherwise fall back to
// a curated list of common female/male voice names, then pitch/rate shaping.
const FEMALE_HINTS = [
  "female",
  "samantha",
  "victoria",
  "zira",
  "hazel",
  "karen",
  "moira",
  "tessa",
  "fiona",
  "susan",
  "aria",
  "jenny",
  "sonia",
  "libby",
  "michelle",
  "eva",
  "google uk english female",
];
const MALE_HINTS = [
  "male",
  "david",
  "mark",
  "alex",
  "daniel",
  "george",
  "rishi",
  "guy",
  "ryan",
  "eric",
  "brian",
  "james",
  "tom",
  "fred",
  "google uk english male",
];

let cachedVoices: SpeechSynthesisVoice[] = [];

export function loadVoices(cb?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  cachedVoices = window.speechSynthesis.getVoices();
  if (cb) cb();
  // Voices load async in Chrome — listen for them
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
    if (cb) cb();
  };
}

function pickVoice(gender?: string): SpeechSynthesisVoice | null {
  if (!cachedVoices.length) cachedVoices = window.speechSynthesis.getVoices();
  if (!cachedVoices.length) return null;

  // Prefer English voices
  const english = cachedVoices.filter((v) =>
    v.lang.toLowerCase().startsWith("en"),
  );
  const pool = english.length ? english : cachedVoices;

  const hints =
    gender === "female" ? FEMALE_HINTS : gender === "male" ? MALE_HINTS : [];
  if (hints.length) {
    const match = pool.find((v) =>
      hints.some((h) => v.name.toLowerCase().includes(h)),
    );
    if (match) return match;
  }
  return null;
}

export function speak(
  text: string,
  opts: {
    gender?: string;
    rate?: number;
    onStart?: () => void;
    onEnd?: () => void;
  } = {},
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(opts.gender);
  if (voice) u.voice = voice;
  // Pace: faster than default (1.0), extra pitch shaping when no gendered voice found
  u.rate = opts.rate ?? 1.18;
  u.pitch = voice
    ? 1.0
    : opts.gender === "male"
      ? 0.8
      : opts.gender === "female"
        ? 1.15
        : 1.0;
  if (opts.onStart) u.onstart = opts.onStart;
  if (opts.onEnd) u.onend = opts.onEnd;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
