import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';

const getSQL = () => {
  if (!process.env.DATABASE_URL) return null;
  return neon(process.env.DATABASE_URL);
};

export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  const sql = getSQL();
  if (!sql) return NextResponse.json({ projects: [], statuses: [], priorities: [], assignees: [] });
  try {
    const rows = await sql`SELECT data FROM settings WHERE id = 1`;
    if (rows.length === 0) return NextResponse.json({ error: "Settings not found" }, { status: 404 });
    return NextResponse.json(rows[0].data);
  } catch (error) {
    console.error('Neon Settings GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  const sql = getSQL();
  if (!sql) return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 503 });
  try {
    const newData = await request.json();
    await sql`UPDATE settings SET data = ${JSON.stringify(newData)} WHERE id = 1`;
    return NextResponse.json({ success: true, data: newData });
  } catch (error) {
    console.error('Neon Settings PUT Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
