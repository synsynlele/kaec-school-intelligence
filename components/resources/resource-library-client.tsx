"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  deleteWorkspaceResource,
  downloadWorkspaceResource,
  KSI_RESOURCE_MAX_BYTES,
  type ResourceType,
  type ResourceVisibility,
  uploadWorkspaceResource,
} from "@/lib/resources/storage";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database";

type ResourceRow = Database["public"]["Tables"]["resources"]["Row"];
type WorkspaceRow = Database["public"]["Tables"]["workspaces"]["Row"];

type ResourceContext = {
  userId: string;
  workspace: WorkspaceRow;
  resources: ResourceRow[];
};

const ACCEPTED_EXTENSIONS = ".pdf,.docx,.xlsx,.txt,.csv";

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function readableType(type: string) {
  return type.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

async function loadResourceContext(): Promise<ResourceContext | null> {
  const supabase = getBrowserSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("default_workspace_id")
    .eq("id", user.id)
    .single();

  if (profileError) throw profileError;
  if (!profile.default_workspace_id) {
    throw new Error("No active workspace is configured for this account.");
  }

  const [workspaceResult, resourceResult] = await Promise.all([
    supabase
      .from("workspaces")
      .select("*")
      .eq("id", profile.default_workspace_id)
      .single(),
    supabase
      .from("resources")
      .select("*")
      .eq("workspace_id", profile.default_workspace_id)
      .order("created_at", { ascending: false }),
  ]);

  if (workspaceResult.error) throw workspaceResult.error;
  if (resourceResult.error) throw resourceResult.error;

  return {
    userId: user.id,
    workspace: workspaceResult.data,
    resources: resourceResult.data ?? [],
  };
}

export function ResourceLibraryClient() {
  const router = useRouter();
  const [context, setContext] = useState<ResourceContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [resourceType, setResourceType] = useState<ResourceType>("reference");
  const [visibility, setVisibility] = useState<ResourceVisibility>("workspace");

  const maxFileSize = useMemo(() => formatBytes(KSI_RESOURCE_MAX_BYTES), []);

  const refresh = useCallback(async () => {
    const nextContext = await loadResourceContext();
    if (!nextContext) {
      router.replace("/sign-in");
      return;
    }
    setContext(nextContext);
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    void loadResourceContext()
      .then((nextContext) => {
        if (cancelled) return;
        if (!nextContext) {
          router.replace("/sign-in");
          return;
        }
        setContext(nextContext);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "The resource library could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setError(null);
    setSuccess(null);

    if (nextFile && nextFile.size > KSI_RESOURCE_MAX_BYTES) {
      setFile(null);
      event.target.value = "";
      setError(`Choose a file no larger than ${maxFileSize}.`);
      return;
    }

    setFile(nextFile);
    if (nextFile && !title.trim()) setTitle(nextFile.name);
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context || !file) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const supabase = getBrowserSupabaseClient();
      const stored = await uploadWorkspaceResource(supabase, {
        workspaceId: context.workspace.id,
        userId: context.userId,
        file,
        title,
        resourceType,
        visibility,
      });

      setFile(null);
      setTitle("");
      setSuccess(`${stored.title} is now available to KAEC School Intelligence.`);
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The resource could not be uploaded.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function download(resource: ResourceRow) {
    if (!resource.storage_path) return;

    setBusyId(resource.id);
    setError(null);
    setSuccess(null);

    try {
      const blob = await downloadWorkspaceResource(
        getBrowserSupabaseClient(),
        resource.storage_path,
      );
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = resource.title;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The resource could not be downloaded.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function remove(resource: ResourceRow) {
    if (!resource.storage_path) return;
    if (!window.confirm(`Delete “${resource.title}”? This cannot be undone.`)) return;

    setBusyId(resource.id);
    setError(null);
    setSuccess(null);

    try {
      await deleteWorkspaceResource(
        getBrowserSupabaseClient(),
        resource.id,
        resource.storage_path,
      );
      setSuccess(`${resource.title} was deleted.`);
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The resource could not be deleted.",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
        <p className="text-sm font-medium text-zinc-500">Loading resource library…</p>
      </main>
    );
  }

  if (!context) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-sm text-red-700">
          {error ?? "Your resource workspace could not be loaded."}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">
              KAEC School Intelligence
            </p>
            <p className="mt-1 text-sm text-zinc-500">Private curriculum & reference library</p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-zinc-400"
          >
            Back to dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[0.78fr_1.22fr] lg:py-10">
        <section>
          <p className="text-sm text-zinc-500">
            {context.workspace.workspace_type === "school" ? "School workspace" : "Private workspace"}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Resource Library</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-600">
            Upload the curriculum, scheme of work, notes and reference files that future KSI engines are allowed to use as source context. Files remain private to authorised workspace members.
          </p>

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {success}
            </div>
          ) : null}

          <form onSubmit={upload} className="mt-7 space-y-5 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div>
              <p className="text-sm font-semibold">Add a trusted source</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                PDF, DOCX, XLSX, TXT or CSV. Maximum {maxFileSize}.
              </p>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">File</span>
              <input
                required
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                onChange={chooseFile}
                className="block w-full rounded-xl border border-zinc-300 bg-stone-50 px-3 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Lagos State JSS2 Mathematics Scheme"
                className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-700"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Resource type</span>
                <select
                  value={resourceType}
                  onChange={(event) => setResourceType(event.target.value as ResourceType)}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-700"
                >
                  <option value="curriculum">Curriculum</option>
                  <option value="scheme">Scheme of work</option>
                  <option value="notes">Notes</option>
                  <option value="reference">Reference</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Visibility</span>
                <select
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value as ResourceVisibility)}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-700"
                >
                  <option value="workspace">Workspace members</option>
                  <option value="private">Only me</option>
                </select>
              </label>
            </div>

            <button
              type="submit"
              disabled={!file || uploading}
              className="w-full rounded-xl bg-emerald-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? "Uploading securely…" : "Add resource"}
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-100 pb-5">
            <div>
              <p className="text-sm font-semibold">{context.workspace.name}</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">Available sources</h2>
            </div>
            <p className="text-sm text-zinc-500">
              {context.resources.length} {context.resources.length === 1 ? "resource" : "resources"}
            </p>
          </div>

          {context.resources.length === 0 ? (
            <div className="py-16 text-center">
              <p className="font-medium text-zinc-700">No resources yet.</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
                Add the first authorised source. Future HQLS and assessment generation will be able to preserve provenance back to these files.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {context.resources.map((resource) => (
                <article key={resource.id} className="py-5 first:pt-6 last:pb-0">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                          {readableType(resource.resource_type)}
                        </span>
                        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600">
                          {resource.visibility === "private" ? "Private" : "Workspace"}
                        </span>
                        <span className="text-xs text-zinc-400">{readableType(resource.status)}</span>
                      </div>
                      <h3 className="mt-3 break-words text-base font-semibold">{resource.title}</h3>
                      {resource.mime_type ? (
                        <p className="mt-1 truncate text-xs text-zinc-400">{resource.mime_type}</p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        disabled={!resource.storage_path || busyId === resource.id}
                        onClick={() => void download(resource)}
                        className="rounded-xl border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-zinc-400 disabled:opacity-50"
                      >
                        Download
                      </button>
                      <button
                        type="button"
                        disabled={!resource.storage_path || busyId === resource.id}
                        onClick={() => void remove(resource)}
                        className="rounded-xl px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
