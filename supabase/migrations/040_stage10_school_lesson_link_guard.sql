create or replace function private.enforce_school_lesson_links()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  target_type text;
begin
  select w.workspace_type into target_type
  from public.workspaces w
  where w.id = new.workspace_id;

  if target_type = 'school' and new.status = 'validated' then
    if new.class_id is null then
      raise exception 'A validated school lesson must be linked to an existing class.';
    end if;
    if new.subject_id is null then
      raise exception 'A validated school lesson must be linked to an existing subject.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists lessons_school_link_guard on public.lessons;
create trigger lessons_school_link_guard
before insert or update of workspace_id, class_id, subject_id, status
on public.lessons
for each row execute function private.enforce_school_lesson_links();
