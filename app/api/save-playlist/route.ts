import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { toM3UEntry, XtreamCredentials, XtreamStream } from '@/lib/xtream';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { creds, streams }: { creds: XtreamCredentials; streams: XtreamStream[] } = body;
  if (!creds || !streams || !Array.isArray(streams)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  try {
    const entries = streams.map(s => toM3UEntry(creds, s));
    const m3uContent = '#EXTM3U\n' + entries.join('\n');
    const { data, error } = await supabase
      .from('playlists')
      .insert({ entries: { streams, creds: { server: creds.server, username: creds.username, password: creds.password } }, name: `Playlist ${new Date().toISOString()}` })
      .select('id')
      .single();
    if (error) throw error;
    return NextResponse.json({ id: data.id, count: streams.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save' }, { status: 500 });
  }
}
