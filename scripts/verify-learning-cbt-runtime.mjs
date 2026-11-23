import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
const id = (n) => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');
await db.exec(`
  create schema private; create schema auth;
  create role authenticated; create role anon;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql as
    'select nullif(current_setting(''app.uid'', true), '''')::uuid';
  create table workspaces(id uuid primary key, workspace_type text, access_status text);
  create table classes(id uuid primary key);
  create table assessments(id uuid primary key, workspace_id uuid, class_id uuid, title text, status text);
  create table assessment_items(id uuid primary key, assessment_id uuid, position integer, content jsonb,
    item_type text, answer_key jsonb, marks numeric);
  create table students(id uuid primary key, workspace_id uuid, class_id uuid, active boolean, display_name text);
  create table student_accounts(user_id uuid, student_id uuid, workspace_id uuid, active boolean);
  create table workspace_members(user_id uuid, workspace_id uuid, status text, role text);
  create function private.can_view_teacher_artifact(uuid,text,uuid) returns boolean language sql as
    'select auth.uid() = ''${id(1)}''::uuid';
  create function private.has_workspace_role(uuid,text[]) returns boolean language sql as
    'select auth.uid() = ''${id(1)}''::uuid';
  insert into auth.users values ('${id(1)}'), ('${id(2)}'), ('${id(3)}');
  insert into workspaces values ('${id(4)}','school','active'), ('${id(11)}','school','active');
  insert into classes values ('${id(5)}');
  insert into students values ('${id(6)}','${id(4)}','${id(5)}',true), ('${id(10)}','${id(11)}','${id(5)}',true);
  insert into student_accounts values ('${id(2)}','${id(6)}','${id(4)}',true), ('${id(3)}','${id(10)}','${id(11)}',true);
  insert into workspace_members values ('${id(2)}','${id(4)}','active','student'), ('${id(3)}','${id(11)}','active','student');
  insert into assessments values ('${id(7)}','${id(4)}','${id(5)}','Class CBT','validated');
  insert into assessment_items values
    ('${id(8)}','${id(7)}',1,'{"prompt":"First","options":["a","b"]}','objective','{"correctAnswer":"b"}',2),
    ('${id(9)}','${id(7)}',2,'{"prompt":"Explain"}','critical_thinking',null,4);
`);
await db.exec(readFileSync(new URL('../supabase/migrations/20261121190000_learning_cbt.sql', import.meta.url), 'utf8'));
const scalar = async (sql, params = []) => (await db.query(sql, params)).rows[0].value;
await db.exec(`set role authenticated; set app.uid = '${id(1)}'`);
await db.exec("reset role; update assessments set status='draft'; set role authenticated;");
await assert.rejects(scalar('select assign_learning_cbt($1) as value', [id(7)]), /Validate the assessment/);
await db.exec("reset role; update assessments set status='validated'; set role authenticated;");
const cbt = await scalar('select assign_learning_cbt($1) as value', [id(7)]);
assert.equal(await scalar('select assign_learning_cbt($1) as value', [id(7)]), cbt);
await db.exec(`set app.uid = '${id(3)}'`);
assert.deepEqual(await scalar('select get_learning_cbts($1) as value', [cbt]), []);
await assert.rejects(scalar('select submit_learning_cbt($1,$2) as value',[cbt, '{}']), /CBT unavailable/);
await db.exec(`set app.uid = '${id(2)}'`);
await assert.rejects(scalar('select assign_learning_cbt($1) as value', [id(7)]), /Assessment unavailable/);
await assert.rejects(db.query('select questions from private.learning_cbts'), /permission denied/);
const [open] = await scalar('select get_learning_cbts($1) as value', [cbt]);
assert.equal(open.feedback, null);
assert(!Object.hasOwn(open.questions[0], 'correct'));
await assert.rejects(scalar('select submit_learning_cbt($1,$2) as value',[cbt, JSON.stringify({[id(8)]:'invalid'})]), /Invalid answer/);
const submitted = await scalar('select submit_learning_cbt($1,$2) as value', [cbt, JSON.stringify({[id(8)]:'b',[id(9)]:'An explanation.'})]);
assert.equal(submitted.earned, 2);
assert.equal(submitted.possible, 2);
assert.equal(submitted.awaitingMarking, 1);
assert.equal(submitted.review[0].correct, 'b');
assert.deepEqual(await scalar('select submit_learning_cbt($1,$2) as value', [cbt, '{}']), submitted);
const [saved] = await scalar('select get_learning_cbts($1) as value', [cbt]);
assert.deepEqual(saved.feedback, submitted);
assert.equal(saved.questions, null);
await db.exec("reset role; update workspace_members set status='inactive' where role='student'; set role authenticated;");
await assert.rejects(scalar('select get_learning_cbts() as value'), /active learner account/);
// Existing mixed CBT submissions remain available after the score-sheet migration.
await db.exec('reset role;');
await db.exec(readFileSync(new URL('../supabase/migrations/20261121220000_learning_score_sheet.sql', import.meta.url), 'utf8'));
await db.exec(`set role authenticated; set app.uid = '${id(1)}'`);
const readScoreSheet = (sourceId) => scalar('select get_learning_score_sheet($1) as value', [sourceId]);
const oldSheet = await readScoreSheet(id(7));
assert.equal(oldSheet.roster[0].objective, 2);
assert.equal(oldSheet.maxima.critical_thinking, 4);
assert.equal(oldSheet.roster[0].critical_thinking, null);

