alter table public.students
  add column gender text
  constraint students_gender_allowed
  check (gender in ('female', 'male', 'another_gender'));

comment on column public.students.gender is
  'Optional registered gender. Diagnosis wording uses the separate pronoun preference.';
