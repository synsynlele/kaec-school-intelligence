export type DirectoryStatus = "all" | "active" | "inactive";
export type DirectorySort = "name_asc" | "name_desc" | "class_asc" | "enrollment_desc" | "code_asc";

type QueryOptions = { query: string; status: DirectoryStatus; sort: DirectorySort };
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export function matchesAcademicSearch(haystack: Array<string | null | undefined>, query: string): boolean {
  const text = haystack.filter(Boolean).join(" ").toLocaleLowerCase();
  return query.toLocaleLowerCase().trim().split(/\s+/).every((term) => text.includes(term));
}

function matchesStatus(active: boolean, status: DirectoryStatus): boolean {
  return status === "all" || (status === "active" ? active : !active);
}

export function listAcademicClasses<
  T extends { id: string; name: string; active: boolean; age_range: string | null; academic_session: string | null },
>(
  classes: readonly T[],
  students: readonly { class_id: string | null }[],
  options: QueryOptions,
): T[] {
  const counts = new Map<string, number>();
  for (const student of students) {
    if (student.class_id) counts.set(student.class_id, (counts.get(student.class_id) ?? 0) + 1);
  }
  return classes
    .filter((item) => matchesStatus(item.active, options.status) && matchesAcademicSearch(
      [item.name, item.age_range, item.academic_session], options.query,
    ))
    .sort((a, b) => {
      if (options.sort === "enrollment_desc") {
        const diff = (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0);
        if (diff) return diff;
      }
      const names = collator.compare(a.name, b.name);
      return options.sort === "name_desc" ? -names : names;
    });
}

export function listAcademicStudents<
  T extends { id: string; display_name: string; class_id: string | null; active: boolean; external_reference: string | null },
>(
  students: readonly T[],
  classNames: ReadonlyMap<string, string>,
  options: QueryOptions & { classId: string },
): T[] {
  return students
    .filter((student) => {
      const classMatches = options.classId === "all" ||
        (options.classId === "unassigned" ? !student.class_id : student.class_id === options.classId);
      return classMatches &&
        matchesStatus(student.active, options.status) &&
        matchesAcademicSearch([
          student.display_name,
          student.external_reference,
          student.class_id ? classNames.get(student.class_id) : "unassigned",
        ], options.query);
    })
    .sort((a, b) => {
      if (options.sort === "class_asc") {
        const classCompare = collator.compare(
          a.class_id ? classNames.get(a.class_id) ?? "" : "",
          b.class_id ? classNames.get(b.class_id) ?? "" : "",
        );
        if (classCompare) return classCompare;
      }
      const nameCompare = collator.compare(a.display_name, b.display_name);
      return options.sort === "name_desc" ? -nameCompare : nameCompare || collator.compare(a.id, b.id);
    });
}

export function listAcademicSubjects<
  T extends { id: string; name: string; code: string | null; active: boolean },
>(subjects: readonly T[], options: QueryOptions): T[] {
  return subjects
    .filter((subject) =>
      matchesStatus(subject.active, options.status) &&
      matchesAcademicSearch([subject.name, subject.code], options.query),
    )
    .sort((a, b) => {
      if (options.sort === "code_asc") {
        const codeCompare = collator.compare(a.code ?? "", b.code ?? "");
        if (codeCompare) return codeCompare;
      }
      const nameCompare = collator.compare(a.name, b.name);
      return options.sort === "name_desc" ? -nameCompare : nameCompare;
    });
}
