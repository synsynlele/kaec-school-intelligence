import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { diagnosisStudentsForClass } from "../lib/diagnosis/student-picker";

const students = [
  { id: "a", name: "Amina", classId: "jss1", className: "JSS1" },
  { id: "b", name: "Amina", classId: "jss2", className: "JSS2" },
  { id: "c", name: "Bola", classId: "jss1", className: "JSS1" },
  { id: "d", name: "Chika", classId: null, className: "Class not linked" },
];
assert.deepEqual(diagnosisStudentsForClass(students, "").map(({ id }) => id), []);
assert.deepEqual(diagnosisStudentsForClass(students, "jss1").map(({ id }) => id), ["a", "c"]);
assert.deepEqual(diagnosisStudentsForClass(students, "jss2").map(({ id }) => id), ["b"]);
assert.deepEqual(diagnosisStudentsForClass(students, "jss3"), []);
assert.deepEqual(diagnosisStudentsForClass(students, "unassigned").map(({ id }) => id), ["d"]);
assert.deepEqual(diagnosisStudentsForClass(students, "all").map(({ id }) => id), ["a", "b", "c", "d"]);

const api = readFileSync("app/api/diagnosis/route.ts", "utf8");
const ui = readFileSync("components/diagnosis/diagnosis-builder-client.tsx", "utf8");
assert(api.includes("classes: (classesResult.data ?? []).map("), "Diagnosis API must expose workspace class options.");
assert(ui.includes('onChange={(event) => onClassChange(event.target.value)}'), "Diagnosis class selector missing.");
assert(ui.includes('setStudentId("");'), "Switching class must reset the previous learner.");
assert(ui.includes('disabled={!classFilter || !eligibleStudents.length}'), "Learner selector must wait for a class choice.");
assert(ui.includes("eligibleStudents.map((student)"), "Only class-filtered learners should appear.");
assert(ui.includes('classSessions[nextClassId] ?? ""'), "Switching class must reset or populate academic session.");
console.log("Diagnosis class-to-learner selection verification passed.");
