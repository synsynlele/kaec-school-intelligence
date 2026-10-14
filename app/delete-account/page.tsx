import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Delete your KSI account | KAEC School Intelligence",
  description: "Request deletion of your KAEC School Intelligence account and related data.",
};

const deletionEmail = "kaecng@gmail.com";
const deletionMailto = `mailto:${deletionEmail}?subject=${encodeURIComponent("KSI account deletion request")}`;

export default function KsiAccountDeletionPage() {
  return (
    <main className="min-h-screen bg-stone-50 px-5 py-10 text-zinc-900 sm:px-8">
      <article className="mx-auto max-w-2xl rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-10">
        <Link href="/" className="text-sm font-semibold text-emerald-900">← KAEC School Intelligence</Link>
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">KSI account and data rights</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Request account deletion</h1>
        <p className="mt-4 text-sm leading-7 text-zinc-700">
          You can ask KAEC-NG Ltd to delete your KAEC School Intelligence (KSI) account and its associated personal data. You can submit a request even if you have signed out or uninstalled the Android app.
        </p>
        <div className="mt-7 rounded-2xl border border-emerald-900/15 bg-emerald-50 p-5">
          <p className="text-sm font-bold text-emerald-950">Send your deletion request</p>
          <p className="mt-2 text-sm leading-6 text-zinc-700">Use the email address associated with your KSI account where possible. Include that address and state that you want your KSI account deleted. Do not send passwords, staff access codes or any learner records.</p>
          <a
            href={deletionMailto}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-950 px-5 py-3 text-sm font-semibold text-white"
          >
            Request deletion by email
          </a>
          <p className="mt-3 text-xs text-zinc-600">No email app? Write to <a className="font-semibold underline" href={deletionMailto}>{deletionEmail}</a> with the subject “KSI account deletion request”.</p>
        </div>
        <section className="mt-8 space-y-4 text-sm leading-7 text-zinc-700">
          <h2 className="text-lg font-bold text-zinc-950">What happens next?</h2>
          <p>The KAEC team will verify that you are authorised to request deletion, review data associated with your account and coordinate removal with the relevant school and service providers where required. We will tell you if any information must be retained temporarily for a legitimate educational, safeguarding, security or legal reason.</p>
          <p>This is a request process, not instant automated deletion. We will communicate the status and outcome through the verified contact channel. An app uninstall does not delete an account.</p>
          <h2 className="text-lg font-bold text-zinc-950">What data is covered?</h2>
          <p>Your sign-in identity and associated personal data are included in the request. Where your account has contributed to school records, we will distinguish your personal data from records the school is required to maintain and explain the outcome. The school’s learners’ records are not deleted simply because one teacher leaves.</p>
        </section>
        <footer className="mt-9 flex flex-wrap gap-5 border-t border-zinc-200 pt-6 text-sm">
          <Link href="/privacy" className="font-semibold text-emerald-900 underline">Read KSI Privacy Policy</Link>
          <Link href="/sign-in" className="text-zinc-600 underline">Return to sign-in</Link>
        </footer>
      </article>
    </main>
  );
}
