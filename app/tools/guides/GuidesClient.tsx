"use client";
import NavShell from "@/components/NavShell";
import IdleLock from "@/components/IdleLock";

interface Props {
  mode: "FULL" | "DECOY";
  email: string;
  passwordSalt: string;
}

export default function GuidesClient({ mode, email, passwordSalt }: Props) {
  const questions = [
    "Does someone make decisions for you without your input, or punish you when you make your own choices?",
    "Are you afraid of someone's anger or reactions?",
    "Does someone isolate you from friends, family, or work?",
    "Does someone control money, access to a car, or your ability to work?",
    "Has someone hurt you physically, or threatened to?",
    "Does someone monitor your phone, location, or accounts without your consent?",
    "Do you feel like you are always walking on eggshells?",
    "Does someone blame you for their behavior or deny that things happened?",
  ];

  const terms = [
    {
      term: "Coercive control",
      def: "A pattern of behavior — not just individual incidents — that seeks to take away liberty or autonomy. Includes rules, punishment, monitoring, and humiliation designed to create dependency and fear.",
    },
    {
      term: "Financial abuse",
      def: "Controlling someone's access to money, employment, or resources. May include preventing you from working, taking your wages, running up debt in your name, or limiting access to bank accounts.",
    },
    {
      term: "Tech abuse / surveillance",
      def: "Using technology to monitor, harass, or control — including tracking apps, spyware, account takeovers, sharing private images, or using devices to isolate.",
    },
    {
      term: "Reproductive coercion",
      def: "Pressuring or forcing pregnancy or preventing it against your will. Includes sabotaging contraception, pressuring abortion decisions, or threatening harm related to pregnancy.",
    },
    {
      term: "Stalking",
      def: "Repeated unwanted contact or surveillance that causes fear — online or in person. This can include following, monitoring, contacting through third parties, or showing up at your home or work.",
    },
    {
      term: "Trauma bonding",
      def: "A strong emotional attachment to an abusive person, often formed through cycles of tension, harm, and reconciliation. It is a psychological response to abuse — not a character flaw.",
    },
    {
      term: "Gaslighting",
      def: "A form of manipulation where someone causes you to question your own perception, memory, or sanity. Examples include denying events happened, minimizing your feelings, or insisting you are overreacting.",
    },
    {
      term: "Escalation risk after leaving",
      def: "Research shows that the period immediately after leaving is often the highest-risk time. Planning a safe exit, connecting with support services, and having a safety plan can help reduce this risk.",
    },
  ];

  return (
    <>
      <IdleLock mode={mode} email={email} passwordSalt={passwordSalt} />
      <NavShell mode={mode}>
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Guides</h1>
        <p className="text-xs text-gray-400 mb-5">
          This information is educational — not a diagnosis or legal advice. Only you know your situation.
        </p>

        <div className="space-y-4">
          {/* Self-check */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h2 className="font-semibold text-gray-900 text-sm mb-3">Is this abuse?</h2>
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
              These questions are not a scoring tool. They are a starting point for reflection.
              Many people experience harm without recognizing it as abuse — and that is not your fault.
              Trust your own sense of what feels right and safe.
            </p>
            <ul className="space-y-2">
              {questions.map((q, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="flex-shrink-0 text-gray-300 mt-0.5">▸</span>
                  {q}
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-400 mt-3 border-t border-gray-100 pt-3">
              If any of these resonated with you, support is available. You are not alone.
            </p>
          </div>

          {/* Glossary */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h2 className="font-semibold text-gray-900 text-sm mb-3">Glossary</h2>
            <div className="space-y-4">
              {terms.map((t) => (
                <div key={t.term}>
                  <p className="text-sm font-medium text-gray-800">{t.term}</p>
                  <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{t.def}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </NavShell>
    </>
  );
}
