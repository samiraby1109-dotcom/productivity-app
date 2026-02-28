import type { Metadata } from "next";
import "./globals.css";
import PwaRegistration from "@/components/PwaRegistration";

export const metadata: Metadata = {
  title: "Daybook — Daily Tracker",
  description: "A simple daily productivity tracker for tasks, notes, and habits.",
  manifest: "/manifest.json",
  themeColor: "#0ea5e9",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
  // Deliberately neutral — no DV-related keywords
  keywords: ["productivity", "daily tracker", "tasks", "notes", "habits"],
  openGraph: {
    title: "Daybook — Daily Tracker",
    description: "Track your daily tasks, notes, and habits.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Daybook" />
      </head>
      <body>
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
