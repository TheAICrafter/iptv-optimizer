import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { toM3UEntry, XtreamCredentials, XtreamStream } from '@/lib/xtream';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  if (!id) return new NextResponse('Not found', { status: 404 });
  try {
    const { data, error } = await supabase
      .from('playlists')
      .select('entries')
      .eq('id', id)
      .single();
    if (error || !data) return new NextResponse('Playlist not found', { status: 404 });

    const { streams, creds }: { streams: XtreamStream[]; creds: XtreamCredentials } = data.entries;
    const entries = streams.map(s => toM3UEntry(creds, s));
    const m3u = '#EXTM3U\n' + entries.join('\n');

    // Increment hit count (fire and forget)
    supabase.from('playlists').update({ hit_count: (data as any).hit_count + 1 }).eq('id', id).then(() => {});

    return new NextResponse(m3u, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-mpegurl',
        'Content-Disposition': `attachment; filename="playlist-${id}.m3u"`,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    return new NextResponse('Server error', { status: 500 });
  }
}