await db.exec(`reset role;
  insert into assessments values ('${id(12)}','${id(4)}','${id(5)}','Midterm','validated');
  insert into assessment_items values
    ('${id(13)}','${id(12)}',1,'{"prompt":"First","options":["a","b"]}','objective','{"correctAnswer":"b"}',2),
    ('${id(14)}','${id(12)}',2,'{"prompt":"Write"}','subjective',null,3),
    ('${id(15)}','${id(12)}',3,'{"prompt":"Explain"}','critical_thinking',null,4),
    ('${id(16)}','${id(12)}',4,'{"prompt":"Build"}','project',null,5);
  update workspace_members set status = 'active';
  set role authenticated;
`);
const midterm = await scalar('select assign_learning_cbt($1) as value', [id(12)]);
const saveScores = (learner, revision, subjective, criticalThinking, project) =>
  scalar('select save_learning_paper_scores($1,$2,$3,$4,$5,$6) as value',
    [id(12), learner, revision, subjective, criticalThinking, project]);
const firstSheet = await readScoreSheet(id(12));
assert.deepEqual(firstSheet.maxima, { objective: 2, subjective: 3, critical_thinking: 4, project: 5 });
assert.equal(firstSheet.roster.length, 1);
assert.equal(firstSheet.roster[0].objective, null);
await assert.rejects(saveScores(id(10), 0, 1, 2, 3), /Learner unavailable/);
await assert.rejects(saveScores(id(6), 0, 4, 2, 3), /section maximums/);
assert.equal(await saveScores(id(6), 0, 0, null, 5), 1);
await assert.rejects(saveScores(id(6), 0, 1, 2, 3), /Scores changed/);
assert.equal(await saveScores(id(6), 1, 0, 4, 5), 2);

await db.exec(`set app.uid = '${id(2)}'`);
await assert.rejects(readScoreSheet(id(12)), /Score sheet unavailable/);
await assert.rejects(saveScores(id(6), 2, 1, 2, 3), /Score sheet unavailable/);
const [midtermOpen] = await scalar('select get_learning_cbts($1) as value', [midterm]);
assert.equal(midtermOpen.questions.length, 1);
assert.equal(midtermOpen.questions[0].type, 'objective');
const graded = await scalar('select submit_learning_cbt($1,$2) as value',
  [midterm, JSON.stringify({ [id(13)]: 'b' })]);
assert.equal(graded.earned, 2);
assert.equal(graded.awaitingMarking, 0);
assert(!Object.hasOwn(graded, 'project'));

await db.exec(`set app.uid = '${id(1)}'`);
const updated = (await readScoreSheet(id(12))).roster[0];
assert.deepEqual([updated.objective, updated.subjective, updated.critical_thinking, updated.project], [2, 0, 4, 5]);
await db.exec(`reset role; insert into auth.users values ('${id(17)}');
  create or replace function private.can_view_teacher_artifact(uuid,text,uuid) returns boolean language sql
  as 'select auth.uid() in (''${id(1)}''::uuid, ''${id(17)}''::uuid)';
  create or replace function private.has_workspace_role(uuid,text[]) returns boolean language sql
  as 'select case auth.uid() when ''${id(1)}''::uuid then ''teacher'' = any($2)
    when ''${id(17)}''::uuid then ''leader'' = any($2) else false end';
  set role authenticated;`);
const publication = readFileSync(new URL('../supabase/migrations/20261122120000_learning_result_publication.sql', import.meta.url), 'utf8');
await db.exec('reset role;');
await db.exec(publication);
await db.exec(readFileSync(new URL('../supabase/migrations/20261122130000_learning_result_comments.sql', import.meta.url), 'utf8'));
await db.exec('set role authenticated;');
const review = (revision, action, note = null) => db.query(
  'select change_learning_result_review($1,$2,$3,$4)', [id(12), revision, action, note]);
