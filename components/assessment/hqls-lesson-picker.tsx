"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { MAX_ASSESSMENT_SOURCE_LESSONS } from "@/lib/assessment/source-lessons";

type Lesson = {
  id: string;
  title: string;
  topic: string;
  objective: string;
  subject_id: string | null;
  class_id: string | null;
  status: string;
};

type NamedOption = { id: string; name: string };

type Props = {
  lessons: Lesson[];
  subjects: NamedOption[];
  classes: NamedOption[];
  selectedIds: string[];
  onApply: (lessonIds: string[]) => string | null;
};

function normalizedTopic(topic: string) {
  return topic.trim().toLocaleLowerCase();
}

export function HqlsLessonPicker({ lessons, subjects, classes, selectedIds, onApply }: Props) {
  const headingId = useId();
  const hintId = useId();
  const [open, setOpen] = useState(false);
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [classId, setClassId] = useState("");
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(30);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const subjectName = new Map(subjects.map((item) => [item.id, item.name]));
  const className = new Map(classes.map((item) => [item.id, item.name]));
  const chosenLessons = selectedIds.map((id) => lessonById.get(id)).filter((lesson): lesson is Lesson => Boolean(lesson));
  const draftedLessons = draftIds.map((id) => lessonById.get(id)).filter((lesson): lesson is Lesson => Boolean(lesson));
  const reference = draftedLessons[0] ?? null;

  const matchingLessons = (() => {
    const q = search.trim().toLocaleLowerCase();
    return lessons
      .filter((lesson) => lesson.status === "validated")
      .filter((lesson) => !reference ||
        (lesson.subject_id === reference.subject_id && lesson.class_id === reference.class_id))
      .filter((lesson) => !subjectId || lesson.subject_id === subjectId)
      .filter((lesson) => !classId || lesson.class_id === classId)
      .filter((lesson) => !q || [
        lesson.topic,
        lesson.title,
        subjectName.get(lesson.subject_id ?? "") ?? "",
        className.get(lesson.class_id ?? "") ?? "",
      ].some((value) => value.toLocaleLowerCase().includes(q)))
      .sort((a, b) => Number(draftIds.includes(b.id)) - Number(draftIds.includes(a.id)));
  })();

  const availableSubjects = subjects.filter((subject) =>
    lessons.some((lesson) => lesson.status === "validated" && lesson.subject_id === subject.id)
  );
  const availableClasses = classes.filter((schoolClass) =>
    lessons.some((lesson) =>
      lesson.status === "validated" &&
      lesson.class_id === schoolClass.id &&
      (!subjectId || lesson.subject_id === subjectId)
    )
  );

  function openPicker() {
    setDraftIds([...selectedIds]);
    setSearch("");
    setSubjectId("");
    setClassId("");
    setPickerError(null);
    setVisibleLimit(30);
    setOpen(true);
  }

  function dismissPicker() {
    setOpen(false);
    setPickerError(null);
  }

  function toggleLesson(lesson: Lesson) {
    setPickerError(null);
    setVisibleLimit(30);
    if (draftIds.includes(lesson.id)) {
      const remaining = draftIds.filter((id) => id !== lesson.id);
      if (!remaining.length) {
        setSubjectId("");
        setClassId("");
      }
      setDraftIds(remaining);
      return;
    }
    if (draftIds.length >= MAX_ASSESSMENT_SOURCE_LESSONS) {
      setPickerError("You can select up to " + MAX_ASSESSMENT_SOURCE_LESSONS + " HQLS topics per assessment.");
      return;
    }
    if (reference && (lesson.class_id !== reference.class_id || lesson.subject_id !== reference.subject_id)) {
      setPickerError("Choose lessons from one subject and class. Clear the current selection to switch.");
      return;
    }
    if (draftedLessons.some((item) => normalizedTopic(item.topic) === normalizedTopic(lesson.topic))) {
      setPickerError("This topic is already selected. Choose only one HQLS lesson for each topic.");
      return;
    }
    setDraftIds((current) => [...current, lesson.id]);
    // Once the first lesson is chosen, compatibility automatically scopes the list.
    setSubjectId("");
    setClassId("");
  }

  function confirmSelection() {
    const error = onApply(draftIds);
    if (error) {
      setPickerError(error);
      return;
    }
    dismissPicker();
  }

  useEffect(() => {
    if (!open) return;
    const oldOverflow = document.body.style.overflow;
    const lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      (triggerRef.current ?? lastFocused)?.focus();
    };
  }, [open]);

  return (
    <div className="min-w-0 sm:col-span-2">
      <div className="min-w-0 rounded-2xl border border-zinc-200 bg-stone-50 p-3 sm:p-4">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-950">HQLS lesson topics</p>
            <p className="mt-0.5 text-xs leading-5 text-zinc-600">
              Optional · Import several taught topics into one assessment.
            </p>
          </div>
          {selectedIds.length ? (
            <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900">
              {selectedIds.length} selected
            </span>
          ) : null}
        </div>
        <button
          ref={triggerRef}
          type="button"
          onClick={openPicker}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="mt-3 flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-emerald-800 bg-white px-4 py-3 text-left text-sm font-semibold text-emerald-950 transition hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
        >
          <span>{selectedIds.length ? "Edit selected HQLS topics" : "Choose HQLS topics"}</span>
          <span aria-hidden="true" className="text-xl font-normal leading-none">+</span>
        </button>
        {chosenLessons.length ? (
          <div className="mt-3 flex min-w-0 flex-wrap gap-2" aria-label="Selected HQLS topics">
            {chosenLessons.map((lesson) => (
              <span key={lesson.id} className="max-w-full truncate rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-medium text-emerald-950">
                {lesson.topic}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">
            Or leave this empty and write assessment topics directly below.
          </p>
        )}
      </div>

      {open && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-zinc-950/65 sm:items-center sm:p-4">
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            aria-describedby={hintId}
            className="flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden bg-white text-zinc-950 shadow-2xl sm:h-[min(90dvh,760px)] sm:max-w-2xl sm:rounded-3xl"
          >
            <header className="shrink-0 border-b border-zinc-200 px-4 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id={headingId} className="text-lg font-bold tracking-tight sm:text-xl">
                    Choose HQLS topics
                  </h2>
                  <p id={hintId} className="mt-1 text-sm leading-5 text-zinc-600">
                    Select lessons for one subject and class. You can choose up to {MAX_ASSESSMENT_SOURCE_LESSONS}.
                  </p>
                </div>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={dismissPicker}
                  aria-label="Close HQLS lesson picker"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 text-2xl text-zinc-700 focus-visible:outline-2 focus-visible:outline-emerald-800"
                >
                  ×
                </button>
              </div>
            </header>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="shrink-0 border-b border-zinc-200 px-4 py-3 sm:px-6">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <p className="font-semibold text-emerald-900">
                    {draftIds.length} selected
                  </p>
                  {draftIds.length ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDraftIds([]);
                        setSubjectId("");
                        setClassId("");
                        setPickerError(null);
                      }}
                      className="min-h-10 text-xs font-semibold text-zinc-700 underline underline-offset-2"
                    >
                      Clear selection
                    </button>
                  ) : null}
                </div>
                {draftedLessons.length ? (
                  <div className="mt-2 flex max-w-full gap-2 overflow-x-auto pb-2" aria-label="Topics selected in picker">
                    {draftedLessons.map((lesson) => (
                      <button
                        key={lesson.id}
                        type="button"
                        onClick={() => toggleLesson(lesson)}
                        aria-label={"Remove " + lesson.topic}
                        className="flex min-h-9 max-w-52 shrink-0 items-center gap-1.5 rounded-full bg-emerald-100 px-3 text-xs font-medium text-emerald-950"
                      >
                        <span className="truncate">{lesson.topic}</span>
                        <span aria-hidden="true" className="text-base">×</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                <input
                  type="search"
                  aria-label="Search saved HQLS lessons by topic or title"
                  placeholder="Search topic or lesson title"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setVisibleLimit(30);
                  }}
                  className="mt-2 min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-3.5 text-base outline-none focus:border-emerald-800 focus:ring-2 focus:ring-emerald-800/10"
                />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="min-w-0">
                    <span className="sr-only">Filter by subject</span>
                    <select
                      aria-label="Filter HQLS lessons by subject"
                      value={reference?.subject_id ?? subjectId}
                      onChange={(event) => {
                        setSubjectId(event.target.value);
                        setClassId("");
                        setVisibleLimit(30);
                      }}
                      disabled={Boolean(reference)}
                      className="h-11 w-full min-w-0 rounded-xl border border-zinc-300 bg-white px-2 text-sm text-zinc-800 disabled:bg-zinc-100 disabled:text-zinc-500"
                    >
                      <option value="">All subjects</option>
                      {availableSubjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>{subject.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="min-w-0">
                    <span className="sr-only">Filter by class</span>
                    <select
                      aria-label="Filter HQLS lessons by class"
                      value={reference?.class_id ?? classId}
                      onChange={(event) => {
                        setClassId(event.target.value);
                        setVisibleLimit(30);
                      }}
                      disabled={Boolean(reference)}
                      className="h-11 w-full min-w-0 rounded-xl border border-zinc-300 bg-white px-2 text-sm text-zinc-800 disabled:bg-zinc-100 disabled:text-zinc-500"
                    >
                      <option value="">All classes</option>
                      {availableClasses.map((schoolClass) => (
                        <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {reference ? (
                  <p className="mt-2 text-xs text-zinc-500">
                    Showing {subjectName.get(reference.subject_id ?? "") ?? "selected subject"} · {className.get(reference.class_id ?? "") ?? "selected class"}. Clear selection to switch.
                  </p>
                ) : null}
                {pickerError ? (
                  <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{pickerError}</p>
                ) : null}
                <p role="status" className="mt-2 text-xs text-zinc-500">
                  {matchingLessons.length} matching {matchingLessons.length === 1 ? "lesson" : "lessons"}
                </p>
              </div>

              <div
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2 sm:px-6"
                role="group"
                aria-label="Available HQLS source lessons"
              >
                {matchingLessons.length ? (
                  <>
                    {matchingLessons.slice(0, visibleLimit).map((lesson) => {
                      const checked = draftIds.includes(lesson.id);
                      const duplicateTopic = !checked && draftedLessons.some((item) =>
                        normalizedTopic(item.topic) === normalizedTopic(lesson.topic));
                      const maxReached = !checked && draftIds.length >= MAX_ASSESSMENT_SOURCE_LESSONS;
                      return (
                        <label
                          key={lesson.id}
                          className={
                            "my-2 flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border p-3 transition " +
                            (checked
                              ? "border-emerald-700 bg-emerald-50"
                              : duplicateTopic || maxReached
                                ? "border-zinc-200 bg-zinc-50 text-zinc-400"
                                : "border-zinc-200 bg-white hover:border-emerald-400")
                          }
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={duplicateTopic || maxReached}
                            onChange={() => toggleLesson(lesson)}
                            aria-label={lesson.topic + " — " + lesson.title}
                            className="h-5 w-5 shrink-0 accent-emerald-900"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block break-words text-sm font-semibold text-zinc-900">{lesson.topic}</span>
                            {lesson.title.trim() !== lesson.topic.trim() ? (
                              <span className="mt-0.5 block break-words text-xs leading-5 text-zinc-600">{lesson.title}</span>
                            ) : null}
                            <span className="mt-1 block text-xs text-zinc-500">
                              {subjectName.get(lesson.subject_id ?? "") ?? "Subject not linked"} · {className.get(lesson.class_id ?? "") ?? "Class not linked"}
                            </span>
                            {duplicateTopic ? <span className="block text-xs text-zinc-500">Topic already selected</span> : null}
                          </span>
                          {checked ? <span className="shrink-0 text-xs font-bold text-emerald-800">Added</span> : null}
                        </label>
                      );
                    })}
                    {matchingLessons.length > visibleLimit ? (
                      <button
                        type="button"
                        onClick={() => setVisibleLimit((current) => current + 30)}
                        className="my-3 min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800"
                      >
                        Show more lessons ({matchingLessons.length - visibleLimit} remaining)
                      </button>
                    ) : null}
                  </>
                ) : (
                  <div className="py-10 text-center">
                    <p className="text-sm font-semibold text-zinc-800">
                      {lessons.length ? "No matching lessons" : "No validated HQLS lessons yet"}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-zinc-500">
                      {reference
                        ? "Try another search. To choose a different subject or class, clear your selection."
                        : "Change the subject, class or search. You can also enter assessment topics manually."}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <footer className="shrink-0 border-t border-zinc-200 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:py-4">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={dismissPicker}
                  className="min-h-12 flex-1 rounded-xl border border-zinc-300 px-3 text-sm font-semibold text-zinc-800 sm:flex-none sm:px-6"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmSelection}
                  className="min-h-12 flex-[2] rounded-xl bg-emerald-950 px-3 text-sm font-semibold text-white sm:flex-1"
                >
                  {draftIds.length ? "Use " + draftIds.length + " selected " + (draftIds.length === 1 ? "topic" : "topics") : "Use direct context"}
                </button>
              </div>
            </footer>
          </section>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
