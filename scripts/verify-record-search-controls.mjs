import fs from "node:fs";

const targets = [
  ["components/saved-work/saved-work-client.tsx", ["RecordListToolbar", "RecordListPagination", "searchQuery", "sortOrder", "pageSize"]],
  ["components/hqls/hqls-client.tsx", ["RecordListToolbar", "RecordListPagination", "visibleLessons", "lessonStatus", "lessonSort", "lessonPageSize"]],
  ["components/assessment/world-class-assessment-client.tsx", ["RecordListToolbar", "RecordListPagination", "visibleAssessments", "assessmentStatus", "assessmentSort", "assessmentPageSize"]],
  ["components/diagnosis/diagnosis-builder-client.tsx", ["RecordListToolbar", "RecordListPagination", "visibleDiagnoses", "diagnosisStatus", "diagnosisSort", "diagnosisPageSize"]],
  ["components/interventions/intervention-workspace-client.tsx", ["RecordListToolbar", "RecordListPagination", "visibleDiagnoses", "visibleHandoffs", "planStatus", "diagnosisPageSize", "planPageSize"]],
  ["components/resources/academic-resources-client.tsx", ["RecordListToolbar", "visibleSchemeEntries", "visibleSchoolResources"]],
  ["components/resources/resource-library-client.tsx", ["RecordListToolbar", "visibleResources", "libraryType"]],
  ["components/hqls/hqls-exports-client.tsx", ["RecordListToolbar", "RecordListPagination", "visibleLessons", "statusFilter", "pageSize"]],
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

const pagination = fs.readFileSync("components/shared/record-list-pagination.tsx", "utf8");
for (const token of ["RecordPageSize", "20", "50", "100", "Previous", "Next", "totalItems"]) {
  if (!pagination.includes(token)) {
    throw new Error(`RecordListPagination is missing required UI contract: ${token}`);
  }
}

console.log("Record search/filter/sort/pagination verification passed.");
