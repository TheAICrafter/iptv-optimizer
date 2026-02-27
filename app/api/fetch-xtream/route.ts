import { NextRequest, NextResponse } from 'next/server';
import { normalizeServer, XtreamCredentials, XtreamStream } from '@/lib/xtream';

export const maxDuration = 60;

function buildApiUrl(creds: XtreamCredentials, action: string, extra: Record<string, string> = {}): string {
  const base = normalizeServer(creds.server);
  const params = new URLSearchParams({
    username: creds.username,
    password: creds.password,
    action,
    ...extra,
  });
  return `${base}/player_api.php?${params.toString()}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { server, username, password } = body;

  if (!server || !username || !password) {
    return NextResponse.json({ error: 'Saknar inloggningsuppgifter' }, { status: 400 });
  }

  const creds: XtreamCredentials = { server: normalizeServer(server), username, password };

  try {
    // Verify authentication
    const authUrl = buildApiUrl(creds, 'get_user_info');
    const authRes = await fetch(authUrl, { cache: 'no-store' });
    
    if (!authRes.ok) {
      return NextResponse.json({ error: 'Kunde inte ansluta till servern' }, { status: 502 });
    }
    
    const authData = await authRes.json();
    if (!authData?.user_info) {
      return NextResponse.json({ error: 'Ogiltiga inloggningsuppgifter' }, { status: 401 });
    }

    const streams: XtreamStream[] = [];

    // LIVE - fetch per category to avoid truncation
    const liveCatsRes = await fetch(buildApiUrl(creds, 'get_live_categories'), { cache: 'no-store' });
    const liveCats = await liveCatsRes.json().catch(() => []);
    
    if (Array.isArray(liveCats)) {
      for (const cat of liveCats) {
        const catStreamsRes = await fetch(buildApiUrl(creds, 'get_live_streams', { category_id: String(cat.category_id) }), { cache: 'no-store' });
        const catStreams = await catStreamsRes.json().catch(() => []);
        
        if (Array.isArray(catStreams)) {
          for (const item of catStreams) {
            streams.push({
              stream_id: parseInt(item.stream_id),
              name: item.name,
              type: 'live',
              stream_icon: item.stream_icon,
              category_id: String(cat.category_id),
              category_name: cat.category_name,
            });
          }
        }
      }
    }

    // VOD - fetch per category to avoid truncation
    const vodCatsRes = await fetch(buildApiUrl(creds, 'get_vod_categories'), { cache: 'no-store' });
    const vodCats = await vodCatsRes.json().catch(() => []);
    
    if (Array.isArray(vodCats)) {
      for (const cat of vodCats) {
        const catStreamsRes = await fetch(buildApiUrl(creds, 'get_vod_streams', { category_id: String(cat.category_id) }), { cache: 'no-store' });
        const catStreams = await catStreamsRes.json().catch(() => []);
        
        if (Array.isArray(catStreams)) {
          for (const item of catStreams) {
            streams.push({
              stream_id: parseInt(item.stream_id),
              name: item.name,
              type: 'vod',
              stream_icon: item.stream_icon,
              category_id: String(cat.category_id),
              category_name: cat.category_name,
              container_extension: item.container_extension || 'mp4',
            });
          }
        }
      }
    }

    // SERIES - fetch per category to avoid truncation
    const seriesCatsRes = await fetch(buildApiUrl(creds, 'get_series_categories'), { cache: 'no-store' });
    const seriesCats = await seriesCatsRes.json().catch(() => []);
    
    if (Array.isArray(seriesCats)) {
      for (const cat of seriesCats) {
        const catStreamsRes = await fetch(buildApiUrl(creds, 'get_series', { category_id: String(cat.category_id) }), { cache: 'no-store' });
        const catStreams = await catStreamsRes.json().catch(() => []);
        
        if (Array.isArray(catStreams)) {
          for (const item of catStreams) {
            streams.push({
              stream_id: parseInt(item.series_id),
              name: item.name,
              type: 'series',
              stream_icon: item.cover || item.stream_icon,
              category_id: String(cat.category_id),
              category_name: cat.category_name,
              container_extension: 'mp4',
            });
          }
        }
      }
    }

    return NextResponse.json({ streams });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
