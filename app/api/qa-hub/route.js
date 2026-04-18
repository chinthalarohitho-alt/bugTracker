import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';

const getSQL = () => {
  if (!process.env.DATABASE_URL) return null;
  return neon(process.env.DATABASE_URL);
};

async function ensureTables(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS qa_test_runs (
      id TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      title TEXT NOT NULL,
      project TEXT DEFAULT '',
      scope TEXT DEFAULT '',
      run_date DATE,
      result TEXT DEFAULT 'in_progress',
      passed_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      blocked_count INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      bug_ids JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_qa_test_runs_owner ON qa_test_runs(owner)`;
  await sql`
    CREATE TABLE IF NOT EXISTS qa_test_cases (
      id TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      project TEXT DEFAULT '',
      module TEXT DEFAULT '',
      title TEXT NOT NULL,
      url TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      tags JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_qa_test_cases_owner ON qa_test_cases(owner)`;
  await sql`
    CREATE TABLE IF NOT EXISTS qa_signoffs (
      id TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      title TEXT NOT NULL,
      project TEXT DEFAULT '',
      environment TEXT DEFAULT 'staging',
      build_url TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      verified_date DATE,
      notes TEXT DEFAULT '',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_qa_signoffs_owner ON qa_signoffs(owner)`;
}

const mapRun = (r) => ({
  id: r.id,
  title: r.title,
  project: r.project || '',
  scope: r.scope || '',
  runDate: r.run_date,
  result: r.result || 'in_progress',
  passedCount: r.passed_count || 0,
  failedCount: r.failed_count || 0,
  blockedCount: r.blocked_count || 0,
  notes: r.notes || '',
  bugIds: Array.isArray(r.bug_ids) ? r.bug_ids : [],
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapCase = (r) => ({
  id: r.id,
  project: r.project || '',
  module: r.module || '',
  title: r.title,
  url: r.url || '',
  notes: r.notes || '',
  tags: Array.isArray(r.tags) ? r.tags : [],
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapSignoff = (r) => ({
  id: r.id,
  title: r.title,
  project: r.project || '',
  environment: r.environment || 'staging',
  buildUrl: r.build_url || '',
  status: r.status || 'pending',
  verifiedDate: r.verified_date,
  notes: r.notes || '',
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const newId = (p) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  const sql = getSQL();
  if (!sql) return NextResponse.json({ success: true, runs: [], testCases: [] });
  try {
    await ensureTables(sql);
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    if (!owner) return NextResponse.json({ success: true, runs: [], testCases: [] });
    const runs = await sql`
      SELECT * FROM qa_test_runs
      WHERE owner = ${owner}
      ORDER BY run_date DESC NULLS LAST, created_at DESC
    `;
    const cases = await sql`
      SELECT * FROM qa_test_cases
      WHERE owner = ${owner}
      ORDER BY project, module, title
    `;
    const signoffs = await sql`
      SELECT * FROM qa_signoffs
      WHERE owner = ${owner}
      ORDER BY verified_date DESC NULLS LAST, created_at DESC
    `;
    return NextResponse.json({
      success: true,
      runs: runs.map(mapRun),
      testCases: cases.map(mapCase),
      signoffs: signoffs.map(mapSignoff),
    });
  } catch (error) {
    console.error('qa-hub GET error:', error);
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
    const body = await request.json();
    const { owner, kind, payload, run } = body;
    // Backwards-compat: existing callers may still send { owner, run }
    const k = kind || (run ? 'run' : null);
    const p = payload || run;
    if (!owner || !k || !p) return NextResponse.json({ error: 'owner, kind, payload required' }, { status: 400 });

    if (k === 'run') {
      const id = p.id || newId('tr');
      await sql`
        INSERT INTO qa_test_runs
          (id, owner, title, project, scope, run_date, result,
           passed_count, failed_count, blocked_count, notes, bug_ids)
        VALUES (
          ${id}, ${owner}, ${p.title || ''}, ${p.project || ''},
          ${p.scope || ''}, ${p.runDate || null}, ${p.result || 'in_progress'},
          ${Number(p.passedCount) || 0}, ${Number(p.failedCount) || 0},
          ${Number(p.blockedCount) || 0}, ${p.notes || ''},
          ${JSON.stringify(p.bugIds || [])}::jsonb
        )
        ON CONFLICT (id) DO NOTHING
      `;
      return NextResponse.json({ success: true, id });
    }

    if (k === 'test_case') {
      const id = p.id || newId('tc');
      await sql`
        INSERT INTO qa_test_cases
          (id, owner, project, module, title, url, notes, tags)
        VALUES (
          ${id}, ${owner}, ${p.project || ''}, ${p.module || ''},
          ${p.title || ''}, ${p.url || ''}, ${p.notes || ''},
          ${JSON.stringify(p.tags || [])}::jsonb
        )
        ON CONFLICT (id) DO NOTHING
      `;
      return NextResponse.json({ success: true, id });
    }

    if (k === 'signoff') {
      const id = p.id || newId('so');
      await sql`
        INSERT INTO qa_signoffs
          (id, owner, title, project, environment, build_url, status, verified_date, notes)
        VALUES (
          ${id}, ${owner}, ${p.title || ''}, ${p.project || ''},
          ${p.environment || 'staging'}, ${p.buildUrl || ''},
          ${p.status || 'pending'}, ${p.verifiedDate || null}, ${p.notes || ''}
        )
        ON CONFLICT (id) DO NOTHING
      `;
      return NextResponse.json({ success: true, id });
    }
    return NextResponse.json({ error: 'unknown kind' }, { status: 400 });
  } catch (error) {
    console.error('qa-hub POST error:', error);
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
    // Backwards-compat: if no kind passed, assume run
    const k = kind || 'run';
    if (!owner || !id || !changes) return NextResponse.json({ error: 'owner, id, changes required' }, { status: 400 });
    const c = changes;

    if (k === 'run') {
      await sql`
        UPDATE qa_test_runs SET
          title         = COALESCE(${c.title ?? null}, title),
          project       = COALESCE(${c.project ?? null}, project),
          scope         = COALESCE(${c.scope ?? null}, scope),
          run_date      = COALESCE(${c.runDate ?? null}, run_date),
          result        = COALESCE(${c.result ?? null}, result),
          passed_count  = COALESCE(${c.passedCount !== undefined ? Number(c.passedCount) : null}, passed_count),
          failed_count  = COALESCE(${c.failedCount !== undefined ? Number(c.failedCount) : null}, failed_count),
          blocked_count = COALESCE(${c.blockedCount !== undefined ? Number(c.blockedCount) : null}, blocked_count),
          notes         = COALESCE(${c.notes ?? null}, notes),
          bug_ids       = COALESCE(${c.bugIds !== undefined ? JSON.stringify(c.bugIds) : null}::jsonb, bug_ids),
          updated_at    = CURRENT_TIMESTAMP
        WHERE id = ${id} AND owner = ${owner}
      `;
      return NextResponse.json({ success: true });
    }

    if (k === 'test_case') {
      await sql`
        UPDATE qa_test_cases SET
          project    = COALESCE(${c.project ?? null}, project),
          module     = COALESCE(${c.module ?? null}, module),
          title      = COALESCE(${c.title ?? null}, title),
          url        = COALESCE(${c.url ?? null}, url),
          notes      = COALESCE(${c.notes ?? null}, notes),
          tags       = COALESCE(${c.tags !== undefined ? JSON.stringify(c.tags) : null}::jsonb, tags),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id} AND owner = ${owner}
      `;
      return NextResponse.json({ success: true });
    }

    if (k === 'signoff') {
      await sql`
        UPDATE qa_signoffs SET
          title         = COALESCE(${c.title ?? null}, title),
          project       = COALESCE(${c.project ?? null}, project),
          environment   = COALESCE(${c.environment ?? null}, environment),
          build_url     = COALESCE(${c.buildUrl ?? null}, build_url),
          status        = COALESCE(${c.status ?? null}, status),
          verified_date = COALESCE(${c.verifiedDate ?? null}, verified_date),
          notes         = COALESCE(${c.notes ?? null}, notes),
          updated_at    = CURRENT_TIMESTAMP
        WHERE id = ${id} AND owner = ${owner}
      `;
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'unknown kind' }, { status: 400 });
  } catch (error) {
    console.error('qa-hub PUT error:', error);
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
    const k = kind || 'run';
    if (!owner || !id) return NextResponse.json({ error: 'owner and id required' }, { status: 400 });
    if (k === 'run')       { await sql`DELETE FROM qa_test_runs  WHERE id = ${id} AND owner = ${owner}`; return NextResponse.json({ success: true }); }
    if (k === 'test_case') { await sql`DELETE FROM qa_test_cases WHERE id = ${id} AND owner = ${owner}`; return NextResponse.json({ success: true }); }
    if (k === 'signoff')   { await sql`DELETE FROM qa_signoffs   WHERE id = ${id} AND owner = ${owner}`; return NextResponse.json({ success: true }); }
    return NextResponse.json({ error: 'unknown kind' }, { status: 400 });
  } catch (error) {
    console.error('qa-hub DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
