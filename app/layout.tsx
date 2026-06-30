import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegistration from "@/components/PwaRegistration";
import PrivacyScreen from "@/components/PrivacyScreen";
import CoverProvider from "@/components/CoverProvider";
import { COVER_STORAGE_KEY, COVER_IDS } from "@/lib/covers";

// Runs before first paint: applies the saved cover's accent ramp synchronously so
// there's no theme flash. On first run (no saved choice) it picks a RANDOM cover
// and persists it, so devices don't all start on the same look. Name/title/manifest
// are reconciled by CoverProvider after hydrate.
const COVER_BOOT_SCRIPT = `try{var K=${JSON.stringify(
  COVER_STORAGE_KEY
)},ids=${JSON.stringify(
  COVER_IDS
)},c=localStorage.getItem(K);if(!c){c=ids[Math.floor(Math.random()*ids.length)];localStorage.setItem(K,c);}document.documentElement.setAttribute('data-cover',c);}catch(e){}`;

export const metadata: Metadata = {
  title: "BelleMeadow Wellness — Daily Tracker",
  description: "A simple daily productivity tracker for tasks, notes, and habits.",
  manifest: "/manifest.json",
  // Deliberately neutral — no DV-related keywords
  keywords: ["productivity", "daily tracker", "tasks", "notes", "habits"],
  openGraph: {
    title: "BelleMeadow Wellness — Daily Tracker",
    description: "Track your daily tasks, notes, and habits.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#4f6b54",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" type="image/png" href="/icons/icon-192.png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="BelleMeadow Wellness" />
        <script dangerouslySetInnerHTML={{ __html: COVER_BOOT_SCRIPT }} />
      </head>
      <body>
        <PwaRegistration />
        <CoverProvider>{children}</CoverProvider>
        <PrivacyScreen />
      </body>
    </html>
  );
}
