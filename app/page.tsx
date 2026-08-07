import Link from "next/link";

const engines = [
  {
    title: "HQLS Lesson Intelligence",
    description:
      "Design seven-stage lessons that move from meaning and struggle to clarity, application and reflection.",
  },
  {
    title: "Assessment Intelligence",
    description:
      "Build aligned assessments that reveal mastery, reasoning and meaningful evidence of learning.",
  },
  {
    title: "Student Diagnosis Intelligence",
    description:
      "Turn evidence into reviewed strengths, challenges and practical school-and-parent action plans.",
  },
] as const;

export default function HomePage() {
  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <nav className="flex items-center justify-between border-b border-zinc-200 pb-6">
          <div>
            <p className="text-sm font-semibold tracking-tight">KAEC-NG</p>
            <p className="mt-0.5 text-xs text-zinc-500">School Intelligence</p>
          </div>
          <Link
            href="/sign-in"
            className="rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
          >
            Open workspace
          </Link>
        </nav>

        <section className="grid gap-10 py-16 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-800">
              Design → Assess → Diagnose → Improve
            </p>
            <h1 className="mt-5 text-5xl font-semibold tracking-[-0.04em] sm:text-6xl lg:text-7xl">
              Better teaching decisions. Better evidence. Better next steps.
            </h1>
          </div>
          <div className="max-w-xl lg:justify-self-end">
            <p className="text-base leading-7 text-zinc-600 sm:text-lg">
              KAEC School Intelligence connects HQLS lesson design, assessment and
              evidence-based student diagnosis in one secure academic intelligence
              workspace.
            </p>
            <Link
              href="/sign-in"
              className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-emerald-900"
            >
              Sign in or create an account <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>

        <section className="grid gap-4 border-t border-zinc-200 pt-8 md:grid-cols-3">
          {engines.map((engine, index) => (
            <article key={engine.title} className="rounded-3xl bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold text-emerald-800">
                0{index + 1}
              </p>
              <h2 className="mt-5 text-xl font-semibold tracking-tight">
                {engine.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                {engine.description}
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
