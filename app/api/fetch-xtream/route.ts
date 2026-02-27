import { NextRequest, NextResponse } from 'next/server';
import { buildApiUrl, normalizeServer, XtreamCredentials, XtreamStream } from '@/lib/xtream';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { server, username, password } = body;
  if (!server || !username || !password) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
  }
  const creds: XtreamCredentials = { server: normalizeServer(server), username, password };
  try {
    const authUrl = buildApiUrl(creds, 'get_user_info');
    const authRes = await fetch(authUrl, { cache: 'no-store' });
    if (!authRes.ok) return NextResponse.json({ error: 'Could not connect to server' }, { status: 502 });
    const authData = await authRes.json();
    if (!authData?.user_info) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

    const [liveCatRes, liveRes, vodCatRes, vodRes] = await Promise.all([
      fetch(buildApiUrl(creds, 'get_live_categories'), { cache: 'no-store' }),
      fetch(buildApiUrl(creds, 'get_live_streams'), { cache: 'no-store' }),
      fetch(buildApiUrl(creds, 'get_vod_categories'), { cache: 'no-store' }),
      fetch(buildApiUrl(creds, 'get_vod_streams'), { cache: 'no-store' }),
    ]);

    const liveCategories = await liveCatRes.json().catch(() => []);
    const liveStreamsRaw = await liveRes.json().catch(() => []);
    const vodCategories = await vodCatRes.json().catch(() => []);
    const vodStreamsRaw = await vodRes.json().catch(() => []);

    const liveCatMap: Record<string, string> = {};
    if (Array.isArray(liveCategories)) liveCategories.forEach((c: any) => { liveCatMap[c.category_id] = c.category_name; });
    const vodCatMap: Record<string, string> = {};
    if (Array.isArray(vodCategories)) vodCategories.forEach((c: any) => { vodCatMap[c.category_id] = c.category_name; });

    const streams: XtreamStream[] = [];
    if (Array.isArray(liveStreamsRaw)) {
      liveStreamsRaw.forEach((s: any) => streams.push({
        stream_id: s.stream_id,
        name: s.name,
        stream_icon: s.stream_icon,
        category_id: s.category_id,
        category_name: liveCatMap[s.category_id] || s.category_id,
        type: 'live',
      }));
    }
    if (Array.isArray(vodStreamsRaw)) {
      vodStreamsRaw.slice(0, 3000).forEach((s: any) => streams.push({
        stream_id: s.stream_id,
        name: s.name,
        stream_icon: s.stream_icon,
        category_id: s.category_id,
        category_name: vodCatMap[s.category_id] || s.category_id,
        type: 'vod',
      }));
    }
    return NextResponse.json({ streams, total: streams.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
