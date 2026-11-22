"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { resolveKsiRuntimeAccess } from "@/lib/supabase/runtime-access";

type Learner = { id: string; name: string; class_name: string | null; has_photo: boolean };
type Parent = { id: string; name: string; username: string; status: string; learners: string[] };
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
  const [schoolId, setSchoolId] = useState("");
  const [setup, setSetup] = useState<Setup | null>(null);
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

  function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
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
      setName("");
      setHandle("");
      setSelected([]);
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
          <button type="button" onClick={() => setCredentials(null)} className="font-semibold underline">Hide credentials</button>
        </section>
      )}
      <form onSubmit={issue} className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Issue a parent login</h2>
        <label className="block">Parent or guardian name
          <input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className="block w-full rounded border p-2" />
        </label>
        <label className="block">Username
          <input required minLength={2} maxLength={24} pattern="[A-Za-z0-9][A-Za-z0-9.\-]{1,23}" value={handle}
            onChange={(e) => setHandle(e.target.value)} placeholder="parent0042" className="block w-full rounded border p-2" />
        </label>
        <fieldset className="space-y-1">
          <legend className="font-semibold">Learners verified by the school</legend>
          <div className="max-h-48 overflow-auto">{setup.learners.map((learner) => (
            <label key={learner.id} className="flex items-center gap-2 p-1">
              <input type="checkbox" checked={selected.includes(learner.id)} onChange={(event) => {
                const checked = event.target.checked;
                setSelected((previous) => checked ? [...previous, learner.id] : previous.filter((id) => id !== learner.id));
              }} />
              {learner.name} {learner.class_name && `· ${learner.class_name}`}
            </label>
          ))}</div>
        </fieldset>
        <button type="submit" disabled={busy || selected.length === 0 || Boolean(credentials)}
          className="rounded-lg bg-emerald-900 px-4 py-2 font-semibold text-white disabled:opacity-50">Issue login</button>
      </form>

      <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Parent accounts</h2>
        {setup.parents.length === 0 && <p>No school-issued parent accounts yet.</p>}
        {setup.parents.map((parent) => (
          <div key={parent.id} className="flex flex-wrap items-start justify-between gap-2 border-t pt-3">
            <div><p className="font-semibold">{parent.name} · {parent.status}</p>
              <p className="break-all text-sm">{parent.username}</p>
              <p className="text-sm">{parent.learners.join(", ")}</p>
            </div>
            {parent.status !== "Revoked" && <button type="button" disabled={busy}
              className="font-semibold text-red-800 underline" onClick={() => {
                if (!window.confirm(`Revoke access for ${parent.name}?`)) return;
                void run(async () => {
                  const { error } = await getBrowserSupabaseClient().rpc("revoke_learning_parent", {
                    school_id: schoolId, account_id: parent.id,
                  });
                  if (error) throw new Error(error.message);
                  setMessage("Parent access revoked.");
                });
              }}>Revoke access</button>}
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Learner passport photo</h2>
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
      </section>
    </div>
  );
}
