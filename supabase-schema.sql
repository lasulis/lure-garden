create table if not exists public.categories (
  slug text primary key,
  name text not null,
  color text not null default 'leaf',
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  slug text primary key,
  title text not null,
  excerpt text not null,
  category_slug text not null references public.categories(slug),
  cover_url text not null default '',
  blocks jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  read_time text not null default '1 min',
  author_name text not null default 'Luiza Reixach Castro',
  author_avatar text not null default 'https://i.pravatar.cc/120?img=47',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  slug text,
  title text not null default '',
  excerpt text not null default '',
  category_slug text references public.categories(slug),
  cover_url text not null default '',
  editor_html text not null default '',
  saved_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

insert into public.categories (slug, name, color, description)
values
  ('data-science', 'Ciência de Dados', 'leaf', 'Análises, modelos e gráficos honestos.'),
  ('gen-ai', 'IA Generativa', 'crimson', 'LLMs, RAG, agentes e o que mais brotar.'),
  ('roadmaps', 'Estudos & Roadmaps', 'sand', 'Trilhas, planos de estudo e o que aprender depois.'),
  ('python', 'Python', 'moss', 'Truques, padrões e snippets do dia a dia.'),
  ('diario', 'Diário & Notas', 'sand', 'Coisas aleatórias que valem ser escritas.')
on conflict (slug) do update set
  name = excluded.name,
  color = excluded.color,
  description = excluded.description;

alter table public.categories enable row level security;
alter table public.posts enable row level security;
alter table public.drafts enable row level security;
alter table public.admin_users enable row level security;

drop policy if exists "public can read categories" on public.categories;
create policy "public can read categories"
on public.categories
for select
to anon, authenticated
using (true);

drop policy if exists "public can read published posts" on public.posts;
create policy "public can read published posts"
on public.posts
for select
to anon, authenticated
using (status = 'published');
