"use client";
import { useEffect, useState } from "react";
import Image from "next/image";

/**
 * PrivacyScreen — covers the whole app with the neutral wellness splash whenever
 * the page is backgrounded or hidden. iOS and Android cache a snapshot of the
 * current screen for the app switcher; without this, that snapshot (and a glance
 * at the phone mid-app-switch) can reveal vault content to an abuser holding the
 * device. The cover is innocuous branding, so it also reads as an ordinary
 * launch screen rather than a "hiding something" tell.
 *
 * This is the strongest screen-privacy a web app can apply. A native wrapper
 * could additionally set Android FLAG_SECURE / an iOS secure snapshot.
 */
export default function PrivacyScreen() {
  const [covered, setCovered] = useState(false);

  useEffect(() => {
    const sync = () => setCovered(document.visibilityState === "hidden");
    const cover = () => setCovered(true);
    const uncover = () => setCovered(false);

    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pagehide", cover);
    window.addEventListener("pageshow", uncover);
    sync();
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pagehide", cover);
      window.removeEventListener("pageshow", uncover);
    };
  }, []);

  if (!covered) return null;
  return (
    <div
      aria-hidden
      className="fixed inset-0 flex items-center justify-center bg-gray-50"
      style={{ zIndex: 2147483647 }}
    >
      <Image src="/logo.png" alt="" width={200} height={80} className="h-14 w-auto opacity-90" priority />
    </div>
  );
}
