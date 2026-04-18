import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';

const getSQL = () => {
  if (!process.env.DATABASE_URL) return null;
  return neon(process.env.DATABASE_URL);
};

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS design_resources (
      id TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      type TEXT DEFAULT 'other',
      notes TEXT DEFAULT '',
      tags JSONB DEFAULT '[]'::jsonb,
      projects JSONB DEFAULT '[]'::jsonb,
      pinned BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      last_accessed_at TIMESTAMP WITH TIME ZONE
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_design_resources_owner ON design_resources(owner)`;
}

function mapRow(row) {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    type: row.type || 'other',
    notes: row.notes || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    projects: Array.isArray(row.projects) ? row.projects : [],
    pinned: !!row.pinned,
    createdAt: row.created_at,
    lastAccessedAt: row.last_accessed_at,
  };
}

function newId() {
  return `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  const sql = getSQL();
  if (!sql) return NextResponse.json({ success: true, resources: [] });
  try {
    await ensureTable(sql);
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    if (!owner) return NextResponse.json({ success: true, resources: [] });

    const rows = await sql`
      SELECT * FROM design_resources
      WHERE owner = ${owner}
      ORDER BY pinned DESC, created_at DESC
    `;
    return NextResponse.json({ success: true, resources: rows.map(mapRow) });
  } catch (error) {
    console.error('design-hub GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  const sql = getSQL();
  if (!sql) return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 503 });
  try {
    await ensureTable(sql);
    const body = await request.json();
    const { owner, resource, resources } = body;
    if (!owner) return NextResponse.json({ error: 'owner required' }, { status: 400 });

    const insertOne = async (r) => {
      const id = r.id || newId();
      await sql`
        INSERT INTO design_resources
          (id, owner, title, url, type, notes, tags, projects, pinned, created_at)
        VALUES (
          ${id}, ${owner}, ${r.title || ''}, ${r.url || ''}, ${r.type || 'other'},
          ${r.notes || ''}, ${JSON.stringify(r.tags || [])}::jsonb,
          ${JSON.stringify(r.projects || [])}::jsonb, ${!!r.pinned},
          ${r.createdAt || new Date().toISOString()}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      return id;
    };

    if (Array.isArray(resources)) {
      const ids = [];
      for (const r of resources) ids.push(await insertOne(r));
      return NextResponse.json({ success: true, ids });
    }

    if (resource) {
      const id = await insertOne(resource);
      return NextResponse.json({ success: true, id });
    }

    return NextResponse.json({ error: 'resource or resources required' }, { status: 400 });
  } catch (error) {
    console.error('design-hub POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  const sql = getSQL();
  if (!sql) return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 503 });
  try {
    await ensureTable(sql);
    const { owner, id, changes } = await request.json();
    if (!owner || !id || !changes) {
      return NextResponse.json({ error: 'owner, id, changes required' }, { status: 400 });
    }

    const c = changes;
    await sql`
      UPDATE design_resources SET
        title             = COALESCE(${c.title ?? null}, title),
        url               = COALESCE(${c.url ?? null}, url),
        type              = COALESCE(${c.type ?? null}, type),
        notes             = COALESCE(${c.notes ?? null}, notes),
        tags              = COALESCE(${c.tags !== undefined ? JSON.stringify(c.tags) : null}::jsonb, tags),
        projects          = COALESCE(${c.projects !== undefined ? JSON.stringify(c.projects) : null}::jsonb, projects),
        pinned            = COALESCE(${c.pinned !== undefined ? !!c.pinned : null}, pinned),
        last_accessed_at  = COALESCE(${c.lastAccessedAt ?? null}, last_accessed_at)
      WHERE id = ${id} AND owner = ${owner}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('design-hub PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  const sql = getSQL();
  if (!sql) return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 503 });
  try {
    await ensureTable(sql);
    const { owner, id } = await request.json();
    if (!owner || !id) return NextResponse.json({ error: 'owner and id required' }, { status: 400 });

    await sql`DELETE FROM design_resources WHERE id = ${id} AND owner = ${owner}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('design-hub DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
