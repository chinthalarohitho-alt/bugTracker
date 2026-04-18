import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';

const getSQL = () => {
  if (!process.env.DATABASE_URL) return null;
  return neon(process.env.DATABASE_URL);
};

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS founder_decisions (
      id TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT DEFAULT 'strategy',
      status TEXT DEFAULT 'exploring',
      decision TEXT DEFAULT '',
      rationale TEXT DEFAULT '',
      tags JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_founder_decisions_owner ON founder_decisions(owner)`;
}

function mapRow(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category || 'strategy',
    status: row.status || 'exploring',
    decision: row.decision || '',
    rationale: row.rationale || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const newId = () => `d_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  const sql = getSQL();
  if (!sql) return NextResponse.json({ success: true, decisions: [] });
  try {
    await ensureTable(sql);
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    if (!owner) return NextResponse.json({ success: true, decisions: [] });
    const rows = await sql`
      SELECT * FROM founder_decisions
      WHERE owner = ${owner}
      ORDER BY updated_at DESC, created_at DESC
    `;
    return NextResponse.json({ success: true, decisions: rows.map(mapRow) });
  } catch (error) {
    console.error('founder-hub GET error:', error);
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
    const { owner, decision } = await request.json();
    if (!owner || !decision) return NextResponse.json({ error: 'owner and decision required' }, { status: 400 });
    const id = decision.id || newId();
    await sql`
      INSERT INTO founder_decisions
        (id, owner, title, category, status, decision, rationale, tags, created_at)
      VALUES (
        ${id}, ${owner}, ${decision.title || ''}, ${decision.category || 'strategy'},
        ${decision.status || 'exploring'}, ${decision.decision || ''}, ${decision.rationale || ''},
        ${JSON.stringify(decision.tags || [])}::jsonb,
        ${decision.createdAt || new Date().toISOString()}
      )
      ON CONFLICT (id) DO NOTHING
    `;
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('founder-hub POST error:', error);
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
    if (!owner || !id || !changes) return NextResponse.json({ error: 'owner, id, changes required' }, { status: 400 });
    const c = changes;
    await sql`
      UPDATE founder_decisions SET
        title      = COALESCE(${c.title ?? null}, title),
        category   = COALESCE(${c.category ?? null}, category),
        status     = COALESCE(${c.status ?? null}, status),
        decision   = COALESCE(${c.decision ?? null}, decision),
        rationale  = COALESCE(${c.rationale ?? null}, rationale),
        tags       = COALESCE(${c.tags !== undefined ? JSON.stringify(c.tags) : null}::jsonb, tags),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id} AND owner = ${owner}
    `;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('founder-hub PUT error:', error);
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
    await sql`DELETE FROM founder_decisions WHERE id = ${id} AND owner = ${owner}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('founder-hub DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