const reviewSheet = () => scalar('select get_learning_result_review($1) as value', [id(12)]);
const publishedResults = () => scalar('select get_my_published_learning_results() as value');
assert.equal((await reviewSheet()).status, 'draft');
assert.equal(await saveScores(id(6), 2, 0, null, 5), 3);
await assert.rejects(review(0, 'submitted'), /all required marks/);
assert.equal(await saveScores(id(6), 3, 0, 4, 5), 4);
await review(0, 'submitted');
assert.equal((await reviewSheet()).writable, false);
await assert.rejects(saveScores(id(6), 4, 1, 4, 5), /Scores are locked/);
await assert.rejects(review(1, 'published'), /leadership approval/);
await db.exec(`set app.uid = '${id(2)}'`);
assert.deepEqual(await publishedResults(), []);
await assert.rejects(reviewSheet(), /Score sheet unavailable/);
await db.exec(`set app.uid = '${id(17)}'`);
await assert.rejects(review(0, 'published'), /review changed/);
await review(1, 'returned', 'Check the project score');
assert.equal((await reviewSheet()).note, 'Check the project score');
await db.exec(`set app.uid = '${id(1)}'`);
assert.equal(await saveScores(id(6), 4, 0, 4, 3), 5);
await review(2, 'submitted');
await db.exec(`set app.uid = '${id(17)}'`);
const publishWithComments = (comments) => db.query(
  'select publish_learning_result_with_comments($1,$2,$3)', [id(12), 3, JSON.stringify(comments)]);
await assert.rejects(publishWithComments({ [id(10)]: 'Other learner' }), /learners on this sheet/);
assert.equal((await reviewSheet()).status, 'submitted');
await publishWithComments({ [id(6)]: 'Practise the next project task.' });
assert.equal((await reviewSheet()).status, 'published');
await db.exec(`set app.uid = '${id(2)}'`);
const [official] = await publishedResults();
assert.equal(official.administrative_comment, 'Practise the next project task.');
assert.deepEqual(official.scores, { objective: 2, subjective: 0, critical_thinking: 4, project: 3 });
await db.exec(`set app.uid = '${id(3)}'`);
assert.deepEqual(await publishedResults(), []);
await db.exec(`set app.uid = '${id(1)}'`);
await assert.rejects(saveScores(id(6), 5, 0, 4, 5), /Scores are locked/);
await db.exec(`reset role;
  alter table workspaces add column name text default 'School A', add column logo_url text;
  alter table classes add column name text default 'JSS1', add column workspace_id uuid, add column academic_session text;
  alter table assessments add column blueprint jsonb default '{"term":"First Term","academicSession":"2026/2027"}';
  alter table assessments add column subject_id uuid;
  create table subjects(id uuid primary key, workspace_id uuid, name text);
  create table diagnoses (
    id uuid primary key, workspace_id uuid, student_id uuid, assessment_id uuid, status text,
    term text, academic_session text, reviewed_at timestamptz, finalised_at timestamptz,
    diagnosis_mode text, concise_diagnosis text, builder_growth_direction text, encouragement_note text,
    academic_strengths jsonb default '[]', academic_challenges jsonb default '[]',
    character_strengths jsonb default '[]', character_challenges jsonb default '[]',
    school_academic_actions jsonb default '[]', parent_academic_actions jsonb default '[]',
    school_character_actions jsonb default '[]', parent_character_actions jsonb default '[]'
  );
  insert into diagnoses (id,workspace_id,student_id,assessment_id,status,term,academic_session,
    reviewed_at,finalised_at,diagnosis_mode,concise_diagnosis,academic_strengths)
  values ('${id(30)}','${id(4)}','${id(6)}','${id(12)}','draft','First Term','2026/2027',
    now(),now(),'assessment_based','Private draft','[{"statement":"Approved strength","evidenceIds":["internal"]}]');
`);
await db.exec(`
  create role service_role;
  create table auth.sessions (id uuid primary key, user_id uuid, created_at timestamptz);
  create function auth.jwt() returns jsonb language sql as
    'select jsonb_build_object(''session_id'', current_setting(''app.session'', true))';
  alter table auth.users add column email text, add column raw_app_meta_data jsonb;
  insert into auth.users (id,email,raw_app_meta_data) values
    ('${id(31)}','synthetic.parent@parents.ksi.name.ng',jsonb_build_object('ksi_parent_school','${id(4)}')),
    ('${id(32)}','different.parent@parents.ksi.name.ng',jsonb_build_object('ksi_parent_school','${id(11)}')),
    ('${id(33)}',null,null);
  create or replace function private.has_workspace_role(uuid,text[]) returns boolean language sql as
    'select case auth.uid() when ''${id(1)}''::uuid then ''teacher'' = any($2)
      when ''${id(17)}''::uuid then ''leader'' = any($2)
      when ''${id(33)}''::uuid then $1 = ''${id(4)}''::uuid and ''owner'' = any($2)
      else false end';
`);
await db.exec(readFileSync(new URL('../supabase/migrations/20261122150000_learning_result_report.sql', import.meta.url), 'utf8'));
await db.exec(readFileSync(new URL('../supabase/migrations/20261122153000_learning_family_access.sql', import.meta.url), 'utf8'));
await db.exec(`set role authenticated; set app.uid = '${id(2)}'`);
const resultReport = () => scalar('select get_my_learning_result_report($1) as value', [midterm]);
assert.equal((await resultReport()).diagnosis, null);
await db.exec("reset role; update diagnoses set status='final', concise_diagnosis='Approved finding'; set role authenticated;");
const report = await resultReport();
assert.equal(report.school_name, 'School A');
assert.equal(report.administrative_comment, 'Practise the next project task.');
assert.equal(report.diagnosis.conciseDiagnosis, 'Approved finding');
assert.deepEqual(report.diagnosis.academicSkillStrengths, [{ statement: 'Approved strength' }]);
assert(!Object.hasOwn(report.diagnosis, 'observedEvidence'));
await db.exec(`set app.uid = '${id(3)}'`);
assert.equal(await resultReport(), null);
const registerParent = (parent, learner) => db.query(
  'select register_learning_parent($1,$2,$3,$4)', [id(4), parent, 'Test Parent', [learner]]);
