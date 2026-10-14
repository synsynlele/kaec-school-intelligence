import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | KAEC School Intelligence",
  description: "How KAEC School Intelligence handles school, teacher and learner information.",
};

const contact = "kaecng@gmail.com";

export default function KsiPrivacyPage() {
  return (
    <main className="min-h-screen bg-stone-50 px-5 py-10 text-zinc-900 sm:px-8">
      <article className="mx-auto max-w-3xl rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-10">
        <Link href="/" className="text-sm font-semibold text-emerald-900">← KAEC School Intelligence</Link>
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">KAEC-NG Ltd · KSI</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-zinc-500">Updated 14 October 2026</p>
        <div className="mt-7 space-y-7 text-sm leading-7 text-zinc-700">
          <section>
            <h2 className="text-lg font-bold text-zinc-950">Who operates KSI?</h2>
            <p>KAEC School Intelligence (KSI) is a teaching and school-intelligence platform provided by KAEC-NG Ltd. Participating schools administer school access and are responsible for the educational records they submit. You can contact KSI about privacy at <a className="underline" href={`mailto:${contact}`}>{contact}</a>.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-zinc-950">Information we handle</h2>
            <p>KSI may process names, email addresses and sign-in details; school affiliation, staff roles and workspace permissions; curriculum resources; lesson plans and assessments; learner profiles, diagnostic observations, learning evidence and intervention records entered by authorised school personnel; and technical information needed for platform security, troubleshooting and operation.</p>
            <p className="mt-2">School staff should enter only the information necessary for educational purposes. The learner-facing KSI workspace is not currently offered; learner data is managed by authorised school personnel.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-zinc-950">Why we use information</h2>
            <p>We use data to authenticate users, enforce school permissions, prepare and edit teaching materials, support assessment and learner diagnosis, generate requested AI-assisted outputs, export school documents, maintain service reliability and investigate security or support issues.</p>
            <p className="mt-2">AI-assisted lesson or diagnosis content must be reviewed by the relevant teacher or school leader. It is not an automatic professional decision.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-zinc-950">Processing and service providers</h2>
            <p>KSI uses Supabase for authentication and data services, Vercel for hosting and delivery, and an OpenAI API integration for requested AI assistance. Google sign-in, when selected, also involves Google authentication services. Information submitted to an AI-assisted workflow may be sent to the configured AI provider to produce the requested output. We do not intentionally publish private school or learner records to other schools or the public.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-zinc-950">Security and access</h2>
            <p>KSI uses authenticated accounts, school-governed memberships, access controls and HTTPS connections. No online service can guarantee absolute security. Only authorised personnel should upload or review sensitive student information.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-zinc-950">Retention and deletion</h2>
            <p>We retain data for service delivery and legitimate school administration, then remove or de-identify information that is no longer required. Certain school records may require separate handling or retention because of educational duties, safeguarding, security or legal obligations. We review such exceptions when processing a request and explain any applicable retention to the requester.</p>
            <p className="mt-2">You can <Link href="/delete-account" className="font-semibold underline text-emerald-900">request deletion of your KSI account and associated information</Link> without downloading the app. We will verify your identity before processing deletion. Requests are reviewed by the KAEC team; opening the request link alone does not delete any records.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-zinc-950">Questions and updates</h2>
            <p>To ask about access, correction or deletion of your data, email <a href={`mailto:${contact}`} className="font-semibold underline text-emerald-900">{contact}</a>. This notice will be updated if the platform’s data practices change.</p>
          </section>
        </div>
        <footer className="mt-9 flex flex-wrap gap-4 border-t border-zinc-200 pt-6 text-sm">
          <Link href="/delete-account" className="font-semibold text-emerald-900 underline">Request account deletion</Link>
          <Link href="/sign-in" className="text-zinc-600 underline">Sign in</Link>
        </footer>
      </article>
    </main>
  );
}
