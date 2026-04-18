import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';

const getSQL = () => {
  if (!process.env.DATABASE_URL) return null;
  return neon(process.env.DATABASE_URL);
};

async function ensureTables(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS pm_milestones (
      id TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      title TEXT NOT NULL,
      project TEXT DEFAULT '',
      due_date DATE,
      status TEXT DEFAULT 'planned',
      notes TEXT DEFAULT '',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_pm_milestones_owner ON pm_milestones(owner)`;
  await sql`
    CREATE TABLE IF NOT EXISTS pm_risks (
      id TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      title TEXT NOT NULL,
      project TEXT DEFAULT '',
      severity TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'open',
      mitigation TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_pm_risks_owner ON pm_risks(owner)`;
}

const mapMilestone = (r) => ({
  id: r.id, title: r.title, project: r.project || '',
  dueDate: r.due_date, status: r.status || 'planned', notes: r.notes || '',
  createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapRisk = (r) => ({
  id: r.id, title: r.title, project: r.project || '',
  severity: r.severity || 'medium', status: r.status || 'open',
  mitigation: r.mitigation || '', notes: r.notes || '',
  createdAt: r.created_at, updatedAt: r.updated_at,
});
const newId = (p) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  const sql = getSQL();
  if (!sql) return NextResponse.json({ success: true, milestones: [], risks: [] });
  try {
    await ensureTables(sql);
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    if (!owner) return NextResponse.json({ success: true, milestones: [], risks: [] });
    const milestones = await sql`SELECT * FROM pm_milestones WHERE owner = ${owner} ORDER BY due_date ASC NULLS LAST, created_at DESC`;
    const risks = await sql`SELECT * FROM pm_risks WHERE owner = ${owner} ORDER BY created_at DESC`;
    return NextResponse.json({
      success: true,
      milestones: milestones.map(mapMilestone),
      risks: risks.map(mapRisk),
    });
  } catch (error) {
    console.error('pm-hub GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  const sql = getSQL();
  if (!sql) return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 503 });
  try {
    await ensureTables(sql);
    const { owner, kind, payload } = await request.json();
    if (!owner || !kind || !payload) return NextResponse.json({ error: 'owner, kind, payload required' }, { status: 400 });

    if (kind === 'milestone') {
      const id = payload.id || newId('m');
      await sql`
        INSERT INTO pm_milestones (id, owner, title, project, due_date, status, notes)
        VALUES (${id}, ${owner}, ${payload.title || ''}, ${payload.project || ''},
                ${payload.dueDate || null}, ${payload.status || 'planned'}, ${payload.notes || ''})
        ON CONFLICT (id) DO NOTHING
      `;
      return NextResponse.json({ success: true, id });
    }

    if (kind === 'risk') {
      const id = payload.id || newId('r');
      await sql`
        INSERT INTO pm_risks (id, owner, title, project, severity, status, mitigation, notes)
        VALUES (${id}, ${owner}, ${payload.title || ''}, ${payload.project || ''},
                ${payload.severity || 'medium'}, ${payload.status || 'open'},
                ${payload.mitigation || ''}, ${payload.notes || ''})
        ON CONFLICT (id) DO NOTHING
      `;
      return NextResponse.json({ success: true, id });
    }
    return NextResponse.json({ error: 'unknown kind' }, { status: 400 });
  } catch (error) {
    console.error('pm-hub POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  const sql = getSQL();
  if (!sql) return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 503 });
  try {
    await ensureTables(sql);
    const { owner, kind, id, changes } = await request.json();
    if (!owner || !kind || !id || !changes) return NextResponse.json({ error: 'owner, kind, id, changes required' }, { status: 400 });
    const c = changes;

    if (kind === 'milestone') {
      await sql`
        UPDATE pm_milestones SET
          title    = COALESCE(${c.title ?? null}, title),
          project  = COALESCE(${c.project ?? null}, project),
          due_date = COALESCE(${c.dueDate ?? null}, due_date),
          status   = COALESCE(${c.status ?? null}, status),
          notes    = COALESCE(${c.notes ?? null}, notes),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id} AND owner = ${owner}
      `;
      return NextResponse.json({ success: true });
    }

    if (kind === 'risk') {
      await sql`
        UPDATE pm_risks SET
          title      = COALESCE(${c.title ?? null}, title),
          project    = COALESCE(${c.project ?? null}, project),
          severity   = COALESCE(${c.severity ?? null}, severity),
          status     = COALESCE(${c.status ?? null}, status),
          mitigation = COALESCE(${c.mitigation ?? null}, mitigation),
          notes      = COALESCE(${c.notes ?? null}, notes),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id} AND owner = ${owner}
      `;
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'unknown kind' }, { status: 400 });
  } catch (error) {
    console.error('pm-hub PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  const sql = getSQL();
  if (!sql) return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 503 });
  try {
    await ensureTables(sql);
    const { owner, kind, id } = await request.json();
    if (!owner || !kind || !id) return NextResponse.json({ error: 'owner, kind, id required' }, { status: 400 });
    if (kind === 'milestone') { await sql`DELETE FROM pm_milestones WHERE id = ${id} AND owner = ${owner}`; return NextResponse.json({ success: true }); }
    if (kind === 'risk')      { await sql`DELETE FROM pm_risks      WHERE id = ${id} AND owner = ${owner}`; return NextResponse.json({ success: true }); }
    return NextResponse.json({ error: 'unknown kind' }, { status: 400 });
  } catch (error) {
    console.error('pm-hub DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