const parentReports = () => scalar('select get_my_parent_learning_results() as value');
const parentReport = (learner) => scalar(
  'select get_my_parent_learning_report($1,$2) as value', [midterm, learner]);
const savePhoto = (learner, jpeg) => db.query(
  'select save_learning_passport_photo($1,$2,$3)', [id(4), learner, jpeg]);
await db.exec(`set app.uid = '${id(1)}'`);
await assert.rejects(registerParent(id(31), id(6)), /administrator access/);
await db.exec(`set app.uid = '${id(33)}'`);
await assert.rejects(registerParent(id(31), id(10)), /this school/);
await assert.rejects(registerParent(id(32), id(6)), /identity could not be verified/);
await registerParent(id(31), id(6));
await db.exec('reset role; create table public.profiles (id uuid primary key, display_name text);');
await db.exec(readFileSync(new URL('../supabase/migrations/20261123130000_learning_parent_management.sql', import.meta.url), 'utf8'));
await db.exec(readFileSync(new URL('../supabase/migrations/20261123131000_school_staff_directory.sql', import.meta.url), 'utf8'));
await db.exec(`
  insert into public.profiles values ('${id(17)}', 'Test Leader'), ('${id(32)}', 'Other-school Staff');
  insert into public.students (id, workspace_id, class_id, active, display_name)
    values ('${id(93)}','${id(4)}','${id(5)}',true,'Alternate learner');
  insert into public.workspace_members (user_id, workspace_id, role, status) values
    ('${id(17)}','${id(4)}','leader','active'), ('${id(32)}','${id(11)}','teacher','active'),
    ('${id(33)}','${id(4)}','owner','active');
  grant usage on schema auth to authenticated;
  grant select on public.workspace_members, public.workspaces to authenticated;
  grant update on public.workspace_members to authenticated;
  set role authenticated;
`);
const updateParent = (school, learner) => db.query(
  'select update_learning_parent($1,$2,$3,$4)', [school, id(31), 'Updated Parent', [learner]]);
await assert.rejects(updateParent(id(11), id(10)), /administrator access/);
await assert.rejects(updateParent(id(4), id(10)), /this school/);
await updateParent(id(4), id(93));
const familySetup = await scalar('select get_learning_family_setup($1) as value', [id(4)]);
assert.equal(familySetup.parents[0].name, 'Updated Parent');
assert.deepEqual(familySetup.parents[0].learner_ids, [id(93)]);
assert.deepEqual(familySetup.parents[0].learners, ["Alternate learner"]);
await updateParent(id(4), id(6));
const staffDirectory = (school) => db.query('select * from get_school_staff_directory($1)', [school]);
const directory = (await staffDirectory(id(4))).rows;
assert(directory.some(({ display_name, role }) => display_name === 'Test Leader' && role === 'leader'));
assert(directory.every(({ role }) => role !== 'student'));
assert(directory.every(({ display_name }) => display_name !== 'Other-school Staff'));
await assert.rejects(staffDirectory(id(11)), /administrator access/);
const changeStaffStatus = (school, staff, previous, next) => db.query(
  'select set_school_staff_status($1,$2,$3,$4)', [school, staff, previous, next]);
