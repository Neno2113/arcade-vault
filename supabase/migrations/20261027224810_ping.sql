create or replace function public.ping()
returns text
language sql
security invoker
as $$ select 'pong'::text $$;

grant execute on function public.ping() to anon, authenticated;
