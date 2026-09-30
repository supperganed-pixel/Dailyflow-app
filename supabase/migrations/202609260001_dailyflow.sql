begin;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '' check (char_length(display_name)<=80),
 deletion_pending boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update(display_name) on public.profiles to authenticated;
create policy profiles_select_own on public.profiles for select to authenticated using (id=(select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated using (id=(select auth.uid())) with check(id=(select auth.uid()));

create or replace function public.handle_dailyflow_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,display_name) values(new.id,left(coalesce(new.raw_user_meta_data->>'display_name',''),80)) on conflict(id) do nothing;
 return new;
end $$;
revoke all on function public.handle_dailyflow_user() from public,anon,authenticated;
create trigger dailyflow_user_created after insert on auth.users for each row execute function public.handle_dailyflow_user();
insert into public.profiles(id,display_name) select id,left(coalesce(raw_user_meta_data->>'display_name',''),80) from auth.users on conflict(id) do nothing;

create sequence if not exists public.flow_change_seq;
create table if not exists public.flow_items (
 user_id uuid not null references auth.users(id) on delete cascade,
 id uuid not null, payload jsonb not null, version integer not null check(version>0),
 change_seq bigint not null default nextval('public.flow_change_seq'),
 primary key(user_id,id), check(jsonb_typeof(payload)='object')
);
create index if not exists flow_items_sync_idx on public.flow_items(user_id,change_seq);
alter table public.flow_items enable row level security;
revoke all on public.flow_items from anon, authenticated;
grant select on public.flow_items to authenticated;
create policy flow_items_select_own on public.flow_items for select to authenticated using(user_id=(select auth.uid()));

-- All writes use this narrow RPC: explicit identity checks remain necessary
-- even though it is SECURITY DEFINER. No client-supplied user_id is trusted.
create or replace function public.sync_flow_items(changes jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); item jsonb; previous public.flow_items%rowtype; item_id uuid; next_version integer; conflicts jsonb:='[]'; result jsonb; supplied_version integer;
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if exists(select 1 from public.profiles where id=uid and deletion_pending) then raise exception 'Account deletion in progress' using errcode='42501'; end if;
 if jsonb_typeof(changes) is distinct from 'array' or jsonb_array_length(changes)>500 then raise exception 'Invalid batch'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if (select count(*) from jsonb_array_elements(changes)) <> (select count(distinct value->>'id') from jsonb_array_elements(changes)) then raise exception 'Duplicate item IDs'; end if;
 for item in select value from jsonb_array_elements(changes) loop
  if not coalesce(jsonb_typeof(item)='object'
   and item ?& array['id','title','kind','status','priority','notes','person','source','sourceText','url','dueAt','snoozedUntil','createdAt','updatedAt','deletedAt','version']
   and jsonb_typeof(item->'title')='string' and char_length(trim(item->>'title')) between 1 and 240
   and item->>'kind' in ('task','note','link') and item->>'status' in ('inbox','active','waiting','completed','archived')
   and item->>'priority' in ('normal','important') and item->>'source' in ('capture','share','import')
   and jsonb_typeof(item->'notes')='string' and char_length(item->>'notes')<=20000
   and jsonb_typeof(item->'person')='string' and char_length(item->>'person')<=120
   and jsonb_typeof(item->'sourceText')='string' and char_length(item->>'sourceText')<=20000
   and jsonb_typeof(item->'url')='string' and char_length(item->>'url')<=2048 and ((item->>'url')='' or (item->>'url')~*'^https?://')
   and jsonb_typeof(item->'version')='number'
   and (item->>'createdAt')~'^\d{4}-\d{2}-\d{2}T' and (item->>'updatedAt')~'^\d{4}-\d{2}-\d{2}T',false)
  then raise exception 'Invalid item'; end if;
  item_id:=(item->>'id')::uuid; supplied_version:=(item->>'version')::integer;
  if supplied_version<0 then raise exception 'Invalid version'; end if;
  perform (item->>'createdAt')::timestamptz,(item->>'updatedAt')::timestamptz;
  perform (item->>'dueAt')::timestamptz,(item->>'snoozedUntil')::timestamptz,(item->>'deletedAt')::timestamptz;
  select * into previous from public.flow_items where user_id=uid and id=item_id;
  if found then
   if previous.version<>supplied_version then
    if (previous.payload-'version')=(item-'version') then continue; end if;
    conflicts:=conflicts||jsonb_build_array(item_id); continue;
   end if;
   next_version:=previous.version+1;
  else
   if supplied_version<>0 then conflicts:=conflicts||jsonb_build_array(item_id); continue; end if;
   if (select count(*) from public.flow_items where user_id=uid)>=10000 then raise exception 'Account item limit reached'; end if;
   next_version:=1;
  end if;
  insert into public.flow_items(user_id,id,payload,version) values(uid,item_id,item||jsonb_build_object('version',next_version),next_version)
   on conflict(user_id,id) do update set payload=excluded.payload,version=excluded.version,change_seq=nextval('public.flow_change_seq');
 end loop;
 select coalesce(jsonb_agg(payload||jsonb_build_object('version',version)),'[]'::jsonb) into result from public.flow_items where user_id=uid and id in (select (value->>'id')::uuid from jsonb_array_elements(changes));
 return jsonb_build_object('items',result,'conflicts',conflicts);
end $$;
revoke all on function public.sync_flow_items(jsonb) from public,anon;
grant execute on function public.sync_flow_items(jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('dailyflow-files','dailyflow-files',false,20971520,array['image/jpeg','image/png','image/webp','application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy dailyflow_files_select on storage.objects for select to authenticated
 using(bucket_id='dailyflow-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy dailyflow_files_insert on storage.objects for insert to authenticated
 with check(bucket_id='dailyflow-files' and array_length(storage.foldername(name),1)=1 and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.profiles where id=(select auth.uid()) and not deletion_pending));
create policy dailyflow_files_delete on storage.objects for delete to authenticated
 using(bucket_id='dailyflow-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
-- No UPDATE policy: files are immutable, preventing upsert/overwrite surprises.
commit;