await assert.rejects(changeStaffStatus(id(4), id(33), 'active', 'suspended'), /Invalid staff status/);
await assert.rejects(changeStaffStatus(id(11), id(32), 'active', 'suspended'), /could not be changed/);
await changeStaffStatus(id(4), id(17), 'active', 'suspended');
assert.equal((await staffDirectory(id(4))).rows.find(({ user_id }) => user_id === id(17)).status, 'suspended');
await assert.rejects(changeStaffStatus(id(4), id(17), 'active', 'suspended'), /could not be changed/);
await changeStaffStatus(id(4), id(17), 'suspended', 'active');
await db.exec(`set app.uid = '${id(17)}'`);
await assert.rejects(updateParent(id(4), id(6)), /administrator access/);
await assert.rejects(staffDirectory(id(4)), /administrator access/);
await db.exec(`reset role; delete from public.students where id = '${id(93)}'; set role authenticated; set app.uid = '${id(33)}'`);
await assert.rejects(savePhoto(id(10), null), /Learner unavailable/);
await assert.rejects(savePhoto(id(6), 'bm90YWpwZWc='), /valid JPEG/);
const photo = '/9j/AAECA//Z';
await savePhoto(id(6), photo);

await db.exec(`reset role;
  insert into auth.sessions values ('${id(34)}','${id(31)}',now() - interval '1 minute');
  set role authenticated; set app.uid = '${id(31)}'; set app.session = '${id(34)}'`);
assert.equal(await scalar('select get_my_learning_parent_status() as value'), 'temporary');
assert.deepEqual(await parentReports(), []);
assert.equal(await parentReport(id(6)), null);
await assert.rejects(db.query('select activate_learning_parent($1)', [id(31)]), /permission denied/);
await db.exec('reset role; set role service_role;');
assert.equal(await scalar('select activate_learning_parent($1) as value', [id(31)]), true);
await db.exec('set role authenticated;');
assert.equal(await parentReport(id(6)), null);
await db.exec(`reset role;
  insert into auth.sessions values ('${id(35)}','${id(31)}',now() + interval '1 second');
  set role authenticated; set app.session = '${id(35)}'`);
assert.equal((await parentReports()).length, 1);
assert.equal((await parentReport(id(6))).passport_photo, photo);
assert.equal(await parentReport(id(10)), null);
await db.exec(`reset role;
  insert into diagnoses (id,workspace_id,student_id,status,term,academic_session,reviewed_at,finalised_at,academic_strengths) values
    ('${id(51)}','${id(4)}','${id(6)}','final','First Term','2026/2027',now(),now(),'[{"statement":"Standalone finding","evidenceIds":["internal"]}]'),
    ('${id(52)}','${id(4)}','${id(6)}','draft','First Term','2026/2027',now(),now(),'[]'),
    ('${id(53)}','${id(11)}','${id(10)}','final','First Term','2026/2027',now(),now(),'[]');
`);
await db.exec(readFileSync(new URL('../supabase/migrations/20261123090000_learning_parent_diagnoses.sql', import.meta.url), 'utf8'));
await db.exec(`set role authenticated; set app.uid = '${id(31)}'`);
const parentDiagnoses = (diagnosisId) => scalar('select get_my_parent_learning_diagnoses($1) as value', [diagnosisId ?? null]);
const diagnosisList = await parentDiagnoses();
assert.deepEqual(diagnosisList.map(row => row.id).sort(), [id(30), id(51)]);
assert.equal(diagnosisList[0].diagnosis, undefined);
assert.deepEqual((await parentDiagnoses(id(51)))[0].diagnosis.academicSkillStrengths, [{ statement: 'Standalone finding' }]);
assert.deepEqual(await parentDiagnoses(id(52)), []);
assert.deepEqual(await parentDiagnoses(id(53)), []);
await db.exec(`set app.uid = '${id(2)}'`);
assert.equal((await resultReport()).passport_photo, photo);
await db.exec(`set app.uid = '${id(33)}'`);
await db.exec("reset role;");
await db.exec(readFileSync(new URL('../supabase/migrations/20261123100000_learning_term_reports.sql', import.meta.url), 'utf8'));
await db.exec(`set role authenticated; set app.uid = '${id(31)}'`);
const termArgs = [id(4), id(6), '2026/2027', 'First Term'];
const termPreview = () => scalar('select learning_term_report_preview($1,$2,$3,$4) as value', termArgs);
const publishTerm = (reportKind, ids) => scalar(
  'select publish_learning_term_report($1,$2,$3,$4,$5,$6) as value', [...termArgs, reportKind, ids],
);
const parentTermReports = (reportId = null) => scalar('select get_my_parent_term_reports($1) as value', [reportId]);
assert.deepEqual(await parentTermReports(), []);
await assert.rejects(termPreview(), /leadership access/);
await db.exec(`set app.uid = '${id(17)}'`);
const preview = await termPreview();
assert.equal(preview.assessments.length, 1);
await assert.rejects(publishTerm('term', [id(53)]), /selected assessments changed/);
const selectedTermIds = preview.assessments.map(({ id }) => id);
const publishedMidterm = await publishTerm('midterm', selectedTermIds);
await publishTerm('term', selectedTermIds);
await assert.rejects(publishTerm('term', selectedTermIds), /already published/);
await db.exec(`set app.uid = '${id(31)}'`);
assert.equal((await parentTermReports()).length, 2);
assert.equal((await parentTermReports(publishedMidterm))[0].assessments[0].id, selectedTermIds[0]);
await db.exec(`set app.uid = '${id(33)}'`);
await db.query('select revoke_learning_parent($1,$2)', [id(4), id(31)]);
await savePhoto(id(6), null);
await db.exec(`set app.uid = '${id(31)}'`);
assert.deepEqual(await parentDiagnoses(), []);
assert.deepEqual(await parentTermReports(), []);
assert.deepEqual(await parentReports(), []);
assert.equal(await parentReport(id(6)), null);
await db.exec(`set app.uid = '${id(2)}'`);
assert.equal((await resultReport()).passport_photo, null);

