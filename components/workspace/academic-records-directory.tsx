"use client";

import { useMemo, useState } from "react";

import {
  listAcademicClasses,
  listAcademicStudents,
  listAcademicSubjects,
  matchesAcademicSearch,
  type DirectorySort,
  type DirectoryStatus,
} from "@/lib/workspace/academic-directory";
import type { Database } from "@/lib/supabase/database";
import { isTemporaryClassLabel } from "@/lib/domain/academic-context";
import { RecordListPagination, type RecordPageSize } from "@/components/shared/record-list-pagination";
import { RecordListToolbar } from "@/components/shared/record-list-toolbar";

type Subject = Database["public"]["Tables"]["subjects"]["Row"];
type SchoolClass = Database["public"]["Tables"]["classes"]["Row"];
type Student = Database["public"]["Tables"]["students"]["Row"];
type Kind = "class" | "student" | "subject";
type Selection = { kind: "student" | "subject"; id: string };

type Props = {
  classes: SchoolClass[];
  students: Student[];
  subjects: Subject[];
  canManage: boolean;
  busy: boolean;
  onEditSubject: (subject: Subject) => void;
  onEditClass: (schoolClass: SchoolClass) => void;
  onEditStudent: (student: Student) => void;
  onToggle: (kind: Kind, id: string, active: boolean) => void;
  onDelete: (kind: Kind, id: string, name: string) => void;
};

const CATEGORY_LABELS: Record<Kind, string> = {
  class: "Classes",
  student: "Students",
  subject: "Subjects",
};

const SORT_OPTIONS: Record<Kind, { value: DirectorySort; label: string }[]> = {
  class: [
    { value: "name_asc", label: "Class A–Z" },
    { value: "name_desc", label: "Class Z–A" },
    { value: "enrollment_desc", label: "Most students" },
  ],
  student: [
    { value: "name_asc", label: "Name A–Z" },
    { value: "name_desc", label: "Name Z–A" },
    { value: "class_asc", label: "Class A–Z" },
  ],
  subject: [
    { value: "name_asc", label: "Subject A–Z" },
    { value: "name_desc", label: "Subject Z–A" },
    { value: "code_asc", label: "Code A–Z" },
  ],
};

