"use client";

import { createContext, useContext, useEffect, useRef } from "react";

export const TeacherDraftAccount = createContext<string | null>(null);

// Drafts are browser-local and scoped to the signed-in teacher, school and form.
export function useTeacherDraft<T>(
  workspaceId: string | undefined,
  form: string | undefined,
  values: T,
  restore: (draft: T) => void,
) {
  const account = useContext(TeacherDraftAccount);
  const key = account && workspaceId && form
    ? `ksi:draft:v1:${JSON.stringify([account, workspaceId, form])}`
    : null;
  const snapshot = JSON.stringify(values);
  const baseline = useRef<{ key: string; snapshot: string } | null>(null);

  useEffect(() => {
    if (!key) {
      baseline.current = null;
      return;
    }
    try {
      if (baseline.current?.key !== key) {
        baseline.current = { key, snapshot };
        const saved = localStorage.getItem(key);
        if (saved && saved !== snapshot) {
          const draft = JSON.parse(saved) as T;
          queueMicrotask(() => {
            if (baseline.current?.key === key) restore(draft);
          });
        }
        return;
      }
      if (baseline.current.snapshot !== snapshot) {
        localStorage.setItem(key, snapshot);
      }
    } catch {
      // The form still works when browser storage is blocked or full.
    }
  }, [key, snapshot, restore]);

  return function clearDraft() {
    if (!key) return;
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null && saved !== snapshot) return;
      localStorage.removeItem(key);
      baseline.current = { key, snapshot };
    } catch {
      // A successful server save does not depend on browser storage.
    }
  };
}