// Scheduled delivery uses PostgreSQL time and withholds item-level feedback until closing.
await db.exec(`reset role;
  update classes set workspace_id = '${id(4)}', name = 'JSS1';
  alter table assessments add column updated_at timestamptz not null default now();
  insert into assessments(id,workspace_id,class_id,title,status)
    values ('${id(21)}','${id(4)}','${id(5)}','Generated Test','validated');
  insert into assessment_items values
    ('${id(22)}','${id(21)}',1,'{"prompt":"Choose A","options":["a","b","c","d"]}','objective','{"correctAnswer":"a"}',3);
  update assessment_items set content = '{"prompt":"Choose B","options":["a","b","c","d"]}',
    answer_key = '{"correctAnswer":"b"}' where id = '${id(22)}';
`);
await db.exec(readFileSync(new URL('../supabase/migrations/20261122210000_learning_cbt_schedule.sql', import.meta.url), 'utf8'));
await db.exec(`set role authenticated; set app.uid = '${id(1)}'`);
const source = id(21);
const [listed] = await scalar('select list_learning_assessments($1,$2,0) as value', [id(4), 'Generated Test']);
assert.equal(listed.id, source);
assert.equal(listed.assigned, false);
const scheduled = await scalar("select schedule_learning_cbt($1, now()+interval '1 hour', now()+interval '2 hours') as value", [source]);
const [entry] = await scalar('select list_learning_assessments($1,$2,0) as value', [id(4), 'Generated Test']);
assert.equal(entry.assigned, true);
await assert.rejects(scalar("select schedule_learning_cbt($1, now()+interval '3 hours', now()+interval '4 hours') as value", [source]), /already assigned/);
await db.exec(`set app.uid = '${id(3)}'`);
assert.deepEqual(await scalar('select get_learning_cbts($1) as value',[scheduled]), []);
assert.deepEqual(await scalar('select list_learning_assessments($1,$2,0) as value', [id(4), '']), []);
await assert.rejects(scalar('select get_learning_cbt_item_insights($1) as value', [source]), /unavailable/);
await db.exec(`set app.uid = '${id(2)}'`);
const [upcoming] = await scalar('select get_learning_cbts($1) as value', [scheduled]);
assert.equal(upcoming.availability, 'scheduled');
assert.equal(upcoming.questions, null);
await assert.rejects(scalar('select submit_learning_cbt($1,$2) as value',[scheduled, '{}']), /has not opened/);
await db.exec(`reset role; update private.learning_cbts set opens_at = now()-interval '1 minute'
  where assessment_id = '${source}'; set role authenticated;`);
