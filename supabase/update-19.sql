-- আপডেট ২০: গ্রুপের যেকোনো অ্যাডমিন গ্রুপ পুরোপুরি মুছে ফেলতে পারবেন (আগে শুধু যিনি বানিয়েছেন)
drop policy if exists "groups delete" on public.groups;
create policy "groups delete" on public.groups for delete to authenticated
  using (created_by = auth.uid() or public.is_group_admin(id, auth.uid()));
