create extension if not exists "pgcrypto";

create table if not exists public.teams (
  id text primary key,
  name text not null,
  short_name text not null,
  twin_name text not null,
  favorite_color text not null,
  color text not null,
  accent text not null,
  emoji text not null
);

create table if not exists public.challenges (
  id text primary key,
  title text not null,
  description text not null,
  icon text not null,
  board_position integer not null unique
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references public.teams(id) on delete cascade,
  challenge_id text not null references public.challenges(id) on delete cascade,
  participant_name text not null check (char_length(participant_name) <= 80),
  caption text check (caption is null or char_length(caption) <= 500),
  proof_url text,
  proof_type text,
  status text not null default 'approved' check (status in ('approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists submissions_team_challenge_idx
  on public.submissions (team_id, challenge_id);

create index if not exists submissions_created_at_idx
  on public.submissions (created_at desc);

alter table public.teams enable row level security;
alter table public.challenges enable row level security;
alter table public.submissions enable row level security;

drop policy if exists "Teams are public" on public.teams;
create policy "Teams are public"
  on public.teams for select
  using (true);

drop policy if exists "Challenges are public" on public.challenges;
create policy "Challenges are public"
  on public.challenges for select
  using (true);

drop policy if exists "Submissions are public" on public.submissions;
create policy "Submissions are public"
  on public.submissions for select
  using (true);

drop policy if exists "Guests can add approved submissions" on public.submissions;
create policy "Guests can add approved submissions"
  on public.submissions for insert
  with check (status = 'approved');

insert into public.teams (id, name, short_name, twin_name, favorite_color, color, accent, emoji)
values
  ('team-p', 'Team P', 'P', 'Twin P', 'pink', '#ff4fa3', '#ffd1e8', '💖'),
  ('team-k', 'Team K', 'K', 'Twin K', 'blue', '#5577ff', '#dbe4ff', '💙')
on conflict (id) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  twin_name = excluded.twin_name,
  favorite_color = excluded.favorite_color,
  color = excluded.color,
  accent = excluded.accent,
  emoji = excluded.emoji;

insert into public.challenges (id, title, description, icon, board_position)
values
  ('run-5k', 'Run a 5k / 3 mile', 'Route, treadmill, or finish selfie.', '🏃', 1),
  ('fond-memory', 'Share a fond memory', 'Sweet, funny, or chaotic.', '💌', 2),
  ('ted-talk', '1 minute TED talk', 'One topic. Full passion.', '🎤', 3),
  ('happy-birthday-song', 'Sing happy birthday', 'Grab a friend and sing.', '🎶', 4),
  ('three-shots', 'Take 3 shots', 'Team spirit. Stay safe.', '🥃', 5),
  ('favorite-color', 'Wear their favorite color', 'Outfit proof counts.', '🌈', 6),
  ('pushups-27', 'Do 27 push ups', 'Modified counts. Video wins.', '💪', 7),
  ('advice-next-year', 'Leave advice for next year', 'One note for the year ahead.', '📝', 8),
  ('bake-cake', 'Bake a cake', 'Cupcakes and mug cakes count.', '🎂', 9),
  ('origami', 'Complete an origami', 'Cute, weird, or birthday-themed.', '🦢', 10),
  ('same-birthday', 'Find a birthday match', 'Same birthday. Screenshot it.', '🔎', 11),
  ('toast-language', 'Toast in another language', 'Cheers, but not in English.', '🥂', 12),
  ('picture-dog', 'Take a picture with a dog', 'Any good dog counts.', '🐶', 13),
  ('other-twins', 'Picture with another set of twins', 'Twins in the wild.', '👯', 14),
  ('throwback', 'Throwback photo', 'Old photo. Big nostalgia.', '📸', 15),
  ('other-color', 'Other twin''s color', 'Find the rival color.', '🎨', 16)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  icon = excluded.icon,
  board_position = excluded.board_position;

insert into storage.buckets (id, name, public)
values ('challenge-proofs', 'challenge-proofs', true)
on conflict (id) do update set public = true;

drop policy if exists "Proof files are public" on storage.objects;
create policy "Proof files are public"
  on storage.objects for select
  using (bucket_id = 'challenge-proofs');

drop policy if exists "Guests can upload proof files" on storage.objects;
create policy "Guests can upload proof files"
  on storage.objects for insert
  with check (bucket_id = 'challenge-proofs');
