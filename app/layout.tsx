import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { KsiAppNav } from "@/components/navigation/ksi-app-nav";
import { KsiSchoolShell } from "@/components/navigation/ksi-school-shell";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KAEC School Intelligence",
  description: "Teacher and leadership intelligence for better learning.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="ksi-app-shell flex min-h-full min-w-0 max-w-full flex-col">
        <KsiSchoolShell>{children}</KsiSchoolShell>
        <KsiAppNav />
      </body>
    </html>
  );
}
