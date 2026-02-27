export interface XtreamCredentials {
  server: string;
  username: string;
  password: string;
}

export interface XtreamStream {
  stream_id: number;
  name: string;
  stream_icon?: string;
  category_id?: string;
  category_name?: string;
  type: 'live' | 'vod' | 'series';
}

export function normalizeServer(raw: string): string {
  let url = raw.trim();
  if (url.startsWith('https://')) {
    url = 'http://' + url.slice(8);
  } else if (!url.startsWith('http://')) {
    url = 'http://' + url;
  }
  return url.replace(/\/$/, '');
}

export function buildApiUrl(
  creds: XtreamCredentials,
  action: string,
  extra: Record<string, string> = {}
): string {
  const base = normalizeServer(creds.server);
  const params = new URLSearchParams({
    username: creds.username,
    password: creds.password,
    action,
    ...extra,
  });
  return `${base}/player_api.php?${params.toString()}`;
}

export function streamUrl(creds: XtreamCredentials, stream: XtreamStream): string {
  const base = normalizeServer(creds.server);
  if (stream.type === 'live') {
    return `${base}/live/${creds.username}/${creds.password}/${stream.stream_id}.ts`;
  } else if (stream.type === 'vod') {
    return `${base}/movie/${creds.username}/${creds.password}/${stream.stream_id}.mp4`;
  } else {
    return `${base}/series/${creds.username}/${creds.password}/${stream.stream_id}.mp4`;
  }
}

export function toM3UEntry(creds: XtreamCredentials, stream: XtreamStream): string {
  const url = streamUrl(creds, stream);
  const tvgLogo = stream.stream_icon ? ` tvg-logo="${stream.stream_icon}"` : '';
  const groupTitle = stream.category_name ? ` group-title="${stream.category_name}"` : '';
  return `#EXTINF:-1${tvgLogo}${groupTitle},${stream.name}\n${url}`;
}
