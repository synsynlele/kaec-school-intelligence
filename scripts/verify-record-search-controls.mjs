import fs from "node:fs";

const targets = [
  ["components/saved-work/saved-work-client.tsx", ["RecordListToolbar", "searchQuery", "sortOrder"]],
  ["components/hqls/hqls-client.tsx", ["RecordListToolbar", "visibleLessons", "lessonStatus", "lessonSort"]],
  ["components/assessment/world-class-assessment-client.tsx", ["RecordListToolbar", "visibleAssessments", "assessmentStatus", "assessmentSort"]],
  ["components/diagnosis/diagnosis-builder-client.tsx", ["RecordListToolbar", "visibleDiagnoses", "diagnosisStatus", "diagnosisSort"]],
  ["components/interventions/intervention-workspace-client.tsx", ["RecordListToolbar", "visibleDiagnoses", "visibleHandoffs", "planStatus"]],
  ["components/resources/academic-resources-client.tsx", ["RecordListToolbar", "visibleSchemeEntries", "visibleSchoolResources"]],
  ["components/resources/resource-library-client.tsx", ["RecordListToolbar", "visibleResources", "libraryType"]],
  ["components/hqls/hqls-exports-client.tsx", ["RecordListToolbar", "visibleLessons", "statusFilter"]],
];

for (const [file, required] of targets) {
  const content = fs.readFileSync(file, "utf8");
  for (const token of required) {
    if (!content.includes(token)) {
      throw new Error(`${file} is missing required search/sort contract: ${token}`);
    }
  }
}

const toolbar = fs.readFileSync("components/shared/record-list-toolbar.tsx", "utf8");
for (const token of ['type="search"', "Clear", "sortOptions", "visibleCount", "totalCount"]) {
  if (!toolbar.includes(token)) {
    throw new Error(`RecordListToolbar is missing required UI contract: ${token}`);
  }
}

console.log("Record search/filter/sort verification passed.");
