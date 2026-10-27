create or replace function public.ping()
returns text
language sql
security invoker
set search_path = ''
as $$ select 'pong'::text $$;
