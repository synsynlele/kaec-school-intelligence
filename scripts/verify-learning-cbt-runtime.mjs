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
await review(3, 'published');
assert.equal((await reviewSheet()).status, 'published');
await db.exec(`set app.uid = '${id(2)}'`);
const [official] = await publishedResults();
assert.deepEqual(official.scores, { objective: 2, subjective: 0, critical_thinking: 4, project: 3 });
await db.exec(`set app.uid = '${id(3)}'`);
assert.deepEqual(await publishedResults(), []);
await db.exec(`set app.uid = '${id(1)}'`);
await assert.rejects(saveScores(id(6), 5, 0, 4, 5), /Scores are locked/);
await db.close();
console.log('CBT migration passed PostgreSQL checks for assignment, school isolation, answer visibility, grading and submission retries.');