function Status({ active }: { active: boolean }) {
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${active ? "bg-emerald-50 text-emerald-800" : "bg-zinc-100 text-zinc-500"}`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function DetailValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-zinc-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-zinc-900">{children}</dd>
    </div>
  );
}

export function AcademicRecordsDirectory({
  classes, students, subjects, canManage, busy,
  onEditSubject, onEditClass, onEditStudent, onToggle, onDelete,
}: Props) {
  const [tab, setTab] = useState<Kind>("class");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<DirectoryStatus>("all");
  const [sort, setSort] = useState<DirectorySort>("name_asc");
  const [classFilter, setClassFilter] = useState("all");
  const [selected, setSelected] = useState<Selection | null>(null);
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [rosterSearch, setRosterSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<RecordPageSize>(20);

  const classNames = useMemo(() => new Map(classes.map((item) => [item.id, item.name])), [classes]);
  const classCounts = useMemo(() => {
    const counts = new Map<string, number>();
    students.forEach((item) => {
      if (item.class_id) counts.set(item.class_id, (counts.get(item.class_id) ?? 0) + 1);
    });
    return counts;
  }, [students]);

  const filtered = useMemo(() => {
    const common = { query: search, status, sort };
    if (tab === "class") return listAcademicClasses(classes, students, common);
    if (tab === "student") return listAcademicStudents(students, classNames, { ...common, classId: classFilter });
    return listAcademicSubjects(subjects, common);
  }, [tab, classes, students, subjects, classNames, classFilter, search, status, sort]);

  const total = tab === "class" ? classes.length : tab === "student" ? students.length : subjects.length;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const selectedStudent = selected?.kind === "student" ? students.find((item) => item.id === selected.id) : null;
  const selectedSubject = selected?.kind === "subject" ? subjects.find((item) => item.id === selected.id) : null;
  const expandedRoster = useMemo(
    () => students
      .filter((item) => item.class_id === expandedClassId)
      .sort((a, b) => a.display_name.localeCompare(b.display_name, undefined, { numeric: true })),
    [students, expandedClassId],
  );
  const visibleRoster = useMemo(
    () => expandedRoster.filter((item) =>
      matchesAcademicSearch([item.display_name, item.external_reference], rosterSearch),
    ),
    [expandedRoster, rosterSearch],
  );

  function changeTab(nextTab: Kind, filter = "all") {
    setTab(nextTab);
    setSearch("");
    setStatus("all");
    setSort("name_asc");
    setClassFilter(filter);
    setPage(1);
    setSelected(null);
    setExpandedClassId(null);
    setRosterSearch("");
  }

  function view(kind: "student" | "subject", id: string) {
    setSelected((current) => current?.kind === kind && current.id === id ? null : { kind, id });
    window.setTimeout(() => {
      document.getElementById("academic-directory-detail")?.scrollIntoView({
        behavior: "smooth", block: "nearest",
      });
    }, 0);
  }

  function toggleClass(classId: string) {
    setSelected(null);
    setRosterSearch("");
    setExpandedClassId((current) => current === classId ? null : classId);
  }

  const buttonStyle = "min-h-10 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50";
  const activeStyle = "min-h-10 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50";

  function actions(kind: Kind, item: Subject | SchoolClass | Student, name: string) {
    if (!canManage) return null;
    const edit = () => {
      if (kind === "class") onEditClass(item as SchoolClass);
      else if (kind === "student") onEditStudent(item as Student);
      else onEditSubject(item as Subject);
    };
    return (
      <div className="mt-5 flex flex-wrap gap-2 border-t border-zinc-100 pt-4">
        <button type="button" className={buttonStyle} disabled={busy} onClick={edit}>Edit</button>
        <button type="button" className={buttonStyle} disabled={busy} onClick={() => onToggle(kind, item.id, !item.active)}>
          {item.active ? "Deactivate" : "Reactivate"}
        </button>
        <button type="button" className={activeStyle} disabled={busy} onClick={() => onDelete(kind, item.id, name)}>Delete</button>
      </div>
    );
  }

  return (
    <section className="mt-7 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6" aria-label="School records directory">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-800">School directory</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">Find and manage records</h2>
          <p className="mt-1 text-sm text-zinc-500">Choose a category, search or sort, then tap a record to see its details.</p>
        </div>
        <p className="text-xs font-medium text-zinc-500">{classes.length} classes · {students.length} students · {subjects.length} subjects</p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2" aria-label="Record categories">
        {(["class", "student", "subject"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            aria-pressed={tab === kind}
            onClick={() => changeTab(kind)}
            className={`min-w-0 rounded-xl border px-2 py-3 text-center text-sm font-semibold transition sm:px-4 ${
              tab === kind
                ? "border-emerald-900 bg-emerald-950 text-white"
                : "border-zinc-200 bg-stone-50 text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            {CATEGORY_LABELS[kind]}
            <span className={`ml-1 text-xs ${tab === kind ? "text-emerald-100" : "text-zinc-500"}`}>
              {kind === "class" ? classes.length : kind === "student" ? students.length : subjects.length}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4">
        <RecordListToolbar
          searchValue={search}
          onSearchChange={(value) => { setSearch(value); setPage(1); setSelected(null); setExpandedClassId(null); }}
          searchPlaceholder={tab === "class" ? "Search class, session, age…" : tab === "student" ? "Search name, class, admission reference…" : "Search subject name or code…"}
          sortValue={sort}
          onSortChange={(value) => { setSort(value as DirectorySort); setPage(1); }}
          sortOptions={SORT_OPTIONS[tab]}
          filters={
            <>
              {tab === "student" ? (
                <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 text-sm">
                  <span className="shrink-0 text-xs font-semibold text-zinc-500">Class</span>
                  <select
                    aria-label="Filter students by class"
                    className="min-w-0 max-w-52 bg-white py-2 text-sm font-medium text-zinc-800"
                    value={classFilter}
                    onChange={(event) => { setClassFilter(event.target.value); setPage(1); setSelected(null); }}
                  >
                    <option value="all">All classes</option>
                    {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    <option value="unassigned">Not assigned</option>
                  </select>
                </label>
              ) : null}
              <label className="flex min-h-11 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 text-sm">
                <span className="text-xs font-semibold text-zinc-500">Status</span>
                <select
                  aria-label="Filter records by status"
                  value={status}
                  onChange={(event) => { setStatus(event.target.value as DirectoryStatus); setPage(1); setSelected(null); setExpandedClassId(null); }}
                  className="min-w-0 bg-white py-2 text-sm font-medium text-zinc-800"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </>
          }
          visibleCount={filtered.length}
          totalCount={total}
        />
      </div>

      {selectedStudent || selectedSubject ? (
        <section id="academic-directory-detail" aria-label="Selected record details" className="mt-4 scroll-mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Record details</p>
              <h3 className="mt-1 break-words text-xl font-semibold text-zinc-950">
                {selectedStudent?.display_name ?? selectedSubject?.name}
              </h3>
            </div>
            <button type="button" className={buttonStyle} onClick={() => setSelected(null)} aria-label="Close record details">Close</button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div><DetailValue label="Status"><Status active={(selectedStudent ?? selectedSubject)!.active} /></DetailValue></div>
            {selectedStudent ? (
              <>
                <DetailValue label="Class">
                  {selectedStudent.class_id ? (
                    <button type="button" className="text-emerald-900 underline underline-offset-2" onClick={() => {
                      changeTab("class");
                      setExpandedClassId(selectedStudent.class_id!);
                    }}>
                      {classNames.get(selectedStudent.class_id) ?? "Assigned class"}
                    </button>
                  ) : "Not assigned"}
                </DetailValue>
                <DetailValue label="Admission reference">{selectedStudent.external_reference || "Not set"}</DetailValue>
              </>
            ) : selectedSubject ? (
              <DetailValue label="Subject code">{selectedSubject.code || "Not set"}</DetailValue>
            ) : null}
          </div>
          {selectedStudent ? actions("student", selectedStudent, selectedStudent.display_name)
            : selectedSubject ? actions("subject", selectedSubject, selectedSubject.name) : null}
        </section>
      ) : null}

      <div className="mt-4 divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200">
        {paged.length ? paged.map((item) => {
          const name = tab === "student" ? (item as Student).display_name : (item as SchoolClass | Subject).name;
          const secondary = tab === "class"
            ? `${classCounts.get(item.id) ?? 0} students · ${(item as SchoolClass).academic_session || "Session not set"}`
            : tab === "student"
              ? `${(item as Student).class_id ? classNames.get((item as Student).class_id!) ?? "Assigned class" : "Not assigned"}${(item as Student).external_reference ? " · " + (item as Student).external_reference : ""}`
              : (item as Subject).code || "No subject code";
          const isClassExpanded = tab === "class" && expandedClassId === item.id;
          const isSelected = tab !== "class" && selected?.kind === tab && selected.id === item.id;
          return (
            <div key={item.id}>
              <button
                type="button"
                aria-expanded={isClassExpanded || isSelected}
                aria-controls={isClassExpanded ? `class-roster-${item.id}` : undefined}
                onClick={() => tab === "class" ? toggleClass(item.id) : view(tab, item.id)}
                className={`flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-stone-50 sm:px-5 ${
                  isClassExpanded || isSelected ? "bg-emerald-50/80" : "bg-white"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-words text-sm font-semibold text-zinc-900">{name}</span>
                    <Status active={item.active} />
                    {tab === "class" && isTemporaryClassLabel(name) ? (
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">Needs rename — use the actual class name</span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-xs text-zinc-500">{secondary}</p>
                </div>
                <span aria-hidden="true" className="shrink-0 text-lg text-zinc-400">{isClassExpanded ? "⌄" : "›"}</span>
              </button>
              {isClassExpanded ? (
                <div id={`class-roster-${item.id}`} className="border-t border-emerald-100 bg-emerald-50/40 px-4 py-4 sm:px-5" aria-label={`Students in ${name}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-zinc-950">Students in {name} ({expandedRoster.length})</h3>
                    <button type="button" onClick={() => changeTab("student", item.id)} className="min-h-9 text-xs font-semibold text-emerald-900 underline underline-offset-2">
                      Open student directory
                    </button>
                  </div>
                  {expandedRoster.length ? (
                    <>
                      <label className="mt-3 block">
                        <span className="sr-only">Search students in {name}</span>
                        <input
                          type="search"
                          value={rosterSearch}
                          onChange={(event) => setRosterSearch(event.target.value)}
                          placeholder="Search students in this class…"
                          className="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-700"
                        />
                      </label>
                      <p className="mt-2 text-xs text-zinc-500">Showing {visibleRoster.length} of {expandedRoster.length} students</p>
                      <ul className="mt-2 max-h-80 divide-y divide-zinc-100 overflow-y-auto rounded-xl border border-zinc-200 bg-white">
                        {visibleRoster.map((student) => (
                          <li key={student.id}>
                            <button
                              type="button"
                              onClick={() => { changeTab("student", item.id); setSelected({ kind: "student", id: student.id }); }}
                              className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-zinc-800 hover:bg-stone-50"
                            >
                              <span className="min-w-0 truncate">{student.display_name}</span>
                              <span className="shrink-0 text-xs text-zinc-500">{student.active ? "" : "Inactive"} ›</span>
                            </button>
                          </li>
                        ))}
                        {!visibleRoster.length ? <li className="px-3 py-4 text-sm text-zinc-500">No students match that search.</li> : null}
                      </ul>
                    </>
                  ) : <p className="mt-3 text-sm text-zinc-500">No students assigned to this class yet.</p>}
                  {actions("class", item as SchoolClass, name)}
                </div>
              ) : null}
            </div>
          );
        }) : <p className="px-5 py-8 text-center text-sm text-zinc-500">
          {total === 0 ? `No ${CATEGORY_LABELS[tab].toLowerCase()} added yet.` : "No records match these filters. Try clearing your search or changing the class or status."}
        </p>}
      </div>
      <div className="mt-4">
        <RecordListPagination
          page={safePage}
          pageSize={pageSize}
          totalItems={filtered.length}
          onPageChange={(value) => { setPage(value); setExpandedClassId(null); setSelected(null); }}
          onPageSizeChange={(value) => { setPageSize(value); setPage(1); setSelected(null); setExpandedClassId(null); }}
        />
      </div>
    </section>
  );
}
