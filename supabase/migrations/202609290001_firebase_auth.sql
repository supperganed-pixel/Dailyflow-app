begin;
-- Preserve legacy Auth deletion cascades while allowing Firebase-owned profiles.
alter table public.profiles add column legacy_auth_user_id uuid references auth.users(id) on delete cascade;
update public.profiles set legacy_auth_user_id=id;
alter table public.profiles drop constraint profiles_id_fkey;
alter table public.profiles add column firebase_uid text unique check(char_length(firebase_uid) between 1 and 128);
alter table public.flow_items drop constraint flow_items_user_id_fkey;
alter table public.flow_items add constraint flow_items_user_id_fkey foreign key(user_id) references public.profiles(id) on delete cascade;
create or replace function public.handle_dailyflow_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,legacy_auth_user_id,display_name) values(new.id,new.id,left(coalesce(new.raw_user_meta_data->>'display_name',''),80)) on conflict(id) do nothing;
 return new;
end $$;

-- Claims reach SQL only after Supabase validates the JWT signature and expiry.
-- Firebase has no Postgres role claim on Spark: strict identity checks also apply
-- to the anon database role. A public API key alone never satisfies these checks.
create function public.dailyflow_firebase_uid() returns text language sql stable set search_path='' as $$
 select case when auth.jwt()->>'iss'='https://securetoken.google.com/dailyflow-6bd65'
 and auth.jwt()->>'aud'='dailyflow-6bd65'
 and auth.jwt()->>'email_verified'='true'
 and char_length(auth.jwt()->>'sub') between 1 and 128
 then auth.jwt()->>'sub' end;
$$;
create function public.dailyflow_owner_id() returns uuid language sql stable security definer set search_path='' as $$
 select id from public.profiles where not deletion_pending and (
 firebase_uid=public.dailyflow_firebase_uid()
 or (auth.jwt()->>'iss'='https://ixfcyvjrkecwtdknzwul.supabase.co/auth/v1'
 and legacy_auth_user_id::text=auth.jwt()->>'sub')) limit 1;
$$;
create function public.ensure_firebase_profile(display_name text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare fid text:=public.dailyflow_firebase_uid(); owner_id uuid; closing boolean;
begin
 if fid is null then raise exception 'Verified Firebase authentication required' using errcode='42501'; end if;
 if display_name is null or char_length(display_name)>80 then raise exception 'Invalid display name'; end if;
 perform pg_advisory_xact_lock(hashtextextended('firebase:'||fid,0));
 select id,deletion_pending into owner_id,closing from public.profiles where firebase_uid=fid;
 -- Return the owner for deletion retries; RLS denies a closing workspace.
 if closing then return owner_id; end if;
 if owner_id is null then
  owner_id:=gen_random_uuid();
  insert into public.profiles(id,firebase_uid,display_name) values(owner_id,fid,trim(display_name));
 end if;
 return owner_id;
end $$;
revoke all on function public.dailyflow_firebase_uid(),public.dailyflow_owner_id(),public.ensure_firebase_profile(text) from public;
grant execute on function public.dailyflow_firebase_uid(),public.dailyflow_owner_id(),public.ensure_firebase_profile(text) to anon,authenticated;
revoke select on public.profiles from anon,authenticated;
grant select(id,display_name,created_at,deletion_pending) on public.profiles to anon,authenticated;
grant update(display_name) on public.profiles to anon,authenticated;
grant select on public.flow_items to anon;
drop policy profiles_select_own on public.profiles;
drop policy profiles_update_own on public.profiles;
drop policy flow_items_select_own on public.flow_items;
create policy profiles_select_own on public.profiles for select to anon,authenticated using(id=(select public.dailyflow_owner_id()));
create policy profiles_update_own on public.profiles for update to anon,authenticated using(id=(select public.dailyflow_owner_id())) with check(id=(select public.dailyflow_owner_id()));
create policy flow_items_select_own on public.flow_items for select to anon,authenticated using(user_id=(select public.dailyflow_owner_id()));
drop policy dailyflow_files_select on storage.objects;
drop policy dailyflow_files_insert on storage.objects;
drop policy dailyflow_files_delete on storage.objects;
create policy dailyflow_files_select on storage.objects for select to anon,authenticated
 using(bucket_id='dailyflow-files' and (storage.foldername(name))[1]=(select public.dailyflow_owner_id())::text);
create policy dailyflow_files_insert on storage.objects for insert to anon,authenticated
 with check(bucket_id='dailyflow-files' and array_length(storage.foldername(name),1)=1 and (storage.foldername(name))[1]=(select public.dailyflow_owner_id())::text);
create policy dailyflow_files_delete on storage.objects for delete to anon,authenticated
 using(bucket_id='dailyflow-files' and (storage.foldername(name))[1]=(select public.dailyflow_owner_id())::text);
-- Use the existing validated sync implementation with the new identity resolver.
DO $migration$
declare definition text;
begin
 select pg_get_functiondef('public.sync_flow_items(jsonb)'::regprocedure) into definition;
 if position('uid uuid:=auth.uid()' in definition)=0 then raise exception 'Unexpected sync function: review migration'; end if;
 definition:=replace(definition,'uid uuid:=auth.uid()','uid uuid:=public.dailyflow_owner_id()');
 definition:=replace(definition,'perform pg_advisory_xact_lock(hashtextextended(uid::text,0));', 'perform pg_advisory_xact_lock(hashtextextended(uid::text,0)); if exists(select 1 from public.profiles where id=uid and deletion_pending) then raise exception ''Account deletion in progress'' using errcode=''42501''; end if;');
 execute definition;
end $migration$;
grant execute on function public.sync_flow_items(jsonb) to anon;
-- Only the trusted deletion function may set this state. Share the sync lock.
create function public.begin_firebase_account_deletion(firebase_subject text) returns uuid language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('firebase:'||firebase_subject,0));
 select id into owner_id from public.profiles where firebase_uid=firebase_subject;
 if owner_id is null then
  owner_id:=gen_random_uuid();
  insert into public.profiles(id,firebase_uid,deletion_pending) values(owner_id,firebase_subject,true);
 else
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
  update public.profiles set deletion_pending=true where id=owner_id;
 end if;
 return owner_id;
end $$;
revoke all on function public.begin_firebase_account_deletion(text) from public,anon,authenticated;
grant execute on function public.begin_firebase_account_deletion(text) to service_role;
commit;
