-- O criador precisa enxergar o desafio no próprio insert (o app pede o registro de volta).
drop policy if exists "desafio: participantes veem" on public.challenges;
create policy "desafio: participantes veem" on public.challenges for select to authenticated
  using (creator = (select auth.uid()) or private.in_challenge(id, (select auth.uid())));
