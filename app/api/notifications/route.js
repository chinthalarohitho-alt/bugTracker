import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';

const getSQL = () => {
  if (!process.env.DATABASE_URL) return null;
  return neon(process.env.DATABASE_URL);
};

/**
 * Maps database snake_case fields to UI camelCase fields
 */
function mapNotificationRow(row) {
  return {
    id: row.id,
    targetUser: row.target_user,
    actor: row.actor,
    bugId: row.bug_id,
    message: row.message,
    date: row.created_at,
    isRead: row.is_read
  };
}

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  const sql = getSQL();
  if (!sql) return NextResponse.json({ success: true, notifications: [] });
  try {
    const { searchParams } = new URL(request.url);
    const user = searchParams.get('user');
    
    if (!user) return NextResponse.json({ success: true, notifications: [] });

    const rows = await sql`
      SELECT * FROM notifications 
      WHERE target_user = ${user} 
      ORDER BY created_at DESC 
      LIMIT 20
    `;
    return NextResponse.json({ success: true, notifications: rows.map(mapNotificationRow) });
  } catch (error) {
    console.error('Neon Notification GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  const sql = getSQL();
  if (!sql) return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 503 });
  try {
    const { target_user, actor, bug_id, message } = await request.json();
    await sql`
      INSERT INTO notifications (target_user, actor, bug_id, message)
      VALUES (${target_user}, ${actor}, ${bug_id}, ${message})
    `;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Neon Notification POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  const sql = getSQL();
  if (!sql) return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 503 });
  try {
    const payload = await request.json();
    
    // Support either single notification ID or bulk for a user
    if (payload.allForUser) {
      await sql`UPDATE notifications SET is_read = TRUE WHERE target_user = ${payload.allForUser} AND is_read = FALSE`;
    } else if (payload.id) {
      await sql`UPDATE notifications SET is_read = TRUE WHERE id = ${payload.id}`;
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Neon Notification PATCH Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
