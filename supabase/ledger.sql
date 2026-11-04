-- 《海市》帳簿：所有觀眾共看的一本帳。在 Supabase 的 SQL Editor 貼上執行一次即可。
-- 任何人都能新增、能看到沒被隱藏的紙條；沒有人能從網站上修改或刪除。
-- 要隱藏不當的紙條：到 Table Editor 打開 ledger，把那一列的 hidden 勾起來。

create table if not exists public.ledger (
  id         bigint generated always as identity primary key,
  cid        text unique,                                   -- 送出那支手機自己產生的編號，用來認出自己的紙條
  place      text not null check (char_length(place) between 1 and 16),
  words      text not null check (char_length(words) between 1 and 100),
  w          real not null default 0,                       -- 重量由資料庫自己算，不信任網頁送來的數字
  site       text check (site in ('longkou', 'shuangxi', 'hangkong', 'shezi')),
  source     text not null default 'online' check (source in ('online', 'stall')),
  hidden     boolean not null default false,
  created_at timestamptz not null default now()
);

-- 一個地方有多重：寫得越多越重（和網頁上的秤同一條公式），時間也以伺服器為準
create or replace function public.ledger_weigh() returns trigger language plpgsql as $$
begin
  new.place := btrim(new.place);
  new.words := btrim(new.words);
  new.w := round(least(9.9, 0.8 + (char_length(new.place) + char_length(new.words)) * 0.06)::numeric, 1);
  new.created_at := now();
  new.hidden := false;
  return new;
end $$;
drop trigger if exists ledger_weigh on public.ledger;
create trigger ledger_weigh before insert on public.ledger for each row execute function public.ledger_weigh();

alter table public.ledger enable row level security;
drop policy if exists "read visible slips" on public.ledger;
create policy "read visible slips" on public.ledger for select to anon, authenticated using (hidden = false);
drop policy if exists "visitors add slips" on public.ledger;
create policy "visitors add slips" on public.ledger for insert to anon with check (source = 'online');
drop policy if exists "staff add slips" on public.ledger;
create policy "staff add slips" on public.ledger for insert to authenticated with check (true);

grant select, insert on public.ledger to anon, authenticated;

-- 新的紙條即時推送到每一個開著的頁面
do $$ begin
  alter publication supabase_realtime add table public.ledger;
exception when duplicate_object then null; end $$;
