export type DiagnosisStudentOption = {
  id: string;
  name: string;
  classId: string | null;
  className: string;
};

/** Only offer learners from the chosen class; an empty filter requires a class choice. */
export function diagnosisStudentsForClass<T extends DiagnosisStudentOption>(
  students: readonly T[],
  classFilter: string,
): T[] {
  if (!classFilter) return [];
  if (classFilter === "all") return [...students];
  if (classFilter === "unassigned") return students.filter((student) => !student.classId);
  return students.filter((student) => student.classId === classFilter);
}
