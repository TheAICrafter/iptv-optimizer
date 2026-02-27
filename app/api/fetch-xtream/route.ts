import { NextRequest, NextResponse } from 'next/server';
import { normalizeServer, XtreamCredentials, XtreamStream } from '@/lib/xtream';

export const maxDuration = 60;

function parseM3U(m3uText: string, creds: XtreamCredentials): XtreamStream[] {
  const streams: XtreamStream[] = [];
  const lines = m3uText.split('\n');
  
  let currentStream: Partial<XtreamStream> | null = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('#EXTINF:')) {
      // Parse EXTINF line
      currentStream = {};
      
      // Extract tvg-logo
      const logoMatch = trimmed.match(/tvg-logo="([^"]+)"/);
      if (logoMatch) currentStream.stream_icon = logoMatch[1];
      
      // Extract group-title (category)
      const groupMatch = trimmed.match(/group-title="([^"]+)"/);
      if (groupMatch) currentStream.category_name = groupMatch[1];
      
      // Extract stream name (everything after the last comma)
      const nameMatch = trimmed.match(/,(.+)$/);
      if (nameMatch) currentStream.name = nameMatch[1].trim();
      
    } else if (trimmed && !trimmed.startsWith('#') && currentStream) {
      // This is the URL line
      // Extract stream type and ID from URL
      // Format: http://server/live/username/password/STREAM_ID.ext
      // Or: http://server/movie/username/password/STREAM_ID.ext
      // Or: http://server/series/username/password/STREAM_ID.ext
      
      const urlMatch = trimmed.match(/\/(live|movie|series)\/[^\/]+\/[^\/]+\/(\d+)\.([a-z0-9]+)$/i);
      if (urlMatch) {
        const [, type, id, ext] = urlMatch;
        currentStream.stream_id = parseInt(id);
        currentStream.container_extension = ext;
        
        if (type === 'live') {
          currentStream.type = 'live';
        } else if (type === 'movie') {
          currentStream.type = 'vod';
        } else if (type === 'series') {
          currentStream.type = 'series';
        }
        
        if (currentStream.stream_id && currentStream.type && currentStream.name) {
          streams.push(currentStream as XtreamStream);
        }
      }
      
      currentStream = null;
    }
  }
  
  return streams;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { server, username, password } = body;

  if (!server || !username || !password) {
    return NextResponse.json({ error: 'Saknar inloggningsuppgifter' }, { status: 400 });
  }

  const creds: XtreamCredentials = { server: normalizeServer(server), username, password };

  try {
    // First verify authentication
    const base = normalizeServer(server);
    const authUrl = `${base}/player_api.php?username=${username}&password=${password}&action=get_user_info`;
    const authRes = await fetch(authUrl, { cache: 'no-store' });
    
    if (!authRes.ok) {
      return NextResponse.json({ error: 'Kunde inte ansluta till servern' }, { status: 502 });
    }
    
    const authData = await authRes.json();
    if (!authData?.user_info) {
      return NextResponse.json({ error: 'Ogiltiga inloggningsuppgifter' }, { status: 401 });
    }

    // Fetch M3U playlist with all content
    const m3uUrl = `${base}/get.php?username=${username}&password=${password}&type=m3u_plus&output=ts`;
    const m3uRes = await fetch(m3uUrl, { cache: 'no-store' });
    
    if (!m3uRes.ok) {
      return NextResponse.json({ error: 'Kunde inte hämta spellista' }, { status: 502 });
    }
    
    const m3uText = await m3uRes.text();
    const streams = parseM3U(m3uText, creds);

    return NextResponse.json({ streams });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
