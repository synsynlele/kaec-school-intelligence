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
  create table students(id uuid primary key, workspace_id uuid, class_id uuid, active boolean);
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
await db.close();
console.log('CBT migration passed PostgreSQL checks for assignment, school isolation, answer visibility, grading and submission retries.');
