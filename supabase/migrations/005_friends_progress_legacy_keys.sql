-- Amigos com versão antiga do app enviam o resumo no formato v1 (scoreToday, workouts7...).
-- O filtro de "o que cada amigo vê" passa a entender também esses nomes.
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
        where k in ('name', 'updatedAt', 'v') or k = any(f.theirs)
          or (pr.stats->>'v' is null and (
               (k in ('scoreToday', 'scores14') and 'score' = any(f.theirs))
            or (k in ('workouts7', 'lastWorkout') and 'treino' = any(f.theirs))
            or (k in ('habitsToday', 'streak') and 'habitos' = any(f.theirs))
            or (k = 'waterToday' and 'agua' = any(f.theirs))
            or (k in ('mealsToday', 'kcalAdherence7') and 'refeicoes' = any(f.theirs)))))
    end,
    pr.updated_at
  from f
  left join public.profiles p on p.id = f.other
  left join public.progress pr on pr.user_id = f.other;
$$;
revoke execute on function public.get_friends_progress() from public, anon;
grant execute on function public.get_friends_progress() to authenticated;
