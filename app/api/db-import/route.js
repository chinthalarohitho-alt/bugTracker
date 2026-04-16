import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
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
    const seedPath = path.join(process.cwd(), 'database', 'bugs_seed.json');
    const seedData = await fs.readFile(seedPath, 'utf8');
    const { bugs, settings } = JSON.parse(seedData);

    const report = { bugs: 0, settings: false, notifications: 0 };

    // 1. Import Settings
    if (settings) {
      await sql`
        INSERT INTO settings (id, data) 
        VALUES (1, ${JSON.stringify(settings)})
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
      `;
      report.settings = true;
    }

    // 2. Import Bugs
    for (const bug of bugs) {
      const bid = bug.id || `BUG-${report.bugs + 1}`;
      const createdAt = bug.createdAt || new Date().toISOString();
      const updatedAt = bug.updatedAt || new Date().toISOString();

      const parseField = (val) => {
        if (Array.isArray(val)) return val;
        if (typeof val === 'string' && val.startsWith('[')) {
          try { return JSON.parse(val); } catch { return []; }
        }
        return val ? [val] : [];
      };

      await sql`
        INSERT INTO bugs (
          id, title, description, status, priority, severity, 
          reporter, assignee, project, module, start_date, end_date,
          steps_to_reproduce, expected_result, actual_result,
          curl, github_pr, related_bugs,
          created_at, updated_at, activity_log, comments
        ) VALUES (
          ${bid}, ${bug.title || 'Untitled'}, ${bug.description || ''}, 
          ${bug.status || 'Open'}, ${bug.priority || 'Medium'}, ${bug.severity || 'Medium'}, 
          ${bug.reporter || 'System'}, ${bug.assignee || 'Unassigned'}, 
          ${bug.project || 'General'}, ${bug.module || 'General'},
          ${bug.startDate || ''}, ${bug.endDate || ''},
          ${bug.stepsToReproduce || ''}, ${bug.expectedResult || ''}, ${bug.actualResult || ''},
          ${JSON.stringify(parseField(bug.curl))}, ${JSON.stringify(parseField(bug.githubPr))}, ${JSON.stringify(parseField(bug.relatedBugs))},
          ${createdAt}, ${updatedAt}, 
          ${JSON.stringify(bug.activityLog || [])}, ${JSON.stringify(bug.comments || [])}
        ) ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          status = EXCLUDED.status,
          priority = EXCLUDED.priority,
          severity = EXCLUDED.severity,
          module = EXCLUDED.module,
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          steps_to_reproduce = EXCLUDED.steps_to_reproduce,
          expected_result = EXCLUDED.expected_result,
          actual_result = EXCLUDED.actual_result,
          curl = EXCLUDED.curl,
          github_pr = EXCLUDED.github_pr,
          related_bugs = EXCLUDED.related_bugs,
          updated_at = EXCLUDED.updated_at,
          activity_log = EXCLUDED.activity_log,
          comments = EXCLUDED.comments
      `;
      report.bugs++;
    }

    return NextResponse.json({
      success: true,
      message: "Data migration from seed JSON complete.",
      report
    });
  } catch (error) {
    console.error('Import Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
