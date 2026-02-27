'use client';
import { useState } from 'react';
import { XtreamCredentials, XtreamStream } from '@/lib/xtream';

type Step = 'login' | 'browse' | 'done';
type ContentType = 'live' | 'vod' | 'series';

function StepIndicator({ step }: { step: Step }) {
  const steps = [{ key: 'login', label: 'Connect' }, { key: 'browse', label: 'Filter' }, { key: 'done', label: 'Done' }];
  const idx = steps.findIndex(s => s.key === step);
  return (
    <div className="flex items-center justify-center gap-3 mb-10">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i < idx ? 'bg-green-600 text-white' : i === idx ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}>{i + 1}</div>
          <span className={`text-sm ${i === idx ? 'text-white font-semibold' : 'text-gray-500'}`}>{s.label}</span>
          {i < 2 && <div className="w-8 h-px bg-gray-700" />}
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [step, setStep] = useState<Step>('login');
  const [creds, setCreds] = useState<XtreamCredentials | null>(null);
  const [streams, setStreams] = useState<XtreamStream[]>([]);
  const [playlistId, setPlaylistId] = useState('');
  const [server, setServer] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ContentType>('live');
  const [copied, setCopied] = useState(false);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/fetch-xtream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server, username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to connect');
      setCreds({ server, username, password });
      setStreams(data.streams);
      setSelected(new Set(data.streams.map((s: XtreamStream) => s.stream_id)));
      setStep('browse');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!creds) return;
    setSaving(true);
    try {
      const kept = streams.filter(s => selected.has(s.stream_id));
      const res = await fetch('/api/save-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creds, streams: kept })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setPlaylistId(data.id);
      setStep('done');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Get categories for active tab type
  const currentTypeStreams = streams.filter(s => s.type === activeTab);
  const categories = Array.from(new Set(currentTypeStreams.map(s => s.category_name).filter(Boolean))) as string[];

  // Check if a category is fully selected
  function isCategorySelected(category: string): boolean {
    const categoryStreams = currentTypeStreams.filter(s => s.category_name === category);
    return categoryStreams.length > 0 && categoryStreams.every(s => selected.has(s.stream_id));
  }

  // Toggle entire category
  function toggleCategory(category: string) {
    const categoryStreams = currentTypeStreams.filter(s => s.category_name === category);
    const allSelected = isCategorySelected(category);
    const ns = new Set(selected);
    categoryStreams.forEach(s => {
      if (allSelected) ns.delete(s.stream_id);
      else ns.add(s.stream_id);
    });
    setSelected(ns);
  }

  // Count how many items in a category
  function getCategoryCount(category: string): number {
    return currentTypeStreams.filter(s => s.category_name === category).length;
  }

  const playlistUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/playlist/${playlistId}` : '';

  function copyUrl() {
    navigator.clipboard.writeText(playlistUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold text-white mb-2">IPTV Optimizer</h1>
        <p className="text-gray-400 text-lg">Connect your Xtream server, pick channels to keep, get a clean M3U URL.</p>
      </div>

      <StepIndicator step={step} />

      {step === 'login' && (
        <div className="max-w-md mx-auto">
          <form onSubmit={handleConnect} className="bg-gray-900 rounded-xl p-8 space-y-5 border border-gray-800">
            <h2 className="text-xl font-semibold text-white">Xtream Codes Login</h2>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Server URL</label>
              <input
                value={server}
                onChange={e => setServer(e.target.value)}
                placeholder="http://myserver.com:8080"
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Username</label>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="username"
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Password</label>
              <input
                value={password}
                onChange={e => setPassword(e.target.value)}
                type="password"
                placeholder="password"
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition"
            >
              {loading ? 'Connecting...' : 'Connect & Load Channels'}
            </button>
          </form>
        </div>
      )}

      {step === 'browse' && (
        <div>
          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-gray-800">
            <button
              onClick={() => setActiveTab('live')}
              className={`px-5 py-2.5 font-medium transition border-b-2 ${
                activeTab === 'live'
                  ? 'border-blue-500 text-blue-500'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Live TV
            </button>
            <button
              onClick={() => setActiveTab('vod')}
              className={`px-5 py-2.5 font-medium transition border-b-2 ${
                activeTab === 'vod'
                  ? 'border-blue-500 text-blue-500'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Movies
            </button>
            <button
              onClick={() => setActiveTab('series')}
              className={`px-5 py-2.5 font-medium transition border-b-2 ${
                activeTab === 'series'
                  ? 'border-blue-500 text-blue-500'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Series
            </button>
          </div>

          <div className="mb-4 text-gray-400 text-sm">
            {selected.size} / {streams.length} items selected • {categories.length} categories in {activeTab === 'live' ? 'Live TV' : activeTab === 'vod' ? 'Movies' : 'Series'}
          </div>

          {/* Category Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[520px] overflow-y-auto pr-1">
            {categories.map(cat => {
              const isSelected = isCategorySelected(cat);
              const count = getCategoryCount(cat);
              return (
                <div
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`p-4 rounded-lg cursor-pointer border transition ${
                    isSelected
                      ? 'bg-blue-900/30 border-blue-700'
                      : 'bg-gray-900 border-gray-800 opacity-60 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-medium truncate">{cat}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{count} {count === 1 ? 'item' : 'items'}</p>
                    </div>
                    <div
                      className={`ml-3 w-5 h-5 rounded flex-shrink-0 border-2 ${
                        isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-600'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving || selected.size === 0}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold px-8 py-3 rounded-lg transition"
            >
              {saving ? 'Saving...' : `Save ${selected.size} Items & Get URL`}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="max-w-xl mx-auto text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-white mb-2">Your playlist is ready!</h2>
          <p className="text-gray-400 mb-6">Paste this URL into your IPTV app (TiviMate, IPTV Smarters, etc.)</p>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4">
            <p className="text-blue-400 text-sm break-all font-mono">{playlistUrl}</p>
          </div>
          <button
            onClick={copyUrl}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg transition mb-4"
          >
            {copied ? 'Copied!' : 'Copy URL'}
          </button>
          <div>
            <button
              onClick={() => {
                setStep('login');
                setServer('');
                setUsername('');
                setPassword('');
                setStreams([]);
                setPlaylistId('');
              }}
              className="text-gray-400 hover:text-white text-sm underline"
            >
              Start over
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
