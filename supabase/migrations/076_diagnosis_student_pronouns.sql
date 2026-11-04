-- The registered pronoun choice controls student-facing and parent-facing wording.
-- Unknown legacy records remain neutral; never infer identity from a name.
alter table public.students
  add column if not exists pronoun_preference text not null default 'name_only';

alter table public.students
  add constraint students_pronoun_preference_allowed
  check (pronoun_preference in ('name_only', 'she_her', 'he_him', 'they_them'));

comment on column public.students.pronoun_preference is
  'Report wording preference supplied by school owner/admin; name_only when not recorded. Not inferred from student name.';
