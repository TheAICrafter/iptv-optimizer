import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { normalizeServer, XtreamStream } from '@/lib/xtream';

export const maxDuration = 60;

type ContentType = 'live' | 'vod' | 'series';

interface SelectedCategory {
  category_id: string;
  type: ContentType;
}

function buildApiUrl(server: string, username: string, password: string, action: string, extra: Record<string, string> = {}): string {
  const base = normalizeServer(server);
  const params = new URLSearchParams({ username, password, action, ...extra });
  return `${base}/player_api.php?${params.toString()}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { credentials, selectedCategories } = body;

  if (!credentials || !selectedCategories || !Array.isArray(selectedCategories)) {
    return NextResponse.json({ error: 'Ogiltig payload' }, { status: 400 });
  }

  const { server, username, password } = credentials;
  const streams: XtreamStream[] = [];

  try {
    for (const cat of selectedCategories as SelectedCategory[]) {
      const { category_id, type } = cat;

      if (type === 'live') {
        const url = buildApiUrl(server, username, password, 'get_live_streams', { category_id });
        const res = await fetch(url, { cache: 'no-store' });
        const data = await res.json().catch(() => []);
        if (Array.isArray(data)) {
          for (const s of data) {
            streams.push({
              stream_id: parseInt(s.stream_id),
              name: s.name,
              type: 'live',
              stream_icon: s.stream_icon,
              category_id: String(cat.category_id),
              category_name: s.category_name || '',
            });
          }
        }
      } else if (type === 'vod') {
        const url = buildApiUrl(server, username, password, 'get_vod_streams', { category_id });
        const res = await fetch(url, { cache: 'no-store' });
        const data = await res.json().catch(() => []);
        if (Array.isArray(data)) {
          for (const s of data) {
            streams.push({
              stream_id: parseInt(s.stream_id),
              name: s.name,
              type: 'vod',
              stream_icon: s.stream_icon,
              category_id: String(cat.category_id),
              category_name: s.category_name || '',
              container_extension: s.container_extension || 'mp4',
            });
          }
        }
      } else if (type === 'series') {
        const url = buildApiUrl(server, username, password, 'get_series', { category_id });
        const res = await fetch(url, { cache: 'no-store' });
        const seriesList = await res.json().catch(() => []);
        if (Array.isArray(seriesList)) {
          for (const s of seriesList) {
            const infoUrl = buildApiUrl(server, username, password, 'get_series_info', { series_id: String(s.series_id) });
            const infoRes = await fetch(infoUrl, { cache: 'no-store' });
            const info = await infoRes.json().catch(() => null);
            if (!info || !info.episodes) continue;
            for (const [seasonNum, episodes] of Object.entries(info.episodes)) {
              if (!Array.isArray(episodes)) continue;
              for (const ep of episodes as any[]) {
                if (!ep.id) continue;
                const sNum = String(ep.season || seasonNum).padStart(2, '0');
                const eNum = String(ep.episode_num).padStart(2, '0');
                const epTitle = ep.title ? ` - ${ep.title}` : '';
                streams.push({
                  stream_id: parseInt(ep.id),
                  name: `${s.name} - S${sNum}E${eNum}${epTitle}`,
                  type: 'series',
                  stream_icon: s.cover || s.stream_icon,
                  category_id: String(cat.category_id),
                  category_name: s.category_name || '',
                  container_extension: ep.container_extension || 'mkv',
                });
              }
            }
          }
        }
      }
    }

    // Save to Supabase - same format as save-playlist
    const creds = { server: normalizeServer(server), username, password };
    const { data, error } = await supabase
      .from('playlists')
      .insert([{ 
        entries: { streams, creds },
        name: `Playlist ${new Date().toISOString()}`
      }])
      .select('id')
      .single();

    if (error) throw error;
    return NextResponse.json({ id: data.id, count: streams.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
