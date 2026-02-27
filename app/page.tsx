'use client';
import { useState } from 'react';

type Step = 'login' | 'browse' | 'done';
type ContentType = 'live' | 'vod' | 'series';

interface Category {
  category_id: string;
  category_name: string;
  type: ContentType;
}

interface Categories {
  live: Category[];
  vod: Category[];
  series: Category[];
}

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
  const [categories, setCategories] = useState<Categories>({ live: [], vod: [], series: [] });
  const [credentials, setCredentials] = useState<{ server: string; username: string; password: string } | null>(null);
  const [playlistId, setPlaylistId] = useState('');
  const [server, setServer] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
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
      setCategories(data.categories);
      setCredentials(data.credentials);
      setSelectedCats(new Set());
      setStep('browse');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!credentials) return;
    setSaving(true);
    setError('');
    try {
      // Build list of selected categories with their type
      const selectedCategories: { category_id: string; type: ContentType }[] = [];
      for (const cat of categories.live) {
        if (selectedCats.has(`live:${cat.category_id}`)) {
          selectedCategories.push({ category_id: cat.category_id, type: 'live' });
        }
      }
      for (const cat of categories.vod) {
        if (selectedCats.has(`vod:${cat.category_id}`)) {
          selectedCategories.push({ category_id: cat.category_id, type: 'vod' });
        }
      }
      for (const cat of categories.series) {
        if (selectedCats.has(`series:${cat.category_id}`)) {
          selectedCategories.push({ category_id: cat.category_id, type: 'series' });
        }
      }

      const res = await fetch('/api/generate-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentials, selectedCategories })
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

  const currentCats = categories[activeTab].filter(c =>
    c.category_name.toLowerCase().includes(catSearch.toLowerCase())
  ).sort((a, b) => a.category_name.localeCompare(b.category_name));

  function toggleCat(type: ContentType, catId: string) {
    const key = `${type}:${catId}`;
    const ns = new Set(selectedCats);
    if (ns.has(key)) ns.delete(key);
    else ns.add(key);
    setSelectedCats(ns);
  }

  const totalSelected = selectedCats.size;
  const playlistUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/playlist/${playlistId}` : '';

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center py-16 px-4">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-center mb-2">IPTV Optimizer</h1>
        <p className="text-gray-400 text-center mb-10">Anslut din server, v&#228;lj kategorier, f&#229; en ren M3U-URL.</p>
        <StepIndicator step={step} />

        {step === 'login' && (
          <div className="bg-gray-900 rounded-2xl p-8 shadow-xl border border-gray-800">
            <h2 className="text-xl font-bold mb-6">Xtream Codes Login</h2>
            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Server URL</label>
                <input value={server} onChange={e => setServer(e.target.value)} placeholder="http://server.com:8080" required className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Anv&#228;ndarnamn</label>
                <input value={username} onChange={e => setUsername(e.target.value)} placeholder="username" required className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">L&#246;senord</label>
                <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="password" required className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition" />
              </div>
              {error && <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">{error}</div>}
              <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2">
                {loading ? 'Ansluter...' : 'Anslut & H&#228;mta Kategorier'}
              </button>
            </form>
          </div>
        )}

        {step === 'browse' && (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
              <div className="flex gap-2 mb-4">
                {(['live', 'vod', 'series'] as const).map(t => (
                  <button key={t} onClick={() => { setActiveTab(t); setCatSearch(''); }}
                    className={`px-5 py-2 rounded-lg font-semibold transition-all text-sm ${activeTab === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white bg-gray-800'}`}>
                    {t === 'live' ? `Live TV (${categories.live.length})` : t === 'vod' ? `Filmer (${categories.vod.length})` : `Serier (${categories.series.length})`}
                  </button>
                ))}
              </div>
              <input value={catSearch} onChange={e => setCatSearch(e.target.value)}
                placeholder="S&#246;k kategori..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none transition text-sm mb-3" />
              <div className="flex justify-between items-center text-sm text-gray-400 mb-3">
                <span><span className="text-white font-bold">{totalSelected}</span> kategorier valda</span>
                <button onClick={() => setSelectedCats(new Set())} className="text-red-400 hover:text-red-300 transition">Rensa alla</button>
              </div>
              <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto pr-1">
                {currentCats.map(cat => {
                  const key = `${activeTab}:${cat.category_id}`;
                  const active = selectedCats.has(key);
                  return (
                    <button key={cat.category_id} onClick={() => toggleCat(activeTab, cat.category_id)}
                      className={`text-left p-3 rounded-xl border-2 transition-all duration-150 flex items-center justify-between ${
                        active ? 'bg-blue-600/20 border-blue-500' : 'bg-gray-800 border-gray-700 hover:border-gray-500'
                      }`}>
                      <span className="text-sm font-medium">{cat.category_name}</span>
                      {active && <span className="text-blue-400 text-xs font-bold">&#10003; VALD</span>}
                    </button>
                  );
                })}
                {currentCats.length === 0 && <p className="text-gray-500 text-sm text-center py-8">Inga kategorier hittades</p>}
              </div>
            </div>
            {error && <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">{error}</div>}
            <button onClick={handleSave} disabled={saving || totalSelected === 0}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition text-lg">
              {saving ? 'H&#228;mtar & sparar...' : `Generera spellista (${totalSelected} kategorier valda)`}
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="bg-gray-900 rounded-2xl p-8 shadow-xl border border-gray-800 text-center space-y-6">
            <div className="text-5xl">&#127881;</div>
            <h2 className="text-2xl font-bold">Spellistan &#228;r klar!</h2>
            <p className="text-gray-400">Kopiera l&#228;nken nedan och klistra in i din IPTV-app.</p>
            <div className="relative">
              <div className="bg-gray-800 rounded-xl px-4 py-3 text-left font-mono text-sm text-blue-300 break-all pr-16">{playlistUrl}</div>
              <button onClick={() => { navigator.clipboard.writeText(playlistUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-xs font-bold transition">
                {copied ? 'Kopierat!' : 'Kopiera'}
              </button>
            </div>
            <button onClick={() => { setStep('login'); setServer(''); setUsername(''); setPassword(''); setCategories({ live: [], vod: [], series: [] }); setPlaylistId(''); setSelectedCats(new Set()); }}
              className="text-gray-500 hover:text-white text-sm font-medium transition">
              B&#246;rja om
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
