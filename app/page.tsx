'use client';
import { useState } from 'react';
import { XtreamCredentials, XtreamStream } from '@/lib/xtream';
type Step = 'login' | 'browse' | 'done';
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
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all'|'live'|'vod'|'series'>('all');
  const [catFilter, setCatFilter] = useState('');
  const [copied, setCopied] = useState(false);
  async function handleConnect(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const res = await fetch('/api/fetch-xtream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ server, username, password }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to connect');
      setCreds({ server, username, password });
      setStreams(data.streams);
      setSelected(new Set(data.streams.map((s: XtreamStream) => s.stream_id)));
      setStep('browse');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }
  async function handleSave() {
    if (!creds) return;
    setSaving(true);
    try {
      const kept = streams.filter(s => selected.has(s.stream_id));
      const res = await fetch('/api/save-playlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creds, streams: kept }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setPlaylistId(data.id); setStep('done');
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  }
  const categories = Array.from(new Set(streams.map(s => s.category_name).filter(Boolean))) as string[];
  const filtered = streams.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || s.type === typeFilter;
    const matchCat = !catFilter || s.category_name === catFilter;
    return matchSearch && matchType && matchCat;
  });
  const playlistUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/playlist/${playlistId}` : '';
  function copyUrl() { navigator.clipboard.writeText(playlistUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }
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
              <input value={server} onChange={e => setServer(e.target.value)} placeholder="http://myserver.com:8080" required className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Username</label>
              <input value={username} onChange={e => setUsername(e.target.value)} placeholder="username" required className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Password</label>
              <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="password" required className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition">{loading ? 'Connecting...' : 'Connect & Load Channels'}</button>
          </form>
        </div>
      )}
      {step === 'browse' && (
        <div>
          <div className="flex flex-wrap gap-3 mb-4 items-center justify-between">
            <div className="flex gap-3 flex-wrap flex-1">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search channels..." className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 min-w-[200px]" />
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none">
                <option value="all">All Types</option>
                <option value="live">Live TV</option>
                <option value="vod">Movies</option>
                <option value="series">Series</option>
              </select>
              <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none max-w-[220px]">
                <option value="">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex gap-2 text-sm">
              <button onClick={() => setSelected(new Set(streams.map(s => s.stream_id)))} className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-white">Select All</button>
              <button onClick={() => setSelected(new Set())} className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-white">Deselect All</button>
            </div>
          </div>
          <div className="mb-3 text-gray-400 text-sm">{selected.size} / {streams.length} channels selected &bull; Showing {filtered.length}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[520px] overflow-y-auto pr-1">
            {filtered.map(s => {
              const on = selected.has(s.stream_id);
              return (
                <div key={s.stream_id} onClick={() => { const ns = new Set(selected); on ? ns.delete(s.stream_id) : ns.add(s.stream_id); setSelected(ns); }} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition ${on ? 'bg-blue-900/30 border-blue-700' : 'bg-gray-900 border-gray-800 opacity-50'}`}>
                  {s.stream_icon ? <img src={s.stream_icon} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" onError={e => (e.currentTarget.style.display='none')} /> : <div className="w-8 h-8 rounded bg-gray-700 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">{s.type==='live'?'TV':s.type==='vod'?'M':'S'}</div>}
                  <div className="min-w-0"><p className="text-sm text-white truncate">{s.name}</p><p className="text-xs text-gray-500 truncate">{s.category_name||s.type}</p></div>
                  <div className={`ml-auto w-4 h-4 rounded flex-shrink-0 border-2 ${on ? 'bg-blue-500 border-blue-500' : 'border-gray-600'}`} />
                </div>
              );
            })}
          </div>
          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
          <div className="mt-6 flex justify-end">
            <button onClick={handleSave} disabled={saving||selected.size===0} className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold px-8 py-3 rounded-lg transition">{saving ? 'Saving...' : `Save ${selected.size} Channels & Get URL`}</button>
          </div>
        </div>
      )}
      {step === 'done' && (
        <div className="max-w-xl mx-auto text-center">
          <div className="text-5xl mb-4">Done!</div>
          <h2 className="text-2xl font-bold text-white mb-2">Your playlist is ready!</h2>
          <p className="text-gray-400 mb-6">Paste this URL into your IPTV app (TiviMate, IPTV Smarters, etc.)</p>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4">
            <p className="text-blue-400 text-sm break-all font-mono">{playlistUrl}</p>
          </div>
          <button onClick={copyUrl} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg transition mb-4">{copied ? 'Copied!' : 'Copy URL'}</button>
          <div><button onClick={() => { setStep('login'); setServer(''); setUsername(''); setPassword(''); setStreams([]); setPlaylistId(''); }} className="text-gray-400 hover:text-white text-sm underline">Start over</button></div>
        </div>
      )}
    </main>
  );
}
