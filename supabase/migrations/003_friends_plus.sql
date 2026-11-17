-- Amigos+: o que cada amigo vê, reações e desafios.

-- 1) Visibilidade por amizade (cada lado escolhe o que compartilha com o outro)
alter table public.friendships
  add column if not exists requester_shares text[] not null default array['score','treino','habitos','refeicoes','agua','sono'],
  add column if not exists addressee_shares text[] not null default array['score','treino','habitos','refeicoes','agua','sono'];

create or replace function public.set_friend_shares(fid bigint, shares text[])
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  update public.friendships set requester_shares = shares where id = fid and requester = me;
  update public.friendships set addressee_shares = shares where id = fid and addressee = me;
end;
$$;
revoke execute on function public.set_friend_shares(bigint, text[]) from public, anon;
grant execute on function public.set_friend_shares(bigint, text[]) to authenticated;

-- progresso: leitura direta só pelo dono; amigos leem pela função abaixo (já filtrada)
drop policy if exists "progresso: dono e amigos leem" on public.progress;
create policy "progresso: dono lê" on public.progress for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.get_friends_progress()
returns table (friendship_id bigint, user_id uuid, name text, status text, incoming boolean, my_shares text[], stats jsonb, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as id),
  f as (
    select fr.id, fr.status, fr.requester, fr.addressee,
      case when fr.requester = me.id then fr.addressee else fr.requester end as other,
      case when fr.requester = me.id then fr.requester_shares else fr.addressee_shares end as mine,
      case when fr.requester = me.id then fr.addressee_shares else fr.requester_shares end as theirs
    from public.friendships fr, me where me.id in (fr.requester, fr.addressee)
  )
  select f.id, f.other, coalesce(p.display_name, 'Amigo'), f.status,
    (f.status = 'pending' and f.addressee = (select id from me)), f.mine,
    case when f.status = 'accepted' and pr.stats is not null then
      (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each(pr.stats) as e(k, v)
        where k in ('name', 'updatedAt', 'v') or k = any(f.theirs))
    end,
    pr.updated_at
  from f
  left join public.profiles p on p.id = f.other
  left join public.progress pr on pr.user_id = f.other;
$$;
revoke execute on function public.get_friends_progress() from public, anon;
grant execute on function public.get_friends_progress() to authenticated;

-- 2) Reações ao dia do amigo
create table if not exists public.reactions (
  id bigint generated always as identity primary key,
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  day date not null,
  emoji text not null check (emoji in ('👏','🔥','💪','❤️','🎉')),
  created_at timestamptz not null default now(),
  unique (from_user, to_user, day, emoji)
);
create index if not exists reactions_to_idx on public.reactions (to_user, day);
alter table public.reactions enable row level security;
create policy "reação: amigo envia" on public.reactions for insert to authenticated
  with check (from_user = (select auth.uid()) and private.are_friends(from_user, to_user));
create policy "reação: envolvidos veem" on public.reactions for select to authenticated
  using ((select auth.uid()) in (from_user, to_user));
create policy "reação: autor remove" on public.reactions for delete to authenticated
  using (from_user = (select auth.uid()));

-- 3) Desafios
create table if not exists public.challenges (
  id bigint generated always as identity primary key,
  creator uuid not null references auth.users(id) on delete cascade,
  title text not null,
  metric text not null check (metric in ('treino','habitos','agua','refeicoes','score','sono')),
  start_day date not null,
  end_day date not null,
  created_at timestamptz not null default now(),
  check (end_day >= start_day)
);
create table if not exists public.challenge_members (
  challenge_id bigint not null references public.challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited','joined')),
  primary key (challenge_id, user_id)
);

create or replace function private.in_challenge(cid bigint, uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.challenge_members m where m.challenge_id = cid and m.user_id = uid)
      or exists (select 1 from public.challenges c where c.id = cid and c.creator = uid);
$$;
revoke execute on function private.in_challenge(bigint, uuid) from public, anon;
grant execute on function private.in_challenge(bigint, uuid) to authenticated;

alter table public.challenges enable row level security;
alter table public.challenge_members enable row level security;
create policy "desafio: participantes veem" on public.challenges for select to authenticated
  using (private.in_challenge(id, (select auth.uid())));
create policy "desafio: criador cria" on public.challenges for insert to authenticated
  with check (creator = (select auth.uid()));
create policy "desafio: criador apaga" on public.challenges for delete to authenticated
  using (creator = (select auth.uid()));

create policy "membros: participantes veem" on public.challenge_members for select to authenticated
  using (private.in_challenge(challenge_id, (select auth.uid())));
create policy "membros: criador convida amigos" on public.challenge_members for insert to authenticated
  with check (
    exists (select 1 from public.challenges c where c.id = challenge_id and c.creator = (select auth.uid()))
    and (user_id = (select auth.uid()) or private.are_friends((select auth.uid()), user_id))
  );
create policy "membros: aceitar o próprio convite" on public.challenge_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "membros: sair ou criador remove" on public.challenge_members for delete to authenticated
  using (user_id = (select auth.uid()) or exists (select 1 from public.challenges c where c.id = challenge_id and c.creator = (select auth.uid())));

-- Lista meus desafios com participantes e os dias da métrica de cada um (quem entrou no desafio aceitou compartilhar essa métrica)
create or replace function public.get_my_challenges()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'title', c.title, 'metric', c.metric, 'start', c.start_day, 'end', c.end_day, 'creator', c.creator,
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'status', m.status, 'name', coalesce(p.display_name, 'Amigo'),
        'days', case when m.status = 'joined' then pr.stats -> c.metric -> 'days' end
      )), '[]'::jsonb)
      from public.challenge_members m
      left join public.profiles p on p.id = m.user_id
      left join public.progress pr on pr.user_id = m.user_id
      where m.challenge_id = c.id
    )
  ) order by c.end_day desc), '[]'::jsonb)
  from public.challenges c
  where private.in_challenge(c.id, auth.uid());
$$;
revoke execute on function public.get_my_challenges() from public, anon;
grant execute on function public.get_my_challenges() to authenticated;
