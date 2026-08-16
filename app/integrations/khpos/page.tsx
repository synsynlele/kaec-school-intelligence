import type { Metadata } from "next";
import Link from "next/link";

import { KaecBrand } from "@/components/branding/kaec-brand";
import { KhposPairingClient } from "@/components/integrations/khpos-pairing-client";

export const metadata: Metadata = {
  title: "Connect KHP-OS | KAEC School Intelligence",
  description:
    "Approve a governed institution-level learning-intelligence connection between KSI and KHP-OS.",
  robots: { index: false, follow: false },
};

export default function KhposIntegrationPage() {
  return (
    <main className="min-h-screen bg-stone-50 px-5 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/dashboard" className="w-fit rounded-2xl bg-white px-4 py-3 shadow-sm">
            <KaecBrand compact />
          </Link>
          <div className="max-w-md text-left sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
              Governed integration
            </p>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              KSI remains the specialist learning engine. KHP-OS receives bounded institutional signals only.
            </p>
          </div>
        </div>

        <div className="mt-8 sm:mt-10">
          <KhposPairingClient />
        </div>
      </div>
    </main>
  );
}
