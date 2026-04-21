import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';

export const dynamic = 'force-dynamic';

const BLOCKED_HOSTS = new Set(['localhost', '0.0.0.0', '::1']);

const isPrivateHost = (hostname) => {
  if (!hostname) return true;
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(lower)) return true;
  if (lower.endsWith('.local')) return true;
  const ipv4 = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
  }
  return false;
};

async function fetchAsImage(url, depth = 0) {
  if (depth > 1) throw new Error('Too many redirects while resolving image');
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol');
  if (isPrivateHost(parsed.hostname)) throw new Error('Private host not allowed');

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; BugTrackerImageProxy/1.0; +https://bugtracker)',
      'Accept': 'image/*,text/html;q=0.9,*/*;q=0.8'
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(10000)
  });

  if (!res.ok) throw new Error(`Upstream ${res.status}`);
  const ct = (res.headers.get('content-type') || '').toLowerCase();

  if (ct.startsWith('image/')) {
    const buf = await res.arrayBuffer();
    return { buf, contentType: ct };
  }

  if (ct.includes('html') || ct.includes('xml')) {
    const html = await res.text();
    const ogMatch =
      html.match(/<meta[^>]+property=["']og:image(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url|:url)?["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i);
    if (!ogMatch) throw new Error('No og:image/twitter:image meta tag found');
    const resolved = new URL(ogMatch[1], url).toString();
    return fetchAsImage(resolved, depth + 1);
  }

  throw new Error(`Unsupported content-type: ${ct || 'unknown'}`);
}

export async function GET(request) {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;

  const target = request.nextUrl.searchParams.get('url');
  if (!target) return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });

  try {
    const { buf, contentType } = await fetchAsImage(target);
    return new Response(buf, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, s-maxage=3600'
      }
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to fetch image' }, { status: 404 });
  }
}
