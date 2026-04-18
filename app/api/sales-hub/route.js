import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';

const getSQL = () => {
  if (!process.env.DATABASE_URL) return null;
  return neon(process.env.DATABASE_URL);
};

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS sales_customers (
      id TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      name TEXT NOT NULL,
      contact_person TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      city TEXT DEFAULT '',
      state TEXT DEFAULT '',
      stage TEXT DEFAULT 'lead',
      product TEXT DEFAULT '',
      estimated_value NUMERIC DEFAULT 0,
      last_contact_at TIMESTAMP WITH TIME ZONE,
      next_follow_up_at TIMESTAMP WITH TIME ZONE,
      notes TEXT DEFAULT '',
      tags JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_sales_customers_owner ON sales_customers(owner)`;
}

function mapRow(row) {
  return {
    id: row.id,
    name: row.name,
    contactPerson: row.contact_person || '',
    phone: row.phone || '',
    email: row.email || '',
    city: row.city || '',
    state: row.state || '',
    stage: row.stage || 'lead',
    product: row.product || '',
    estimatedValue: Number(row.estimated_value) || 0,
    lastContactAt: row.last_contact_at,
    nextFollowUpAt: row.next_follow_up_at,
    notes: row.notes || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function newId() {
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  const sql = getSQL();
  if (!sql) return NextResponse.json({ success: true, customers: [] });
  try {
    await ensureTable(sql);
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');
    if (!owner) return NextResponse.json({ success: true, customers: [] });

    const rows = await sql`
      SELECT * FROM sales_customers
      WHERE owner = ${owner}
      ORDER BY updated_at DESC, created_at DESC
    `;
    return NextResponse.json({ success: true, customers: rows.map(mapRow) });
  } catch (error) {
    console.error('sales-hub GET error:', error);
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
    const { owner, customer } = await request.json();
    if (!owner || !customer) {
      return NextResponse.json({ error: 'owner and customer required' }, { status: 400 });
    }
    const id = customer.id || newId();
    await sql`
      INSERT INTO sales_customers
        (id, owner, name, contact_person, phone, email, city, state, stage,
         product, estimated_value, last_contact_at, next_follow_up_at, notes, tags, created_at)
      VALUES (
        ${id}, ${owner}, ${customer.name || ''}, ${customer.contactPerson || ''},
        ${customer.phone || ''}, ${customer.email || ''}, ${customer.city || ''},
        ${customer.state || ''}, ${customer.stage || 'lead'}, ${customer.product || ''},
        ${Number(customer.estimatedValue) || 0},
        ${customer.lastContactAt || null}, ${customer.nextFollowUpAt || null},
        ${customer.notes || ''}, ${JSON.stringify(customer.tags || [])}::jsonb,
        ${customer.createdAt || new Date().toISOString()}
      )
      ON CONFLICT (id) DO NOTHING
    `;
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('sales-hub POST error:', error);
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
      UPDATE sales_customers SET
        name              = COALESCE(${c.name ?? null}, name),
        contact_person    = COALESCE(${c.contactPerson ?? null}, contact_person),
        phone             = COALESCE(${c.phone ?? null}, phone),
        email             = COALESCE(${c.email ?? null}, email),
        city              = COALESCE(${c.city ?? null}, city),
        state             = COALESCE(${c.state ?? null}, state),
        stage             = COALESCE(${c.stage ?? null}, stage),
        product           = COALESCE(${c.product ?? null}, product),
        estimated_value   = COALESCE(${c.estimatedValue !== undefined ? Number(c.estimatedValue) : null}, estimated_value),
        last_contact_at   = COALESCE(${c.lastContactAt ?? null}, last_contact_at),
        next_follow_up_at = COALESCE(${c.nextFollowUpAt ?? null}, next_follow_up_at),
        notes             = COALESCE(${c.notes ?? null}, notes),
        tags              = COALESCE(${c.tags !== undefined ? JSON.stringify(c.tags) : null}::jsonb, tags),
        updated_at        = CURRENT_TIMESTAMP
      WHERE id = ${id} AND owner = ${owner}
    `;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('sales-hub PUT error:', error);
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
    await sql`DELETE FROM sales_customers WHERE id = ${id} AND owner = ${owner}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('sales-hub DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
