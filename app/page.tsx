'use client';
import { useState } from 'react';
import { XtreamCredentials, XtreamStream } from '@/lib/xtream';

type Step = 'login' | 'browse' | 'done';
type ContentType = 'live' | 'vod' | 'series';

function StepIndicator({ step }: { step: Step }) {
  const steps = [{ key: 'login', label: 'Anslut' }, { key: 'browse', label: 'Filtrera' }, { key: 'done', label: 'Klart' }];
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
  const [catSearch, setCatSearch] = useState('');
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
      if (!res.ok) throw new Error(data.error || 'Misslyckades att ansluta');
      setCreds({ server, username, password });
      setStreams(data.streams);
      // Start with NOTHING selected as per user request
      setSelected(new Set());
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
      if (!res.ok) throw new Error(data.error || 'Misslyckades att spara');
      setPlaylistId(data.id);
      setStep('done');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const currentTypeStreams = streams.filter(s => s.type === activeTab);
  const allCategories = Array.from(new Set(currentTypeStreams.map(s => s.category_name).filter(Boolean))) as string[];
  
  // Filter categories by search
  const categories = allCategories.filter(c => c.toLowerCase().includes(catSearch.toLowerCase())).sort();

  function isCategorySelected(category: string): boolean {
    const categoryStreams = currentTypeStreams.filter(s => s.category_name === category);
    return categoryStreams.length > 0 && categoryStreams.every(s => selected.has(s.stream_id));
  }

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

  function getCategoryCount(category: string): number {
    return currentTypeStreams.filter(s => s.category_name === category).length;
  }

  const playlistUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/playlist/${playlistId}` : '';

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold text-white mb-2">IPTV Optimizer</h1>
        <p className="text-gray-400 text-lg">Anslut din server, välj kategorier, få en ren M3U-URL.</p>
      </div>

      <StepIndicator step={step} />

      {step === 'login' && (
        <div className="max-w-md mx-auto">
          <form onSubmit={handleConnect} className="bg-gray-900 rounded-xl p-8 space-y-5 border border-gray-800 shadow-2xl">
            <h2 className="text-xl font-semibold text-white">Xtream Codes Login</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Server URL</label>
                <input value={server} onChange={e => setServer(e.target.value)} placeholder="http://server.com:8080" required className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Användarnamn</label>
                <input value={username} onChange={e => setUsername(e.target.value)} placeholder="username" required className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Lösenord</label>
                <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="password" required className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition" />
              </div>
            </div>
            {error && <p className="text-red-400 text-sm bg-red-900/20 p-3 rounded-lg border border-red-900/50">{error}</p>}
            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-lg transition-all transform active:scale-[0.98]">
              {loading ? 'Ansluter...' : 'Anslut & Hämta Innehåll'}
            </button>
          </form>
        </div>
      )}

      {step === 'browse' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-900/50 p-4 rounded-xl border border-gray-800">
            <div className="flex bg-gray-800 p-1 rounded-lg w-full md:w-auto">
              {(['live', 'vod', 'series'] as const).map(t => (
                <button key={t} onClick={() => { setActiveTab(t); setCatSearch(''); }} className={`px-6 py-2 rounded-md font-semibold transition-all ${activeTab === t ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                  {t === 'live' ? 'Live TV' : t === 'vod' ? 'Filmer' : 'Serier'}
                </button>
              ))}
            </div>
            <div className="relative w-full md:w-64">
              <input value={catSearch} onChange={e => setCatSearch(e.target.value)} placeholder="Sök kategorier..." className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition" />
              <svg className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
          </div>

          <div className="flex justify-between items-center text-sm">
            <div className="text-gray-400">Valt: <span className="text-blue-400 font-bold">{selected.size}</span> objekt i <span className="text-white font-medium">{allCategories.length}</span> kategorier</div>
            <button onClick={() => setSelected(new Set())} className="text-red-400 hover:text-red-300 transition font-medium">Rensa alla val</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {categories.map(cat => {
              const active = isCategorySelected(cat);
              return (
                <div key={cat} onClick={() => toggleCategory(cat)} className={`group p-4 rounded-xl cursor-pointer border-2 transition-all duration-200 ${active ? 'bg-blue-600/20 border-blue-500 ring-1 ring-blue-500' : 'bg-gray-900 border-gray-800 hover:border-gray-600'}`}>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <p className={`font-bold truncate transition-colors ${active ? 'text-blue-400' : 'text-white'}`}>{cat}</p>
                      <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold">{getCategoryCount(cat)} objekt</p>
                    </div>
                    <div className={`w-6 h-6 rounded-md border-2 transition-all flex items-center justify-center ${active ? 'bg-blue-500 border-blue-500' : 'border-gray-700 group-hover:border-gray-500'}`}>
                      {active && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-6 border-t border-gray-800 flex flex-col md:flex-row gap-4 items-center justify-between">
             <div className="text-sm text-gray-500 italic">Tips: Använd sökfältet för att snabbt hitta länder eller genrer.</div>
             <button onClick={handleSave} disabled={saving || selected.size === 0} className="w-full md:w-auto bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold px-12 py-4 rounded-xl transition-all shadow-xl transform active:scale-[0.98]">
              {saving ? 'Sparar...' : `Spara ${selected.size} valda objekt`}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="max-w-xl mx-auto text-center space-y-6 animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto border-2 border-green-500/50 shadow-2xl shadow-green-500/20">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white">Spellistan är klar!</h2>
            <p className="text-gray-400 mt-2">Kopiera länken nedan och klistra in i din IPTV-app.</p>
          </div>
          <div className="bg-gray-900 border-2 border-gray-800 rounded-2xl p-6 relative group">
            <p className="text-blue-400 text-sm break-all font-mono select-all pr-12">{playlistUrl}</p>
            <button onClick={() => { navigator.clipboard.writeText(playlistUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition">
              {copied ? <span className="text-xs text-green-400 font-bold px-1">KLART!</span> : <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
            </button>
          </div>
          <button onClick={() => { setStep('login'); setServer(''); setUsername(''); setPassword(''); setStreams([]); setPlaylistId(''); setSelected(new Set()); }} className="text-gray-500 hover:text-white text-sm font-medium transition flex items-center justify-center gap-2 mx-auto">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
             Börja om
          </button>
        </div>
      )}
    </main>
  );
}
