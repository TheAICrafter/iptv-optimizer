import { NextRequest, NextResponse } from 'next/server';
import { buildApiUrl, normalizeServer, XtreamCredentials, XtreamStream } from '@/lib/xtream';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { server, username, password } = body;
  if (!server || !username || !password) {
    return NextResponse.json({ error: 'Saknar inloggningsuppgifter' }, { status: 400 });
  }
  const creds: XtreamCredentials = { server: normalizeServer(server), username, password };
  try {
    const authUrl = buildApiUrl(creds, 'get_user_info');
    const authRes = await fetch(authUrl, { cache: 'no-store' });
    if (!authRes.ok) return NextResponse.json({ error: 'Kunde inte ansluta till servern' }, { status: 502 });
    const authData = await authRes.json();
    if (!authData?.user_info) return NextResponse.json({ error: 'Ogiltiga inloggningsuppgifter' }, { status: 401 });

    const [liveCatRes, liveRes, vodCatRes, vodRes, seriesCatRes, seriesListRes] = await Promise.all([
      fetch(buildApiUrl(creds, 'get_live_categories'), { cache: 'no-store' }),
      fetch(buildApiUrl(creds, 'get_live_streams'), { cache: 'no-store' }),
      fetch(buildApiUrl(creds, 'get_vod_categories'), { cache: 'no-store' }),
      fetch(buildApiUrl(creds, 'get_vod_streams'), { cache: 'no-store' }),
      fetch(buildApiUrl(creds, 'get_series_categories'), { cache: 'no-store' }),
      fetch(buildApiUrl(creds, 'get_series'), { cache: 'no-store' }),
    ]);

    const liveCategories = await liveCatRes.json().catch(() => []);
    const liveStreamsRaw = await liveRes.json().catch(() => []);
    const vodCategories = await vodCatRes.json().catch(() => []);
    const vodStreamsRaw = await vodRes.json().catch(() => []);
    const seriesCategories = await seriesCatRes.json().catch(() => []);
    const seriesList = await seriesListRes.json().catch(() => []);

    const liveCatMap: Record<string, string> = {};
    if (Array.isArray(liveCategories)) liveCategories.forEach((c: any) => liveCatMap[c.category_id] = c.category_name);
    const vodCatMap: Record<string, string> = {};
    if (Array.isArray(vodCategories)) vodCategories.forEach((c: any) => vodCatMap[c.category_id] = c.category_name);
    const seriesCatMap: Record<string, string> = {};
    if (Array.isArray(seriesCategories)) seriesCategories.forEach((c: any) => seriesCatMap[c.category_id] = c.category_name);

    // Fetch episodes for each series (batched to avoid timeout)
    const seriesEpisodes: XtreamStream[] = [];
    if (Array.isArray(seriesList) && seriesList.length > 0) {
      const BATCH = 10;
      for (let i = 0; i < Math.min(seriesList.length, 200); i += BATCH) {
        const batch = seriesList.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map((s: any) =>
            fetch(buildApiUrl(creds, 'get_series_info', { series_id: String(s.series_id) }), { cache: 'no-store' })
              .then(r => r.json())
              .catch(() => null)
          )
        );
        for (let j = 0; j < batch.length; j++) {
          const seriesEntry = batch[j];
          const result = results[j];
          if (result.status !== 'fulfilled' || !result.value) continue;
          const info = result.value;
          const episodes: any[] = [];
          if (info.episodes && typeof info.episodes === 'object') {
            for (const season of Object.values(info.episodes)) {
              if (Array.isArray(season)) episodes.push(...season);
            }
          }
          for (const ep of episodes) {
            if (!ep.id) continue;
            seriesEpisodes.push({
              stream_id: parseInt(ep.id),
              name: `${seriesEntry.name} - S${String(ep.season).padStart(2,'0')}E${String(ep.episode_num).padStart(2,'0')}${ep.title ? ' - ' + ep.title : ''}`,
              type: 'series' as const,
              stream_icon: seriesEntry.cover || seriesEntry.stream_icon,
              category_id: seriesEntry.category_id,
              category_name: seriesCatMap[seriesEntry.category_id] || '',
            });
          }
        }
      }
    }

    const streams: XtreamStream[] = [
      ...(Array.isArray(liveStreamsRaw) ? liveStreamsRaw.map((s: any) => ({
        stream_id: parseInt(s.stream_id),
        name: s.name,
        type: 'live' as const,
        stream_icon: s.stream_icon,
        category_id: s.category_id,
        category_name: liveCatMap[s.category_id] || ''
      })) : []),
      ...(Array.isArray(vodStreamsRaw) ? vodStreamsRaw.map((s: any) => ({
        stream_id: parseInt(s.stream_id),
        name: s.name,
        type: 'vod' as const,
        stream_icon: s.stream_icon,
        category_id: s.category_id,
        category_name: vodCatMap[s.category_id] || ''
      })) : []),
      ...seriesEpisodes,
    ];

    return NextResponse.json({ streams });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
