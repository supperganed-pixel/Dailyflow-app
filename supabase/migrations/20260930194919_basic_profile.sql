begin;

alter table public.profiles
  add column if not exists bio text not null default '',
  add column if not exists avatar text not null default 'initials';

alter table public.profiles
  drop constraint if exists profiles_bio_length,
  add constraint profiles_bio_length check (char_length(bio) <= 240),
  drop constraint if exists profiles_avatar_allowed,
  add constraint profiles_avatar_allowed check (
    avatar in ('initials', 'sun', 'star', 'coffee', 'feather', 'smile')
  );

revoke select on public.profiles from anon, authenticated;
grant select(id, display_name, bio, avatar, created_at, deletion_pending)
  on public.profiles to anon, authenticated;
grant update(display_name, bio, avatar)
  on public.profiles to anon, authenticated;

commit;

