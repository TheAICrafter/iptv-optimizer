import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { normalizeServer } from '@/lib/xtream';

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
  const lines: string[] = ['#EXTM3U'];

  try {
    for (const cat of selectedCategories as SelectedCategory[]) {
      const { category_id, type } = cat;

      if (type === 'live') {
        const url = buildApiUrl(server, username, password, 'get_live_streams', { category_id });
        const res = await fetch(url, { cache: 'no-store' });
        const streams = await res.json().catch(() => []);
        if (Array.isArray(streams)) {
          for (const s of streams) {
            const name = (s.name || '').replace(/"/g, '');
            const icon = s.stream_icon && s.stream_icon.startsWith('http') ? ` tvg-logo="${s.stream_icon}"` : '';
            const base = normalizeServer(server);
            lines.push(`#EXTINF:-1 tvg-id="${s.stream_id}" tvg-name="${name}" group-title="${s.category_name || ''}"${icon},${name}`);
            lines.push(`${base}/live/${username}/${password}/${s.stream_id}.ts`);
          }
        }
      } else if (type === 'vod') {
        const url = buildApiUrl(server, username, password, 'get_vod_streams', { category_id });
        const res = await fetch(url, { cache: 'no-store' });
        const streams = await res.json().catch(() => []);
        if (Array.isArray(streams)) {
          for (const s of streams) {
            const name = (s.name || '').replace(/"/g, '');
            const ext = s.container_extension || 'mp4';
            const icon = s.stream_icon && s.stream_icon.startsWith('http') ? ` tvg-logo="${s.stream_icon}"` : '';
            const base = normalizeServer(server);
            lines.push(`#EXTINF:-1 tvg-name="${name}" group-title="${s.category_name || ''}"${icon},${name}`);
            lines.push(`${base}/movie/${username}/${password}/${s.stream_id}.${ext}`);
          }
        }
      } else if (type === 'series') {
        // Fetch series list for this category
        const url = buildApiUrl(server, username, password, 'get_series', { category_id });
        const res = await fetch(url, { cache: 'no-store' });
        const seriesList = await res.json().catch(() => []);
        if (Array.isArray(seriesList)) {
          for (const s of seriesList) {
            // Fetch episode info for each series
            const infoUrl = buildApiUrl(server, username, password, 'get_series_info', { series_id: String(s.series_id) });
            const infoRes = await fetch(infoUrl, { cache: 'no-store' });
            const info = await infoRes.json().catch(() => null);
            if (!info || !info.episodes) continue;
            const base = normalizeServer(server);
            const icon = s.cover && s.cover.startsWith('http') ? ` tvg-logo="${s.cover}"` : '';
            const catName = s.category_name || '';
            // Iterate seasons and episodes
            for (const [seasonNum, episodes] of Object.entries(info.episodes)) {
              if (!Array.isArray(episodes)) continue;
              for (const ep of episodes as any[]) {
                if (!ep.id) continue;
                const sNum = String(ep.season || seasonNum).padStart(2, '0');
                const eNum = String(ep.episode_num).padStart(2, '0');
                const epTitle = ep.title ? ` - ${ep.title}` : '';
                const epName = `${s.name} - S${sNum}E${eNum}${epTitle}`.replace(/"/g, '');
                const ext = ep.container_extension || 'mkv';
                lines.push(`#EXTINF:-1 tvg-name="${epName}" group-title="${catName}"${icon},${epName}`);
                lines.push(`${base}/series/${username}/${password}/${ep.id}.${ext}`);
              }
            }
          }
        }
      }
    }

    const m3uContent = lines.join('\n');

    // Save to Supabase
    const { data, error } = await supabase
      .from('playlists')
      .insert([{ 
        entries: m3uContent,
        creds: { server: normalizeServer(server), username, password },
        name: `Playlist ${new Date().toISOString()}`
      }])
      .select('id')
      .single();

    if (error) throw error;
    return NextResponse.json({ id: data.id, count: lines.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
