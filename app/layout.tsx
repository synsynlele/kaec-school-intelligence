import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { KsiAiTransport } from "@/components/network/ksi-ai-transport";
import { KsiAppNav } from "@/components/navigation/ksi-app-nav";
import { KsiSchoolShell } from "@/components/navigation/ksi-school-shell";
import { KsiAppLifecycle } from "@/components/pwa/ksi-app-lifecycle";
import "./globals.css";
import "./workspace-shell.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const productionUrl = new URL("https://www.ksi.name.ng");

const pwaInstallCaptureScript = `
(() => {
  if (window.__ksiInstallCaptureReady) return;
  window.__ksiInstallCaptureReady = true;

  const isAndroidAppShell = () =>
    document.referrer.startsWith("android-app://");

  const isStandalone = () => {
    const displayMode =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches;
    const iosStandalone = window.navigator.standalone === true;
    return displayMode || iosStandalone || isAndroidAppShell();
  };

  const isMobile = () => {
    const ua = navigator.userAgent;
    const regularMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const iPadDesktopMode =
      /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
    return regularMobile || iPadDesktopMode;
  };

  const publishInstallState = () => {
    window.dispatchEvent(new Event("ksi:install-state"));
  };

  if (isStandalone()) {
    window.__ksiAppInstalled = true;
    window.__ksiDeferredInstallPrompt = null;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();

    // Mobile installation is handled by KSI Lite for Android. Never retain a
    // browser PWA prompt on mobile or inside an already-installed app shell.
    if (isStandalone() || isMobile()) {
      window.__ksiDeferredInstallPrompt = null;
      publishInstallState();
      return;
    }

    // Capture before React hydration so the desktop native install event is not
    // lost if the browser fires it before the landing-page client component mounts.
    window.__ksiDeferredInstallPrompt = event;
    publishInstallState();
  });

  window.addEventListener("appinstalled", () => {
    window.__ksiDeferredInstallPrompt = null;
    window.__ksiAppInstalled = true;
    publishInstallState();
  });
})();
`;

export const metadata: Metadata = {
  title: "KAEC School Intelligence",
  description: "Teacher and leadership intelligence for better learning.",
  applicationName: "KAEC School Intelligence",
  manifest: "/manifest.webmanifest",
  metadataBase: productionUrl,
  appleWebApp: {
    capable: true,
    title: "KSI",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    shortcut: "/icon.png",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#064e3b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="ksi-app-shell flex min-h-full min-w-0 max-w-full flex-col">
        <script dangerouslySetInnerHTML={{ __html: pwaInstallCaptureScript }} />
        <KsiAiTransport />
        <KsiAppLifecycle />
        <KsiSchoolShell>{children}</KsiSchoolShell>
        <KsiAppNav />
      </body>
    </html>
  );
}
