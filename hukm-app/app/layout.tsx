import type { Metadata, Viewport } from "next";

import "./globals.css";

import { AppShell } from "@/components/AppShell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { ShortcutsHelp } from "@/components/ShortcutsHelp";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteSidebar } from "@/components/SiteSidebar";
import { LanguageProvider } from "@/contexts/LanguageContext";

export const metadata: Metadata = {
  title: "HUKM - Ethiopian Sentencing Assistant",
  description:
    "AI-powered structured analysis of Ethiopian criminal law scenarios with source citations and confidence ratings.",
  applicationName: "HUKM",
  authors: [{ name: "HUKM" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "HUKM",
    statusBarStyle: "black-translucent",
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0A0A0A",
};

const NO_FLASH_SCRIPT = `(() => {
  try {
    document.documentElement.setAttribute('data-theme', 'dark');
  } catch (_) { }
})();`;

import { Sanchez, BenchNine, Slabo_13px } from "next/font/google";

const sanchez = Sanchez({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-sanchez",
  display: "swap",
});

const benchNine = BenchNine({
  weight: ["300", "400", "700"],
  subsets: ["latin"],
  variable: "--font-bench-nine",
  display: "swap",
});

const slabo13px = Slabo_13px({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-slabo",
  display: "swap",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${sanchez.variable} ${benchNine.variable} ${slabo13px.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }}
        />
      </head>
      <body className="min-h-[100dvh] bg-background text-on-surface antialiased">
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[35] opacity-[0.04] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
            backgroundSize: "220px 220px",
          }}
        />
        <LanguageProvider initial="en">
          <ErrorBoundary language="en">
            <SiteSidebar />
            <AppShell>
              {children}
              <SiteFooter />
            </AppShell>
            <ShortcutsHelp />
          </ErrorBoundary>
          <ServiceWorkerRegistrar />
        </LanguageProvider>
      </body>
    </html>
  );
}
