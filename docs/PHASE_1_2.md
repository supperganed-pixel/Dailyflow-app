# DailyFlow Focus and follow-ups

DailyFlow uses Firebase for login and Supabase `public.flow_items` for private task data. The pasted example for `public.tasks` and `auth.uid()` does not match this project. The new migration adds guards to the existing `flow_items` table and uses the existing Firebase-aware owner resolver and RLS policies.

## Deploy

Apply `supabase/migrations/20260930_dailyflow_phase_1_2.sql` **after** both existing DailyFlow migrations. It adds Focus and related-task indexes, a trigger that enforces three Focus tasks per date and rejects invalid or circular dependencies, and a read-only `is_task_blocked(uuid)` RPC. No existing task table is replaced or copied.

The trigger applies to every inserted or updated payload, including writes made through `sync_flow_items`. Existing rows without the new optional fields remain valid. Keep the deployed trigger in place before publishing a client build with these controls.

## App behavior

- Today shows the local-time greeting, due and overdue counts, Focus Today, follow-ups, priority reasons, upcoming tasks, and an end-of-day review.
- Focus is limited to three active tasks. Completing a Focus task keeps it in today's review; archiving removes it from Focus. Concurrent edits from another device are rejected by the database and remain pending locally for correction.
- Waiting items can be linked to a task, given expected and follow-up dates, marked followed up or responded, resolved, cancelled, or postponed. Their action history stays on the item. The Waiting page shows open items; resolved and cancelled items appear in History.
- Task details can add up to 25 dependencies. The app rejects self or circular links, and the database also enforces ownership and cycle checks. The blocked badge is calculated from the current tasks and waiting items so it clears when the blocker is completed or resolved.
- End-of-day review suggests moving unfinished tasks to tomorrow at 9 AM. It changes a task only after the user presses **Move to tomorrow**.
- Existing backups and older synchronized items continue to load because the new payload fields are optional. Imported copies remap internal task links and clear old Focus assignments.

## Checks

`node --test scripts/dailyflow-migration.test.cjs` exercises the migration in local PostgreSQL. `pnpm test:core` covers priority, blocked state, follow-up dates, history, and review calculations. The migration was applied to the live DailyFlow Supabase project as `20260930184232_dailyflow_phase_1_2`; the trigger, blocked-state RPC, indexes and existing RLS were confirmed afterward.
