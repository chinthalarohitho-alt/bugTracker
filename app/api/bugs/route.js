import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';

const getSQL = () => {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return neon(url);
};

function transformBugRow(row) {
  if (!row) return null;
  const parseArray = (val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && val.startsWith('[')) {
      try { return JSON.parse(val); } catch { return []; }
    }
    return val ? [val] : [];
  };
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    stepsToReproduce: row.steps_to_reproduce || '',
    expectedResult: row.expected_result || '',
    actualResult: row.actual_result || '',
    status: row.status,
    priority: row.priority,
    severity: row.severity,
    reporter: row.reporter,
    assignee: row.assignee,
    project: row.project,
    module: row.module || 'General',
    startDate: row.start_date || '',
    endDate: row.end_date || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activityLog: row.activity_log || [],
    comments: row.comments || [],
    curl: parseArray(row.curl),
    githubPr: parseArray(row.github_pr),
    relatedBugs: parseArray(row.related_bugs),
    metadata: row.metadata || {}
  };
}

function getChangeLogs(oldBug, newBug) {
  const logs = [];
  const timestamp = new Date().toISOString();
  const actor = newBug.updatedBy || newBug.reporter || 'System';
  const fieldsToTrack = [
    { key: 'status', label: 'Status' },
    { key: 'assignee', label: 'Assignee' },
    { key: 'priority', label: 'Priority' },
    { key: 'severity', label: 'Severity' },
    { key: 'project', label: 'Project' },
    { key: 'title', label: 'Title' },
    { key: 'module', label: 'Module' },
    { key: 'startDate', label: 'Start Date' },
    { key: 'endDate', label: 'End Date' },
    { key: 'description', label: 'Description' },
    { key: 'stepsToReproduce', label: 'Steps to Reproduce' },
    { key: 'expectedResult', label: 'Expected Result' },
    { key: 'actualResult', label: 'Actual Result' },
    { key: 'curl', label: 'Technical Context', isTechnical: true, type: 'curl' },
    { key: 'githubPr', label: 'GitHub PR', isTechnical: true },
    { key: 'relatedBugs', label: 'Related Bugs', isTechnical: true }
  ];
  fieldsToTrack.forEach(field => {
    if (newBug[field.key] === undefined) return;
    const oldValue = oldBug[field.key];
    const newValue = newBug[field.key];
    const isDifferent = field.isTechnical 
      ? JSON.stringify(oldValue || []) !== JSON.stringify(newValue || [])
      : (oldValue || '') !== (newValue || '');
    if (isDifferent) {
      const logEntry = {
        date: timestamp,
        action: `${field.label} updated by ${actor}`,
        fieldKey: field.key,
        from: field.isTechnical ? '—' : (oldValue || '—'),
        to: field.isTechnical ? '—' : (newValue || '—')
      };
      if (field.type === 'curl') {
        logEntry.type = 'curl';
        logEntry.details = Array.isArray(newValue) ? newValue[newValue.length - 1] : newValue;
      }
      logs.push(logEntry);
    }
  });
  return logs;
}

