import { NextRequest, NextResponse } from 'next/server';
import { normalizeServer, XtreamCredentials } from '@/lib/xtream';

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

    // Fetch ONLY categories - no stream data yet!
    const [liveCatsRes, vodCatsRes, seriesCatsRes] = await Promise.all([
      fetch(buildApiUrl(creds, 'get_live_categories'), { cache: 'no-store' }),
      fetch(buildApiUrl(creds, 'get_vod_categories'), { cache: 'no-store' }),
      fetch(buildApiUrl(creds, 'get_series_categories'), { cache: 'no-store' }),
    ]);

    const liveCategories = await liveCatsRes.json().catch(() => []);
    const vodCategories = await vodCatsRes.json().catch(() => []);
    const seriesCategories = await seriesCatsRes.json().catch(() => []);

    // Return categories with metadata only
    const categories = {
      live: Array.isArray(liveCategories) ? liveCategories.map((c: any) => ({
        category_id: String(c.category_id),
        category_name: c.category_name,
        type: 'live' as const,
      })) : [],
      vod: Array.isArray(vodCategories) ? vodCategories.map((c: any) => ({
        category_id: String(c.category_id),
        category_name: c.category_name,
        type: 'vod' as const,
      })) : [],
      series: Array.isArray(seriesCategories) ? seriesCategories.map((c: any) => ({
        category_id: String(c.category_id),
        category_name: c.category_name,
        type: 'series' as const,
      })) : [],
    };

    // Return categories + credentials for later use
    return NextResponse.json({ 
      categories,
      credentials: { server: creds.server, username, password }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
