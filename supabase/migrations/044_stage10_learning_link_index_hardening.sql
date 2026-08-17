create index if not exists teaching_assignments_class_workspace_idx on public.teaching_assignments(class_id, workspace_id);
create index if not exists teaching_assignments_subject_workspace_idx on public.teaching_assignments(subject_id, workspace_id);
create index if not exists teaching_assignments_workspace_teacher_idx on public.teaching_assignments(workspace_id, teacher_id);
create index if not exists teaching_assignments_created_by_idx on public.teaching_assignments(created_by);

create index if not exists lesson_deliveries_lesson_workspace_idx on public.lesson_deliveries(lesson_id, workspace_id);
create index if not exists lesson_deliveries_assignment_workspace_idx on public.lesson_deliveries(teaching_assignment_id, workspace_id);
create index if not exists lesson_deliveries_class_workspace_idx on public.lesson_deliveries(class_id, workspace_id);
create index if not exists lesson_deliveries_subject_workspace_idx on public.lesson_deliveries(subject_id, workspace_id);
create index if not exists lesson_deliveries_workspace_teacher_idx on public.lesson_deliveries(workspace_id, teacher_id);

create index if not exists student_lesson_work_workspace_idx on public.student_lesson_work(workspace_id);
create index if not exists student_lesson_work_delivery_workspace_idx on public.student_lesson_work(delivery_id, workspace_id);
create index if not exists student_lesson_work_lesson_workspace_idx on public.student_lesson_work(lesson_id, workspace_id);
create index if not exists student_lesson_work_class_workspace_idx on public.student_lesson_work(class_id, workspace_id);
create index if not exists student_lesson_work_subject_workspace_idx on public.student_lesson_work(subject_id, workspace_id);
create index if not exists student_lesson_work_workspace_teacher_idx on public.student_lesson_work(workspace_id, teacher_id);
create index if not exists student_lesson_work_student_workspace_idx on public.student_lesson_work(student_id, workspace_id);
create index if not exists student_lesson_work_reviewed_by_idx on public.student_lesson_work(reviewed_by) where reviewed_by is not null;
