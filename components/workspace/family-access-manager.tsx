"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { groupAccessLearners, LearnerAccessFilters } from "@/components/workspace/learner-access-filters";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { resolveKsiRuntimeAccess } from "@/lib/supabase/runtime-access";

import { parentLoginDomain, schoolLoginUsername } from "@/lib/learning/school-login";

type Learner = { id: string; name: string; class_name: string | null; has_photo: boolean };
type Parent = { id: string; name: string; username: string; status: string; learners: string[]; learner_ids?: string[] };
type Setup = { learners: Learner[]; parents: Parent[] };

async function passportJpeg(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8_000_000) {
    throw new Error("Use a JPEG, PNG or WebP photo under 8 MB.");
  }
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 400;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The photo could not be prepared.");
    const scale = Math.max(320 / image.width, 400 / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, 320, 400);
    context.drawImage(image, (320 - width) / 2, (400 - height) / 2, width, height);
    return canvas.toDataURL("image/jpeg", 0.82).split(",")[1];
  } finally {
    image.close();
  }
}

export function FamilyAccessManager() {
  const [parentSearch, setParentSearch] = useState("");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [editingParent, setEditingParent] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [learnerId, setLearnerId] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [credentials, setCredentials] = useState<{ username: string; temporaryPassword: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (id: string) => {
    const { data, error } = await getBrowserSupabaseClient().rpc("get_learning_family_setup", { school_id: id });
    if (error) throw new Error(error.message);
    setSetup(data as unknown as Setup);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const access = await resolveKsiRuntimeAccess(getBrowserSupabaseClient());
        const id = access?.activeSchool?.workspace_id;
        if (!id) throw new Error("Choose an active school first.");
        await load(id);
        setSchoolId(id);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Family access is unavailable.");
      }
    })();
  }, [load]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      await load(schoolId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The action could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  function resetParentPassword(parent: Parent) {
    if (!window.confirm(`Replace the password for ${parent.name}?`)) return;
    void run(async () => {
      const { data: { session } } = await getBrowserSupabaseClient().auth.getSession();
      if (!session) throw new Error("Sign in again to reset a password.");
      const response = await fetch("/api/learning/parent-account", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "reset", schoolId, accountId: parent.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not reset the parent password.");
      setCredentials(result);
      setMessage("Parent password reset. Copy the new login details above.");
    });
  }

  function resetParentForm() {
    setEditingParent(null);
    setName("");
    setHandle("");
    setSelected([]);
    setSearch("");
    setClassFilter("");
  }

  function saveParent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      if (editingParent) {
        const { error } = await getBrowserSupabaseClient().rpc("update_learning_parent", {
          school_id: schoolId, account_id: editingParent, parent_name: name, learner_ids: selected,
        });
        if (error) throw new Error(error.message);
        resetParentForm();
        setMessage("Parent details and learner links updated.");
        return;
      }
      const { data: { session } } = await getBrowserSupabaseClient().auth.getSession();
      if (!session) throw new Error("Sign in again to issue an account.");
      const response = await fetch("/api/learning/parent-account", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "issue", schoolId, parentName: name, handle: handle.trim().toLowerCase(), learnerIds: selected }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setCredentials(result);
      resetParentForm();
    });
  }

  function updatePhoto(remove: boolean) {
    void run(async () => {
      const jpeg = remove ? null : photo && await passportJpeg(photo);
      if (!remove && !jpeg) throw new Error("Choose a passport photo.");
      const { error } = await getBrowserSupabaseClient().rpc("save_learning_passport_photo", {
        school_id: schoolId, target_learner: learnerId, photo_jpeg: jpeg,
      });
      if (error) throw new Error(error.message);
      setPhoto(null);
      setMessage(remove ? "Passport photo removed." : "Passport photo saved.");
    });
  }

  if (!setup) return <p role={error ? "alert" : "status"}>{error || "Loading family access…"}</p>;

  const groups = groupAccessLearners(setup.learners, (learner) => learner.class_name || "No class assigned");
  const query = search.trim().toLowerCase();
  const visibleGroups = groups.filter(([name]) => !classFilter || classFilter === name)
    .map(([name, learners]) => [name, learners.filter((learner) => learner.name.toLowerCase().includes(query))] as const)
    .filter(([, learners]) => learners.length);

  const parentQuery = parentSearch.trim().toLowerCase();
  const activeLearnerNames = new Map(setup.learners.map(learner => [learner.id, learner.name]));
  const activeParents = setup.parents.filter(parent => parent.status !== "Revoked").map(parent => ({
    ...parent,
    learners: parent.learner_ids?.flatMap(id => {
      const label = activeLearnerNames.get(id);
      return label ? [label] : [];
    }) ?? parent.learners,
  }));
  const visibleParents = activeParents.filter((parent) =>
    [parent.name, schoolLoginUsername(parent.username, parentLoginDomain), ...parent.learners].some((value) => value.toLowerCase().includes(parentQuery))
  );

  const parentForm = (
        <form onSubmit={saveParent} className="space-y-3 p-4">
          <label className="block">Parent or guardian name
            <input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className="block w-full rounded border p-2" />
          </label>
          {!editingParent && <label className="block">Username
            <input required type="email" maxLength={58} value={handle}
              onChange={(e) => setHandle(e.target.value)} placeholder="tosin@kaec.com" className="block w-full rounded border p-2" />
          </label>}
          <fieldset className="space-y-1">
            <legend className="font-semibold">Learners verified by the school</legend>
            <LearnerAccessFilters search={search} className={classFilter} classes={groups.map(([name]) => name)}
              onSearch={setSearch} onClass={setClassFilter} />
            <p className="text-sm text-zinc-600">{selected.length} selected</p>
            {visibleGroups.length === 0 && <p className="py-2 text-sm text-zinc-600">No learners match these filters.</p>}
            <div className="max-h-64 overflow-auto">{visibleGroups.map(([name, learners]) => <section key={name}>
              <h3 className="bg-stone-100 px-2 py-1 text-sm font-semibold">{name}</h3>
              {learners.map((learner) => (
              <label key={learner.id} className="flex items-center gap-2 p-1">
                <input type="checkbox" checked={selected.includes(learner.id)} onChange={(event) => {
                  const checked = event.target.checked;
                  setSelected((previous) => checked ? [...previous, learner.id] : previous.filter((id) => id !== learner.id));
                }} />
                {learner.name} {learner.class_name && `· ${learner.class_name}`}
              </label>
            ))}</section>)}</div>
          </fieldset>
          <button type="submit" disabled={busy || selected.length === 0 || selected.length > 30 || (!editingParent && Boolean(credentials))}
            className="rounded-lg bg-emerald-900 px-4 py-2 font-semibold text-white disabled:opacity-50">{editingParent ? "Save parent details" : "Issue login"}</button>
          {editingParent && <button type="button" disabled={busy} onClick={resetParentForm} className="ml-3 py-2 font-semibold underline">Cancel</button>}
        </form>
  );

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-900">{error}</p>}
      {message && <p role="status">{message}</p>}
      {credentials && (
        <section className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <h2 className="font-semibold">Share these details privately</h2>
          <p className="break-all">Username <strong>{credentials.username}</strong></p>
          <p className="break-all">Temporary password <strong>{credentials.temporaryPassword}</strong></p>
          <p className="text-sm">The temporary password expires in seven days and must be changed before viewing results.</p>
          <button type="button" className="mr-3 rounded-lg border border-emerald-700 px-3 py-2 text-sm font-semibold"
            onClick={() => void navigator.clipboard.writeText(
              `Username: ${credentials.username}\nTemporary password: ${credentials.temporaryPassword}`
            ).catch(() => setError("Could not copy the credentials. Select and copy them manually."))}>
            Copy login details
          </button>
          <button type="button" onClick={() => setCredentials(null)} className="font-semibold underline">Hide credentials</button>
        </section>
      )}
      {!editingParent && <details className="rounded-xl border border-stone-200 bg-white">
        <summary className="cursor-pointer p-4 font-semibold text-emerald-900">Issue a parent login</summary>
        {parentForm}
      </details>}

      <details className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
        <summary className="cursor-pointer font-semibold text-emerald-900">Learner passport photo</summary>
        <label className="block">Learner
          <select value={learnerId} onChange={(e) => { setLearnerId(e.target.value); setPhoto(null); }}
            className="block w-full rounded border p-2">
            <option value="">Choose learner</option>
            {setup.learners.map((learner) => <option key={learner.id} value={learner.id}>
              {learner.name}{learner.class_name ? ` · ${learner.class_name}` : ""}{learner.has_photo ? " · Photo saved" : ""}
            </option>)}
          </select>
        </label>
        <label className="block">Photo file
          <input key={learnerId} type="file" accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="block w-full" />
        </label>
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={busy || !learnerId || !photo} onClick={() => updatePhoto(false)}
            className="rounded-lg bg-emerald-900 px-4 py-2 font-semibold text-white disabled:opacity-50">Save photo</button>
          {setup.learners.find(({ id }) => id === learnerId)?.has_photo && (
            <button type="button" disabled={busy} onClick={() => updatePhoto(true)} className="font-semibold text-red-800 underline">Remove photo</button>
          )}
        </div>
      </details>

      <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold text-zinc-950">Parent accounts</h2>
        {activeParents.length === 0 && <p>No current parent accounts.</p>}
        <label className="block text-sm font-semibold">Search parents
          <input type="search" value={parentSearch} onChange={(event) => setParentSearch(event.target.value)}
            placeholder="Name, username or learner" className="mt-2 block min-h-11 w-full min-w-0 rounded-xl border border-zinc-300 px-3 py-2 font-normal" />
        </label>
        {activeParents.length > 0 && visibleParents.length === 0 && <p>No parents match your search.</p>}
        {visibleParents.map((parent) => (
          <div key={parent.id} className="border-t border-zinc-200 py-3">
            <p className="font-semibold">{parent.name}</p>
            <p className="text-sm text-zinc-600">{parent.status} · {parent.learners.length} linked</p>
            <details className="mt-2 text-sm">
              <summary className="min-h-11 w-fit cursor-pointer py-3 font-semibold text-emerald-900">Details and actions</summary>
              <p className="break-all">Username {schoolLoginUsername(parent.username, parentLoginDomain)}</p>
              <p className="mb-2">Linked learners {parent.learners.join(", ") || "None"}</p>
              {parent.status !== "Revoked" && parent.learner_ids && (
                <button type="button" disabled={busy} className="mb-2 mr-4 py-2 font-semibold text-emerald-900 underline"
                  onClick={() => {
                    resetParentForm();
                    setEditingParent(parent.id);
                    setName(parent.name);
                    setSelected(parent.learner_ids ?? []);
                  }}>Edit name and active learner links</button>
              )}
              {parent.status !== "Revoked" && <button type="button" disabled={busy || Boolean(credentials)}
                className="mb-2 mr-4 py-2 font-semibold text-emerald-900 underline"
                onClick={() => resetParentPassword(parent)}>Reset school password</button>}
              {editingParent === parent.id && parentForm}
              {parent.status !== "Revoked" && <button type="button" disabled={busy}
                className="font-semibold text-red-800 underline" onClick={() => {
                  if (!window.confirm(`Revoke access for ${parent.name}?`)) return;
                  void run(async () => {
                    const { error } = await getBrowserSupabaseClient().rpc("revoke_learning_parent", {
                      school_id: schoolId, account_id: parent.id,
                    });
                    if (error) throw new Error(error.message);
                    if (editingParent === parent.id) resetParentForm();
                    setSetup(current => current && ({ ...current, parents: current.parents.filter(item => item.id !== parent.id) }));
                    setMessage("Parent access revoked.");
                  });
                }}>Revoke access</button>}
            </details>
          </div>
        ))}
      </section>

    </div>
  );
}
