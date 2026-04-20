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

    // 3b. Create DESIGN_RESOURCES table (per-user design hub)
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
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_design_resources_owner ON design_resources(owner)`;

    // 3c. Create SALES_CUSTOMERS table (per-Sales-Manager customer pipeline)
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
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_sales_customers_owner ON sales_customers(owner)`;

    // 3d. Child tables for bug comments and activity log (split from JSONB to shrink bug row size)
    await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
    await sql`
      CREATE TABLE IF NOT EXISTS bug_comments (
        id TEXT PRIMARY KEY,
        bug_id TEXT NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
        author TEXT,
        body TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        raw JSONB DEFAULT '{}'::jsonb
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_bug_comments_bug_id ON bug_comments(bug_id, created_at)`;

    await sql`
      CREATE TABLE IF NOT EXISTS bug_activity_log (
        id BIGSERIAL PRIMARY KEY,
        bug_id TEXT NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
        action TEXT,
        field_key TEXT,
        from_value TEXT,
        to_value TEXT,
        entry_type TEXT,
        details JSONB,
        at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        raw JSONB DEFAULT '{}'::jsonb
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_bug_activity_bug_id ON bug_activity_log(bug_id, at DESC)`;

    // 3e. One-shot backfill from JSONB columns — guarded by row count so re-running is safe
    const commentCount = await sql`SELECT COUNT(*)::int AS n FROM bug_comments`;
    if (commentCount[0].n === 0) {
      await sql`
        INSERT INTO bug_comments (id, bug_id, author, body, created_at, raw)
        SELECT
          COALESCE(NULLIF(c->>'id', ''), gen_random_uuid()::text),
          b.id,
          c->>'author',
          COALESCE(c->>'body', c->>'text', c->>'content', ''),
          COALESCE(
            NULLIF(c->>'createdAt','')::timestamptz,
            NULLIF(c->>'date','')::timestamptz,
            CURRENT_TIMESTAMP
          ),
          c
        FROM bugs b, jsonb_array_elements(b.comments) c
        WHERE jsonb_typeof(b.comments) = 'array'
        ON CONFLICT (id) DO NOTHING
      `;
    }

    const activityCount = await sql`SELECT COUNT(*)::int AS n FROM bug_activity_log`;
    if (activityCount[0].n === 0) {
      await sql`
        INSERT INTO bug_activity_log (bug_id, action, field_key, from_value, to_value, entry_type, details, at, raw)
        SELECT
          b.id,
          a->>'action',
          a->>'fieldKey',
          a->>'from',
          a->>'to',
          a->>'type',
          CASE WHEN a ? 'details' THEN a->'details' ELSE NULL END,
          COALESCE(NULLIF(a->>'date','')::timestamptz, CURRENT_TIMESTAMP),
          a
        FROM bugs b, jsonb_array_elements(b.activity_log) a
        WHERE jsonb_typeof(b.activity_log) = 'array'
      `;
    }

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
