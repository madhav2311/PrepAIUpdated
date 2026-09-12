'use client';

import React, { useState } from 'react';
import { puter } from '@heyputer/puter.js';
import { Sparkles, Code } from 'lucide-react';

export default function CodexTestPage() {
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);

  const runCodexTest = async () => {
    setLoading(true);
    setOutput('');
    try {
      // Calls OpenAI Codex via Puter.js keylessly
      const response = await puter.ai.chat(
        "Write a JavaScript function that implements binary search on a sorted array",
        { model: "openai/gpt-5.3-codex" }
      );
      setOutput(response?.toString() || 'No response returned.');
    } catch (err: any) {
      setOutput('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <Code className="w-6 h-6 text-emerald-400" />
          <h1 className="text-xl font-bold">Puter.js Codex Integration Test</h1>
        </div>

        <button
          onClick={runCodexTest}
          disabled={loading}
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-5 py-2.5 rounded-xl transition text-sm flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" /> {loading ? 'Running Codex...' : 'Test Codex Generation'}
        </button>

        {output && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase mb-2">Output:</h3>
            <pre className="bg-slate-950 p-4 rounded-lg text-emerald-300 font-mono text-xs overflow-x-auto">
              <code>{output}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}