export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  const sql = getSQL();
  if (!sql) return NextResponse.json({ success: true, bugs: [] });
  try {
    const rows = await sql`SELECT * FROM bugs ORDER BY created_at DESC`;
    return NextResponse.json({ success: true, bugs: rows.map(transformBugRow) });
  } catch (error) {
    console.error('Bugs API GET Error:', error);
    return NextResponse.json({ error: 'Failed to load database', details: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  const sql = getSQL();
  if (!sql) return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 503 });
  try {
    const newBug = await request.json();
    const timestamp = new Date().toISOString();
    const maxRows = await sql`SELECT id FROM bugs WHERE id LIKE 'BUG-%'`;
    let nextIdNum = 1;
    if (maxRows.length > 0) {
      const numbers = maxRows.map(r => {
        const m = r.id.match(/\d+/);
        return m ? parseInt(m[0]) : 0;
      });
      nextIdNum = Math.max(...numbers) + 1;
    }
    const bugId = 'BUG-' + nextIdNum;
    const initialLog = [{ date: timestamp, action: 'Bug reported by ' + (newBug.reporter || 'System') }];
    const result = await sql`
      INSERT INTO bugs (
        id, title, description, status, priority, severity, 
        reporter, assignee, project, module, start_date, end_date, 
        steps_to_reproduce, expected_result, actual_result, 
        curl, github_pr, related_bugs,
        created_at, updated_at, activity_log, comments
      ) VALUES (
        ${bugId}, ${newBug.title}, ${newBug.description}, ${newBug.status || 'Open'}, 
        ${newBug.priority || 'Medium'}, ${newBug.severity || 'Medium'}, 
        ${newBug.reporter || 'System'}, ${newBug.assignee || 'Unassigned'}, 
        ${newBug.project || 'General'}, ${newBug.module || 'General'}, 
        ${newBug.startDate || ''}, ${newBug.endDate || ''}, 
        ${newBug.stepsToReproduce || ''}, ${newBug.expectedResult || ''}, ${newBug.actualResult || ''},
        ${JSON.stringify(newBug.curl || [])}, ${JSON.stringify(newBug.githubPr || [])}, ${JSON.stringify(newBug.relatedBugs || [])},
        ${timestamp}, ${timestamp}, 
        ${JSON.stringify(initialLog)}, ${JSON.stringify([])}
      ) RETURNING *
    `;
    return NextResponse.json({ success: true, bug: transformBugRow(result[0]) });
  } catch (error) {
    console.error('Bugs API POST Error:', error);
    return NextResponse.json({ error: 'Failed to create bug', details: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  const sql = getSQL();
  if (!sql) return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 503 });
  try {
    const updatedBugPayload = await request.json();
    const timestamp = new Date().toISOString();
    const currentRows = await sql`SELECT * FROM bugs WHERE id = ${updatedBugPayload.id}`;
    if (currentRows.length === 0) return NextResponse.json({ error: 'Bug not found' }, { status: 404 });
    const oldBug = transformBugRow(currentRows[0]);
    const mergedBug = { ...oldBug, ...updatedBugPayload };
    const finalLogs = [...(oldBug.activityLog || []), ...getChangeLogs(oldBug, updatedBugPayload)];
    const result = await sql`
      UPDATE bugs SET
        title = ${mergedBug.title},
        description = ${mergedBug.description},
        status = ${mergedBug.status},
        priority = ${mergedBug.priority},
        severity = ${mergedBug.severity},
        assignee = ${mergedBug.assignee},
        project = ${mergedBug.project},
        module = ${mergedBug.module || 'General'},
        start_date = ${mergedBug.startDate || ''},
        end_date = ${mergedBug.endDate || ''},
        steps_to_reproduce = ${mergedBug.stepsToReproduce || ''},
        expected_result = ${mergedBug.expectedResult || ''},
        actual_result = ${mergedBug.actualResult || ''},
        curl = ${JSON.stringify(mergedBug.curl || [])},
        github_pr = ${JSON.stringify(mergedBug.githubPr || [])},
        related_bugs = ${JSON.stringify(mergedBug.relatedBugs || [])},
        updated_at = ${timestamp},
        activity_log = ${JSON.stringify(finalLogs)},
        comments = ${typeof mergedBug.comments === 'string' ? mergedBug.comments : JSON.stringify(mergedBug.comments || [])}
      WHERE id = ${mergedBug.id}
      RETURNING *
    `;
    return NextResponse.json({ success: true, bug: transformBugRow(result[0]) });
  } catch (error) {
    console.error('Bugs API PUT Error:', error);
    return NextResponse.json({ error: 'Failed to update bug', details: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  const sql = getSQL();
  if (!sql) return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 503 });
  try {
    const { id, ids } = await request.json();
    const targetIds = Array.isArray(ids) ? ids : (id ? [id] : []);
    if (targetIds.length === 0) return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
    await sql`DELETE FROM bugs WHERE id = ANY(${targetIds})`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Bugs API DELETE Error:', error);
    return NextResponse.json({ error: 'Failed to delete', details: error.message }, { status: 500 });
  }
}