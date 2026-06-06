-- Run this in Supabase SQL editor

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'coach',
  payment_key text,
  order_id text,
  amount integer not null,
  status text not null default 'active', -- active | canceled | expired
  started_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);

alter table public.subscriptions enable row level security;

create policy "users can read own subscriptions"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- 결제 완료 후 본인 구독을 직접 insert 할 수 있도록 허용
create policy "users can insert own subscriptions"
  on public.subscriptions for insert
  with check (auth.uid() = user_id);