const [running] = await scalar('select get_learning_cbts($1) as value', [scheduled]);
assert.equal(running.availability, 'open');
assert(!Object.hasOwn(running.questions[0], 'correct'));
const result = await scalar('select submit_learning_cbt($1,$2) as value', [scheduled, JSON.stringify({[running.questions[0].id]: 'b'})]);
assert.equal(result.earned, 3);
assert(!Object.hasOwn(result, 'review'));
assert.deepEqual(await scalar('select submit_learning_cbt($1,$2) as value', [scheduled, '{}']), result);
const [inWindow] = await scalar('select get_learning_cbts($1) as value', [scheduled]);
assert(!Object.hasOwn(inWindow.feedback, 'review'));
await db.exec(`set app.uid = '${id(1)}'`);
assert.equal((await readScoreSheet(source)).roster[0].objective, 3);
assert.deepEqual(await scalar('select get_learning_cbt_item_insights($1) as value', [source]),
  [{ position: 1, prompt: 'Choose B', submitted: 1, correct: 1, blank: 0 }]);
await db.exec(`reset role; update private.learning_cbts set opens_at = now()-interval '2 minutes',
  closes_at = now()-interval '1 minute' where assessment_id = '${source}'; set role authenticated; set app.uid = '${id(2)}'`);
const [closed] = await scalar('select get_learning_cbts($1) as value', [scheduled]);
assert.equal(closed.availability, 'closed');
assert.equal(closed.feedback.review[0].correct, 'b');
await db.exec(`reset role; delete from private.learning_cbt_submissions where cbt_id = '${scheduled}'; set role authenticated;`);
await assert.rejects(scalar('select submit_learning_cbt($1,$2) as value',[scheduled, '{}']), /has closed/);
await db.exec(`reset role;
  insert into subjects values ('${id(40)}','${id(4)}','Mathematics');
  insert into assessments(id,workspace_id,class_id,title,status,subject_id) values
    ('${id(41)}','${id(4)}','${id(5)}','Early mark entry','validated','${id(40)}'),
    ('${id(42)}','${id(4)}','${id(5)}','Paper only','validated','${id(40)}');
  insert into assessment_items values
    ('${id(43)}','${id(41)}',1,'{"prompt":"Choose B","options":["a","b"]}','objective','{"correctAnswer":"b"}',3),
    ('${id(44)}','${id(41)}',2,'{"prompt":"Explain"}','subjective',null,4),
    ('${id(45)}','${id(42)}',1,'{"prompt":"Build"}','project',null,5);
`);
await db.exec(readFileSync(new URL('../supabase/migrations/20261122223000_independent_learning_mark_entry.sql', import.meta.url), 'utf8'));
await db.exec(`set role authenticated; set app.uid = '${id(1)}'`);
const openMarks = (n) => scalar('select open_learning_score_sheet($1) as value', [id(n)]);
const early = await openMarks(41);
assert.equal(await openMarks(41), early);
const writeMarks = (n, subjective, project) => scalar(
  'select save_learning_paper_scores($1,$2,0,$3,null,$4) as value', [id(n),id(6),subjective,project]);
assert.equal(await writeMarks(41, 0, null), 1);
const earlySheet = await readScoreSheet(id(41));
assert.equal(earlySheet.cbt_enabled, false);
assert.equal(earlySheet.roster[0].subjective, 0);
assert.equal(earlySheet.roster[0].objective, null);
const earlyCards = await scalar('select list_learning_assessments($1,$2,0) as value', [id(4), 'Mathematics']);
assert.equal(earlyCards.length, 2);
const earlyCard = earlyCards.find(row => row.id === id(41));
assert.equal(earlyCard.assigned, false);
assert.equal(earlyCard.marked, 1);
await db.exec(`set app.uid = '${id(2)}'`);
assert.deepEqual(await scalar('select get_learning_cbts($1) as value', [early]), []);
await assert.rejects(scalar('select submit_learning_cbt($1,$2) as value',[early, '{}']), /CBT unavailable/);
await assert.rejects(openMarks(42), /Assessment unavailable/);
await db.exec(`set app.uid = '${id(1)}'`);
assert.equal(await scalar("select schedule_learning_cbt($1,now()+interval '1 hour',now()+interval '2 hours') as value",[id(41)]), early);
assert.equal((await readScoreSheet(id(41))).roster[0].subjective, 0);
await db.exec(`reset role; update private.learning_cbts set opens_at=now()-interval '1 minute' where id='${early}';
  set role authenticated; set app.uid = '${id(2)}'`);
