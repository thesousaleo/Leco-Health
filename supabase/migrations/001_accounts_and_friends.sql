-- Leco Health — contas, backup do estado, progresso compartilhado e amizades.
-- Aplicado no projeto Supabase "Leco Health" (sa-east-1).

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  friend_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  created_at timestamptz not null default now()
);

create table public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stats jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.friendships (
  id bigint generated always as identity primary key,
  requester uuid not null references auth.users(id) on delete cascade,
  addressee uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  unique (requester, addressee),
  check (requester <> addressee)
);
create index friendships_addressee_idx on public.friendships (addressee);

-- Funções auxiliares fora do schema exposto pela API
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friendships f where f.status = 'accepted'
    and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a)));
$$;

create or replace function private.is_connected(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friendships f
    where (f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a));
$$;

revoke execute on function private.are_friends(uuid, uuid) from public, anon;
revoke execute on function private.is_connected(uuid, uuid) from public, anon;
grant execute on function private.are_friends(uuid, uuid) to authenticated;
grant execute on function private.is_connected(uuid, uuid) to authenticated;

-- Perfil criado automaticamente no cadastro
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- Pedido de amizade por código (aceita automaticamente se o outro já tinha pedido)
create or replace function public.send_friend_request(code text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  target public.profiles%rowtype;
  existing public.friendships%rowtype;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select * into target from public.profiles where friend_code = upper(trim(code));
  if not found then raise exception 'code_not_found'; end if;
  if target.id = me then raise exception 'own_code'; end if;
  select * into existing from public.friendships
   where (requester = me and addressee = target.id) or (requester = target.id and addressee = me);
  if found then
    if existing.status = 'pending' and existing.addressee = me then
      update public.friendships set status = 'accepted' where id = existing.id;
      return json_build_object('status', 'accepted', 'name', target.display_name);
    end if;
    return json_build_object('status', existing.status, 'name', target.display_name);
  end if;
  insert into public.friendships (requester, addressee) values (me, target.id);
  return json_build_object('status', 'pending', 'name', target.display_name);
end;
$$;
revoke execute on function public.send_friend_request(text) from anon, public;
grant execute on function public.send_friend_request(text) to authenticated;

-- RLS
alter table public.profiles enable row level security;
alter table public.user_state enable row level security;
alter table public.progress enable row level security;
alter table public.friendships enable row level security;

create policy "perfil: ver o próprio e de conexões" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.is_connected((select auth.uid()), id));
create policy "perfil: editar o próprio" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "estado: só o dono" on public.user_state for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "progresso: dono e amigos leem" on public.progress for select to authenticated
  using (user_id = (select auth.uid()) or private.are_friends((select auth.uid()), user_id));
create policy "progresso: dono insere" on public.progress for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "progresso: dono atualiza" on public.progress for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "amizade: participantes veem" on public.friendships for select to authenticated
  using ((select auth.uid()) in (requester, addressee));
create policy "amizade: convidado aceita" on public.friendships for update to authenticated
  using (addressee = (select auth.uid())) with check (addressee = (select auth.uid()) and status = 'accepted');
create policy "amizade: participantes removem" on public.friendships for delete to authenticated
  using ((select auth.uid()) in (requester, addressee));
