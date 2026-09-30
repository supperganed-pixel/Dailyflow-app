const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const ownerA = '11111111-1111-4111-8111-111111111111';
const ownerB = '22222222-2222-4222-8222-222222222222';
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('database enforces Focus, dependency ownership, cycles and blocked state', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create table public.flow_items (
        user_id uuid not null, id uuid not null, payload jsonb not null,
        primary key (user_id, id)
      );
      create function public.dailyflow_owner_id() returns uuid language sql stable as $$
        select current_setting('app.user_id', true)::uuid
      $$;
    `);
    await db.exec(readFileSync(join(__dirname, '../supabase/migrations/20260930_dailyflow_phase_1_2.sql'), 'utf8'));
    async function save(owner, item) {
      await db.query(`insert into public.flow_items(user_id,id,payload) values($1,$2,$3::jsonb)
        on conflict(user_id,id) do update set payload=excluded.payload`, [owner, item.id, JSON.stringify(item)]);
    }
    const task = (n, patch = {}) => ({ id: id(n), kind: 'task', status: 'active', deletedAt: null, ...patch });
    for (let n = 1; n <= 3; n++)
      await save(ownerA, task(n, { focusDate: '2026-09-30', focusOrder: n }));
    await assert.rejects(save(ownerA, task(4, { focusDate: '2026-09-30', focusOrder: 1 })), /DAILY_FOCUS_LIMIT_REACHED/);
    await save(ownerA, task(4));
    await assert.rejects(save(ownerA, task(4, { focusDate: '2026-10-01', focusOrder: 4 })), /INVALID_DAILY_FOCUS/);
    await save(ownerB, task(5));
    await assert.rejects(save(ownerA, task(4, { dependsOnIds: [id(5)] })), /TASK_DEPENDENCY_NOT_FOUND_OR_NOT_OWNED/);
    await save(ownerA, task(4, { dependsOnIds: [id(1)] }));
    await assert.rejects(save(ownerA, task(1, { focusDate: '2026-09-30', focusOrder: 1, dependsOnIds: [id(4)] })), /CIRCULAR_DEPENDENCY_NOT_ALLOWED/);

    await db.exec(`set app.user_id = '${ownerA}'`);
    let blocked = await db.query('select public.is_task_blocked($1) as blocked', [id(4)]);
    assert.equal(blocked.rows[0].blocked, true);
    await save(ownerA, task(1, { focusDate: '2026-09-30', focusOrder: 1, status: 'completed' }));
    blocked = await db.query('select public.is_task_blocked($1) as blocked', [id(4)]);
    assert.equal(blocked.rows[0].blocked, false);
    await save(ownerA, { id: id(6), kind: 'task', status: 'waiting', deletedAt: null, relatedTaskId: id(4) });
    blocked = await db.query('select public.is_task_blocked($1) as blocked', [id(4)]);
    assert.equal(blocked.rows[0].blocked, true);
    await save(ownerA, { id: id(6), kind: 'task', status: 'waiting', deletedAt: null, relatedTaskId: id(4), waitingState: 'resolved' });
    blocked = await db.query('select public.is_task_blocked($1) as blocked', [id(4)]);
    assert.equal(blocked.rows[0].blocked, false);
    await db.exec(`set app.user_id = '${ownerB}'`);
    blocked = await db.query('select public.is_task_blocked($1) as blocked', [id(4)]);
    assert.equal(blocked.rows[0].blocked, false);
  } finally {
    await db.close();
  }
});