await scalar('select submit_learning_cbt($1,$2) as value',[early, JSON.stringify({[id(43)]: 'b'})]);
await db.exec(`set app.uid = '${id(1)}'`);
const combinedMarks = (await readScoreSheet(id(41))).roster[0];
assert.deepEqual([combinedMarks.objective, combinedMarks.subjective], [3, 0]);
await openMarks(42);
assert.equal(await writeMarks(42, null, 5), 1);
await db.query("select change_learning_result_review($1,0,'submitted',null)", [id(42)]);
await db.exec(`set app.uid = '${id(17)}'`);
await db.query("select publish_learning_result_with_comments($1,1,'{}')", [id(42)]);
await db.exec(`set app.uid = '${id(2)}'`);
const paperResult = (await publishedResults()).find(row => row.title === 'Paper only');
assert.equal(paperResult.scores.project, 5);
await db.exec(`reset role;
  alter table assessments alter column id set default gen_random_uuid(),
    add column created_by uuid, add column assessment_mode text;
  alter table assessment_items alter column id set default gen_random_uuid();
  update classes set workspace_id = '${id(4)}' where id = '${id(5)}';
`);
await db.exec(readFileSync(new URL('../supabase/migrations/20261123080000_learning_manual_project.sql', import.meta.url), 'utf8'));
const createProject = (school = id(4), maximum = 20) => scalar(
  "select create_learning_project($1,$2,$3,'Build a model','2026/2027','First Term',$4) as value",
  [school, id(5), id(40), maximum],
);
await db.exec(`set role authenticated; set app.uid = '${id(2)}'`);
await assert.rejects(createProject(), /Choose a class and subject/);
await db.exec(`set role authenticated; set app.uid = '${id(1)}'`);
await assert.rejects(createProject(id(11)), /Choose a class and subject/);
await assert.rejects(createProject(id(4), 0), /valid maximum mark/);
const manualProject = await createProject();
const projectSheet = await readScoreSheet(manualProject);
assert.equal(projectSheet.maxima.project, 20);
assert.equal(projectSheet.cbt_enabled, false);
assert.equal(projectSheet.roster[0].project, null);
await scalar('select save_learning_paper_scores($1,$2,0,null,null,0) as value', [manualProject, id(6)]);
await db.query("select change_learning_result_review($1,0,'submitted',null)", [manualProject]);
await db.exec(`set app.uid = '${id(17)}'`);
await db.query("select publish_learning_result_with_comments($1,1,'{}')", [manualProject]);
await db.exec(`set app.uid = '${id(2)}'`);
assert.equal((await publishedResults()).find(row => row.title === 'Build a model').scores.project, 0);
await db.exec('reset role');
await db.exec(readFileSync(new URL('../supabase/migrations/20261123110000_learning_excused_marks.sql', import.meta.url), 'utf8'));
await db.exec(`set role authenticated; set app.uid = '${id(1)}'`);
const excusedProject = await createProject();
const saveExcused = (revision, keys) => scalar(
  'select save_learning_marks($1,$2,$3,null,null,null,$4) as value', [excusedProject, id(6), revision, keys],
);
const submitExcused = () => db.query("select change_learning_result_review($1,0,'submitted',null)", [excusedProject]);
await assert.rejects(submitExcused(), /Save all required marks/);
await assert.rejects(saveExcused(0, ['objective']), /applicable sections/);
assert.equal(await saveExcused(0, ['project']), 1);
await assert.rejects(saveExcused(0, []), /Scores changed/);
assert.deepEqual((await readScoreSheet(excusedProject)).roster[0].excused, ['project']);
await submitExcused();
await assert.rejects(saveExcused(1, []), /locked/);
await db.exec(`set app.uid = '${id(17)}'`);
await db.query("select publish_learning_result_with_comments($1,1,'{}')", [excusedProject]);
await db.exec(`set app.uid = '${id(2)}'`);
const reportWithExcusal = (await publishedResults()).find(row => row.scores.excused?.includes('project'));
assert.equal(reportWithExcusal.scores.project, null);
await db.exec(`reset role;
  alter table student_accounts add column updated_at timestamptz;
  update auth.users set raw_app_meta_data = jsonb_build_object('ksi_school_learner', '${id(6)}') where id = '${id(2)}';
`);
await db.exec(readFileSync(new URL('../supabase/migrations/20261123120000_learning_temporary_password.sql', import.meta.url), 'utf8'));
const setPasswordPending = (pending) => scalar('select set_learner_password_pending($1,$2,$3) as value', [id(2), id(6), pending]);
await db.exec(`set role authenticated; set app.uid = '${id(2)}'`);
await assert.rejects(setPasswordPending(true), /permission denied/);
await db.exec('reset role; set role service_role;');
assert.equal(await setPasswordPending(true), true);
await db.exec('set role authenticated;');
await assert.rejects(publishedResults(), /active learner account/);
await db.exec('reset role; set role service_role;');
assert.equal(await setPasswordPending(false), true);
assert.equal(await setPasswordPending(false), false);
await db.exec('set role authenticated;');
assert.ok((await publishedResults()).length > 0);
await db.close();
console.log('CBT migration passed PostgreSQL checks for assignment, school isolation, answer visibility, grading and submission retries.');
