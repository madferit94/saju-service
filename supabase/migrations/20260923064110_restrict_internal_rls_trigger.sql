-- The existing event trigger runs internally; application users must not call it.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
