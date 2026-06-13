import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegistration from "@/components/PwaRegistration";
import PrivacyScreen from "@/components/PrivacyScreen";

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
      </head>
      <body>
        <PwaRegistration />
        {children}
        <PrivacyScreen />
      </body>
    </html>
  );
}
