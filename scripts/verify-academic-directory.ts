import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  listAcademicClasses,
  listAcademicStudents,
  listAcademicSubjects,
  matchesAcademicSearch,
} from "../lib/workspace/academic-directory";

const classes = [
  { id: "j10", name: "JSS 10", active: true, age_range: "13–14", academic_session: "2026/2027" },
  { id: "j2", name: "JSS 2", active: true, age_range: "11–12", academic_session: "2026/2027" },
  { id: "j1", name: "JSS 1", active: false, age_range: "10–11", academic_session: "2025/2026" },
];
const students = [
  { id: "s1", display_name: "Amina Bello", active: true, class_id: "j2", external_reference: "ADM-220" },
  { id: "s2", display_name: "Bola Ade", active: true, class_id: "j2", external_reference: "ADM-221" },
  { id: "s3", display_name: "Amina Bello", active: false, class_id: "j10", external_reference: "ADM-230" },
  { id: "s4", display_name: "Chika Obi", active: true, class_id: null, external_reference: null },
];
const subjects = [
  { id: "m", name: "Mathematics", code: "MATH", active: true },
  { id: "e", name: "English Language", code: "ENG", active: true },
  { id: "a", name: "Agricultural Science", code: null, active: false },
];
const names = new Map(classes.map((item) => [item.id, item.name]));
const opts = { query: "", status: "all" as const, sort: "name_asc" as const };
const ids = <T extends { id: string }>(items: T[]) => items.map(({ id }) => id);

assert(matchesAcademicSearch(["Amina Bello", "JSS 2"], "amina JSS"), "Multi-term search must work across fields.");
assert(!matchesAcademicSearch(["Amina Bello", "JSS 2"], "amina JSS3"), "Each search term must match.");
assert.deepEqual(ids(listAcademicClasses(classes, students, opts)), ["j1", "j2", "j10"], "Class names must sort numerically.");
assert.deepEqual(ids(listAcademicClasses(classes, students, { ...opts, sort: "enrollment_desc" })), ["j2", "j10", "j1"]);
assert.deepEqual(ids(listAcademicClasses(classes, students, { ...opts, query: "2025" })), ["j1"], "Find class via session.");
assert.deepEqual(ids(listAcademicClasses(classes, students, { ...opts, status: "active" })), ["j2", "j10"]);
assert.deepEqual(ids(listAcademicStudents(students, names, { ...opts, classId: "j2" })), ["s1", "s2"]);
assert.deepEqual(ids(listAcademicStudents(students, names, { ...opts, classId: "unassigned" })), ["s4"]);
assert.deepEqual(ids(listAcademicStudents(students, names, { ...opts, classId: "all", query: "ADM-230" })), ["s3"]);
assert.deepEqual(ids(listAcademicStudents(students, names, { ...opts, classId: "all", query: "Amina", status: "active" })), ["s1"]);
assert.deepEqual(ids(listAcademicStudents(students, names, { ...opts, classId: "all", sort: "class_asc" })), ["s4", "s1", "s2", "s3"]);
assert.deepEqual(ids(listAcademicSubjects(subjects, { ...opts, query: "ENG" })), ["e"]);
assert.deepEqual(ids(listAcademicSubjects(subjects, { ...opts, status: "inactive" })), ["a"]);
assert.deepEqual(ids(listAcademicSubjects(subjects, { ...opts, sort: "name_desc" })), ["m", "e", "a"]);

const ui = readFileSync("components/workspace/academic-records-directory.tsx", "utf8");
const setup = readFileSync("components/workspace/academic-setup-client.tsx", "utf8");
for (const requirement of [
  "RecordListToolbar",
  "RecordListPagination",
  "changeTab",
  "expandedRoster",
  "visibleRoster.map((student)",
  "toggleClass",
  "aria-controls={isClassExpanded",
  "Search students in this class",
  'changeTab("student", item.id)',
  "onEditStudent",
  "onDelete",
  "classFilter",
  "setSearch",
  "setStatus",
  "setSort",
  "setPageSize",
]) {
  assert(ui.includes(requirement), `Academic directory must support ${requirement}`);
}
assert(setup.includes("<AcademicRecordsDirectory"), "School records must use the new focused directory.");
assert(setup.includes("School branding") && setup.includes("Add records") && setup.includes("<details"), "Secondary setup forms must be collapsed.");
assert(!setup.includes("<DataCard"), "Old triple-column unbounded record lists must be removed.");
assert(!ui.includes("selectedRoster.slice(0, 8)"), "Class expansion must show every student, not just an eight-person preview.");
assert(ui.includes("max-h-80") && ui.includes("overflow-y-auto"), "Long class rosters must scroll without taking over the page.");
console.log("Academic directory search, natural sort, status, class drilldown, pagination and clean setup verification passed.");
