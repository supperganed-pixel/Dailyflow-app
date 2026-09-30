begin;

-- DailyFlow stores tasks and waiting items as validated JSON payloads in
-- flow_items. Keep these rules on that existing table; no parallel tasks table.
create index if not exists flow_items_focus_idx
  on public.flow_items (user_id, (payload->>'focusDate'))
  where payload->>'focusDate' is not null;
create index if not exists flow_items_related_task_idx
  on public.flow_items (user_id, (payload->>'relatedTaskId'))
  where payload->>'relatedTaskId' is not null;

create or replace function public.validate_dailyflow_phase_1_2()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare
  focus_date text := new.payload->>'focusDate';
  focus_order text := new.payload->>'focusOrder';
  dependency_id text;
  related_id text := new.payload->>'relatedTaskId';
  dependency_ids jsonb := case when jsonb_typeof(new.payload->'dependsOnIds') = 'array'
    then new.payload->'dependsOnIds' else '[]'::jsonb end;
begin
  if new.payload->>'id' is distinct from new.id::text then
    raise exception 'ITEM_ID_MISMATCH';
  end if;
  if new.payload ? 'priorityLevel' and coalesce(new.payload->>'priorityLevel', '') not in ('low', 'medium', 'high') then
    raise exception 'INVALID_PRIORITY_LEVEL';
  end if;
  if new.payload ? 'waitingState' and coalesce(new.payload->>'waitingState', '') not in ('waiting', 'responded', 'resolved', 'cancelled') then
    raise exception 'INVALID_WAITING_STATE';
  end if;
  perform (new.payload->>'completedAt')::timestamptz,
    (new.payload->>'archivedAt')::timestamptz,
    (new.payload->>'requestedAt')::timestamptz,
    (new.payload->>'expectedAt')::timestamptz,
    (new.payload->>'followUpAt')::timestamptz,
    (new.payload->>'lastFollowedUpAt')::timestamptz;

  if focus_date is not null then
    if new.payload->>'kind' <> 'task'
       or focus_date !~ '^\d{4}-\d{2}-\d{2}$'
       or to_char(to_date(focus_date, 'YYYY-MM-DD'), 'YYYY-MM-DD') <> focus_date
       or focus_order !~ '^[1-3]$' then
      raise exception 'INVALID_DAILY_FOCUS';
    end if;
    if (select count(*) from public.flow_items item
        where item.user_id = new.user_id and item.id <> new.id
          and item.payload->>'focusDate' = focus_date) >= 3 then
      raise exception 'DAILY_FOCUS_LIMIT_REACHED';
    end if;
    if exists(select 1 from public.flow_items item
        where item.user_id = new.user_id and item.id <> new.id
          and item.payload->>'focusDate' = focus_date
          and item.payload->>'focusOrder' = focus_order) then
      raise exception 'DAILY_FOCUS_ORDER_TAKEN';
    end if;
  elsif focus_order is not null then
    raise exception 'INVALID_DAILY_FOCUS';
  end if;

  if jsonb_typeof(new.payload->'dependsOnIds') not in ('array', 'null') then
    raise exception 'INVALID_TASK_DEPENDENCIES';
  end if;
  if jsonb_array_length(dependency_ids) > 25
     or (jsonb_array_length(dependency_ids) > 0 and new.payload->>'kind' <> 'task') then
    raise exception 'INVALID_TASK_DEPENDENCIES';
  end if;
  if (select count(*) from jsonb_array_elements_text(dependency_ids)) <>
     (select count(distinct value) from jsonb_array_elements_text(dependency_ids)) then
    raise exception 'DUPLICATE_TASK_DEPENDENCY';
  end if;
  for dependency_id in select value from jsonb_array_elements_text(dependency_ids) loop
    if dependency_id = new.id::text then
      raise exception 'TASK_CANNOT_DEPEND_ON_ITSELF';
    end if;
    if dependency_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or not exists(select 1 from public.flow_items item
          where item.user_id = new.user_id and item.id = dependency_id::uuid
            and item.payload->>'kind' = 'task'
            and item.payload->>'deletedAt' is null) then
      raise exception 'TASK_DEPENDENCY_NOT_FOUND_OR_NOT_OWNED';
    end if;
  end loop;
  if exists (
    with recursive path(id) as (
      select value from jsonb_array_elements_text(dependency_ids)
      union
      select next.value
      from path p
      join public.flow_items item on item.user_id = new.user_id
        and item.id::text = p.id
      cross join lateral jsonb_array_elements_text(
        case when jsonb_typeof(item.payload->'dependsOnIds') = 'array'
          then item.payload->'dependsOnIds' else '[]'::jsonb end
      ) next
    )
    select 1 from path where id = new.id::text
  ) then
    raise exception 'CIRCULAR_DEPENDENCY_NOT_ALLOWED';
  end if;

  if related_id is not null and (
    new.payload->>'status' <> 'waiting'
    or related_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or not exists(select 1 from public.flow_items item
      where item.user_id = new.user_id and item.id = related_id::uuid
        and item.payload->>'kind' = 'task'
        and item.payload->>'deletedAt' is null)
  ) then
    raise exception 'RELATED_TASK_NOT_FOUND_OR_NOT_OWNED';
  end if;

  if new.payload ? 'waitingHistory' and
     (jsonb_typeof(new.payload->'waitingHistory') <> 'array'
      or jsonb_array_length(new.payload->'waitingHistory') > 200) then
    raise exception 'INVALID_WAITING_HISTORY';
  end if;
  return new;
end;
$function$;

revoke all on function public.validate_dailyflow_phase_1_2() from public, anon, authenticated;
drop trigger if exists flow_items_validate_phase_1_2 on public.flow_items;
create trigger flow_items_validate_phase_1_2
before insert or update of payload on public.flow_items
for each row execute function public.validate_dailyflow_phase_1_2();

-- Read-only server answer for clients that need to verify the locally derived
-- blocked badge after a sync. Unknown or other-owner task IDs return false.
create or replace function public.is_task_blocked(p_task_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $function$
  select exists (
    select 1 from public.flow_items task
    where task.user_id = (select public.dailyflow_owner_id()) and task.id = p_task_id
  ) and (
    exists (
      select 1 from public.flow_items task
      join public.flow_items dependency on dependency.user_id = task.user_id
        and (task.payload->'dependsOnIds') ? dependency.id::text
      where task.user_id = (select public.dailyflow_owner_id()) and task.id = p_task_id
        and dependency.payload->>'deletedAt' is null
        and dependency.payload->>'status' not in ('completed', 'archived')
        and not (dependency.payload->>'status' = 'waiting'
          and dependency.payload->>'waitingState' in ('resolved', 'cancelled'))
    ) or exists (
      select 1 from public.flow_items waiting
      where waiting.user_id = (select public.dailyflow_owner_id())
        and waiting.payload->>'relatedTaskId' = p_task_id::text
        and waiting.payload->>'status' = 'waiting'
        and waiting.payload->>'deletedAt' is null
        and coalesce(waiting.payload->>'waitingState', 'waiting') not in ('resolved', 'cancelled')
    )
  );
$function$;
revoke all on function public.is_task_blocked(uuid) from public;
grant execute on function public.is_task_blocked(uuid) to anon, authenticated;

commit;
