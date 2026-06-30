// ─── Public landing page ──────────────────────────────────────────────────────
// IMPORTANT: No DV language, no evidence/vault references, neutral copy only.
import Link from "next/link";
import { CoverName } from "@/components/CoverLogo";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <CoverName className="font-semibold text-gray-900 text-lg tracking-tight" />
        <Link
          href="/login"
          className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
        >
          Sign in
        </Link>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="max-w-xl">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-4">
            Your daily tracker,<br />always with you.
          </h1>
          <p className="text-lg text-gray-500 mb-8">
            Capture tasks, notes, and habits in one quiet place. Works offline. No ads. No clutter.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-brand-600 text-white font-medium text-sm hover:bg-brand-700 transition-colors shadow-sm"
            >
              Get started — it&apos;s free
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium text-sm hover:bg-gray-200 transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-gray-100 py-16 px-6">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          {[
            {
              icon: "✓",
              title: "Daily tasks",
              body: "Simple to-do list to keep your day on track.",
            },
            {
              icon: "📝",
              title: "Personal notes",
              body: "Private notes that stay on your device.",
            },
            {
              icon: "🔒",
              title: "Private by design",
              body: "Your data is yours. No tracking, no ads.",
            },
          ].map((f) => (
            <div key={f.title} className="flex flex-col items-center gap-2">
              <span className="text-3xl">{f.icon}</span>
              <h3 className="font-semibold text-gray-900">{f.title}</h3>
              <p className="text-sm text-gray-500">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6 px-6 text-center text-xs text-gray-400">
        <p><CoverName /> &copy; {new Date().getFullYear()} &mdash; A private productivity tracker.</p>
      </footer>
    </main>
  );
}
