-- Treino em dupla: fichas e dias da semana compartilhados entre amigos.
-- Cada pessoa participa de no máximo um plano ativo (status 'joined').
-- Todas as escritas passam pelas funções abaixo; leitura direta só para quem participa.

create table if not exists public.shared_plans (
  id bigint generated always as identity primary key,
  created_by uuid not null references auth.users(id) on delete cascade,
  plan jsonb not null,
  version integer not null default 1,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (pg_column_size(plan) < 262144)
);

create table if not exists public.shared_plan_members (
  plan_id bigint not null references public.shared_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'joined')),
  joined_at timestamptz,
  primary key (plan_id, user_id)
);
create index if not exists shared_plan_members_user_idx on public.shared_plan_members (user_id);
create index if not exists shared_plans_created_by_idx on public.shared_plans (created_by);
create index if not exists shared_plans_updated_by_idx on public.shared_plans (updated_by);

create or replace function private.in_plan(pid bigint, uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.shared_plan_members m where m.plan_id = pid and m.user_id = uid);
$$;
revoke execute on function private.in_plan(bigint, uuid) from public, anon;
grant execute on function private.in_plan(bigint, uuid) to authenticated;

alter table public.shared_plans enable row level security;
alter table public.shared_plan_members enable row level security;
create policy "plano: participantes veem" on public.shared_plans for select to authenticated
  using (private.in_plan(id, (select auth.uid())));
create policy "plano: participantes veem membros" on public.shared_plan_members for select to authenticated
  using (private.in_plan(plan_id, (select auth.uid())));

-- Criar o plano a partir das minhas fichas e convidar um amigo
create or replace function public.create_shared_plan(friend uuid, plan jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); pid bigint;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if not private.are_friends(me, friend) then raise exception 'not_friends'; end if;
  if exists (select 1 from public.shared_plan_members where user_id = me and status = 'joined') then
    raise exception 'already_in_plan';
  end if;
  insert into public.shared_plans (created_by, plan, updated_by) values (me, plan, me) returning id into pid;
  insert into public.shared_plan_members (plan_id, user_id, status, joined_at) values (pid, me, 'joined', now());
  insert into public.shared_plan_members (plan_id, user_id, status) values (pid, friend, 'invited');
  return pid;
end;
$$;

-- Meus planos (o ativo e convites recebidos), com os participantes
create or replace function public.get_my_shared_plans()
returns table (id bigint, plan jsonb, version integer, updated_by uuid, updated_at timestamptz, created_by uuid, my_status text, members jsonb)
language sql stable security definer set search_path = '' as $$
  select p.id, p.plan, p.version, p.updated_by, p.updated_at, p.created_by, m.status,
    (select coalesce(jsonb_agg(jsonb_build_object('id', o.user_id, 'status', o.status, 'name', coalesce(pr.display_name, 'Amigo'))), '[]'::jsonb)
       from public.shared_plan_members o left join public.profiles pr on pr.id = o.user_id where o.plan_id = p.id)
  from public.shared_plan_members m join public.shared_plans p on p.id = m.plan_id
  where m.user_id = auth.uid()
  order by p.updated_at desc;
$$;

-- Aceitar ou recusar um convite
create or replace function public.respond_shared_plan(pid bigint, accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.shared_plan_members where plan_id = pid and user_id = me and status = 'invited') then
    raise exception 'no_invite';
  end if;
  if accept then
    if exists (select 1 from public.shared_plan_members where user_id = me and status = 'joined') then
      raise exception 'already_in_plan';
    end if;
    update public.shared_plan_members set status = 'joined', joined_at = now() where plan_id = pid and user_id = me;
  else
    delete from public.shared_plan_members where plan_id = pid and user_id = me;
    if (select count(*) from public.shared_plan_members where plan_id = pid) < 2 then
      delete from public.shared_plans where id = pid;
    end if;
  end if;
end;
$$;

-- Sair do plano (quem fica continua com as fichas no próprio app)
create or replace function public.leave_shared_plan(pid bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  delete from public.shared_plan_members where plan_id = pid and user_id = me;
  if (select count(*) from public.shared_plan_members where plan_id = pid) < 2 then
    delete from public.shared_plans where id = pid;
  end if;
end;
$$;

-- Salvar mudanças: só grava se ninguém mudou antes (versão igual); senão devolve a versão atual
create or replace function public.update_shared_plan(pid bigint, new_plan jsonb, base integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); cur public.shared_plans%rowtype;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.shared_plan_members where plan_id = pid and user_id = me and status = 'joined') then
    raise exception 'not_in_plan';
  end if;
  select * into cur from public.shared_plans where id = pid for update;
  if cur.version <> base then
    return jsonb_build_object('ok', false, 'version', cur.version, 'plan', cur.plan, 'updated_by', cur.updated_by,
      'updated_by_name', (select display_name from public.profiles where id = cur.updated_by));
  end if;
  update public.shared_plans set plan = new_plan, version = cur.version + 1, updated_by = me, updated_at = now() where id = pid;
  return jsonb_build_object('ok', true, 'version', cur.version + 1);
end;
$$;

revoke execute on function public.create_shared_plan(uuid, jsonb) from public, anon;
revoke execute on function public.get_my_shared_plans() from public, anon;
revoke execute on function public.respond_shared_plan(bigint, boolean) from public, anon;
revoke execute on function public.leave_shared_plan(bigint) from public, anon;
revoke execute on function public.update_shared_plan(bigint, jsonb, integer) from public, anon;
grant execute on function public.create_shared_plan(uuid, jsonb) to authenticated;
grant execute on function public.get_my_shared_plans() to authenticated;
grant execute on function public.respond_shared_plan(bigint, boolean) to authenticated;
grant execute on function public.leave_shared_plan(bigint) to authenticated;
grant execute on function public.update_shared_plan(bigint, jsonb, integer) to authenticated;
