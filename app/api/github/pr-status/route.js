import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';

// Parse GitHub PR URL → { owner, repo, number }
function parsePrUrl(url) {
  if (!url) return null;
  // Supports: https://github.com/owner/repo/pull/123
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2], number: match[3] };
}

export async function POST(request) {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;

  try {
    const { urls } = await request.json();
    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ statuses: [] });
    }

    const statuses = await Promise.all(
      urls.map(async (url) => {
        const parsed = parsePrUrl(url);
        if (!parsed) return { url, status: 'invalid', label: 'Invalid URL' };

        try {
          const headers = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'TapzaBugPortal' };
          if (process.env.GITHUB_TOKEN) {
            headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
          }

          const res = await fetch(
            `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}`,
            { headers, cache: 'no-store' }
          );

          if (!res.ok) {
            if (res.status === 404) return { url, status: 'not_found', label: 'Not Found' };
            return { url, status: 'error', label: 'Error' };
          }

          const data = await res.json();

          if (data.merged) {
            return {
              url, status: 'merged', label: 'Merged',
              mergedAt: data.merged_at,
              mergedBy: data.merged_by?.login,
              title: data.title,
            };
          } else if (data.state === 'closed') {
            return {
              url, status: 'closed', label: 'Closed',
              closedAt: data.closed_at,
              title: data.title,
            };
          } else {
            return {
              url, status: 'open', label: 'Open',
              title: data.title,
              draft: data.draft,
              reviewComments: data.review_comments,
              additions: data.additions,
              deletions: data.deletions,
            };
          }
        } catch (err) {
          return { url, status: 'error', label: 'Error' };
        }
      })
    );

    return NextResponse.json({ statuses });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
