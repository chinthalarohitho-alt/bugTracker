import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';

const getSQL = () => {
  if (!process.env.DATABASE_URL) return null;
  return neon(process.env.DATABASE_URL);
};

export async function GET() {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  const sql = getSQL();
  if (!sql) return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 503 });
  try {
    // 1. Create BUGS table with full production schema
    await sql`
      CREATE TABLE IF NOT EXISTS bugs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'Open',
        priority TEXT DEFAULT 'Medium',
        severity TEXT DEFAULT 'Medium',
        reporter TEXT,
        assignee TEXT DEFAULT 'Unassigned',
        project TEXT DEFAULT 'General',
        module TEXT DEFAULT 'General',
        steps_to_reproduce TEXT,
        expected_result TEXT,
        actual_result TEXT,
        curl JSONB DEFAULT '[]'::jsonb,
        github_pr JSONB DEFAULT '[]'::jsonb,
        related_bugs JSONB DEFAULT '[]'::jsonb,
        start_date TEXT,
        end_date TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        activity_log JSONB DEFAULT '[]'::jsonb,
        comments JSONB DEFAULT '[]'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb
      );
    `;

    // 2. Create NOTIFICATIONS table
    await sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        target_user TEXT NOT NULL,
        actor TEXT,
        bug_id TEXT,
        message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        is_read BOOLEAN DEFAULT FALSE
      );
    `;

    // 3. Create SETTINGS table
    await sql`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY,
        data JSONB NOT NULL
      );
    `;

    // 4. Migration: Ensure missing columns exist in existing tables
    const migrations = [
      `ALTER TABLE bugs ADD COLUMN IF NOT EXISTS module TEXT DEFAULT 'General'`,
      `ALTER TABLE bugs ADD COLUMN IF NOT EXISTS start_date TEXT`,
      `ALTER TABLE bugs ADD COLUMN IF NOT EXISTS end_date TEXT`,
      `ALTER TABLE bugs ADD COLUMN IF NOT EXISTS steps_to_reproduce TEXT`,
      `ALTER TABLE bugs ADD COLUMN IF NOT EXISTS expected_result TEXT`,
      `ALTER TABLE bugs ADD COLUMN IF NOT EXISTS actual_result TEXT`,
      `ALTER TABLE bugs ADD COLUMN IF NOT EXISTS curl JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE bugs ADD COLUMN IF NOT EXISTS github_pr JSONB DEFAULT '[]'::jsonb`,
      `ALTER TABLE bugs ADD COLUMN IF NOT EXISTS related_bugs JSONB DEFAULT '[]'::jsonb`
    ];

    for (const query of migrations) {
      try { await sql([query]); } catch (e) { console.warn('Migration skipped:', query, e.message); }
    }

    // 5. Initialize Settings if empty
    const settingsCheck = await sql`SELECT * FROM settings WHERE id = 1`;
    if (settingsCheck.length === 0) {
      const defaultSettings = {
        assignees: ["Unassigned", "Rohith", "Tapza Admin", "Engineering Team"],
        statuses: ["Open", "In Progress", "Code Review", "UAT", "Resolved", "Closed", "ReOpen"],
        priorities: ["Critical", "High", "Medium", "Low"],
        projects: ["Pharmacy ERP", "Logistics Suite", "Inventory Pro", "General"],
        severities: ["Blocker", "Critical", "Major", "Minor", "Trivial"]
      };
      await sql`
        INSERT INTO settings (id, data) 
        VALUES (1, ${JSON.stringify(defaultSettings)})
      `;
    }

    return NextResponse.json({
      success: true,
      message: "Database tables initialized successfully. Multi-field schema is ready."
    });
  } catch (error) {
    console.error('Database Init Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
