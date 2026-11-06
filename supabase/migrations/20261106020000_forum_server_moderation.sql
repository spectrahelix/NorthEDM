-- Forum moderation enforced by the database (site audit, 2026-11-06).
-- The composer asks /api/moderate first, then inserts threads / replies
-- directly with the user's session — so a direct REST call skipped moderation
-- entirely. This trigger applies the same hard rules on every write: the
-- slur / harassment list from app/api/moderate/route.ts (keep the two in step),
-- more than 4 links, or more than 12,000 characters. Softer nudges (all caps,
-- repeated letters) stay client-side only.
create or replace function public.forum_text_problem(t text) returns text
  language plpgsql immutable set search_path = public as $$
declare
  links int;
begin
  if t is null then return null; end if;
  if char_length(t) > 12000 then return 'Post exceeds maximum length.'; end if;
  select count(*) into links from regexp_matches(t, 'https?://', 'g');
  if links > 4 then return 'Too many links — looks like spam.'; end if;
  if t ~* '\yn[i!1]gg[ae3r]' or t ~* '\yf[a@4]gg[o0]t' or t ~* '\ych[i1]nk\y' or t ~* '\ysp[i1]c\y'
     or t ~* '\yk[i1]ke\y' or t ~* '\ytr[a4]nn[yi]' or t ~* '\yretard(ed)?\y' or t ~* '\yc[u*]nt\y'
     or t ~* '\ywh[o0]re\y' or t ~* '\yk[i1]ll\s+your?se?l[fv]' or t ~* '\ydo[x*]{1,2}(ing|ed)?\y' then
    return 'Your post contains language that violates our community guidelines. Keep it respectful.';
  end if;
  return null;
end $$;

create or replace function public.forum_guard() returns trigger
  language plpgsql set search_path = public as $$
declare
  problem text;
begin
  if tg_table_name = 'threads' then
    problem := public.forum_text_problem(coalesce(new.title, '') || ' ' || coalesce(new.body, ''));
  else
    problem := public.forum_text_problem(new.body);
  end if;
  if problem is not null then
    raise exception '%', problem using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke execute on function public.forum_guard() from public, anon, authenticated;

create or replace trigger forum_guard_threads before insert or update of title, body on public.threads
  for each row execute function public.forum_guard();
create or replace trigger forum_guard_replies before insert or update of body on public.replies
  for each row execute function public.forum_guard();
