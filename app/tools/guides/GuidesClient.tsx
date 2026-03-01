"use client";
import { useState } from "react";
import NavShell from "@/components/NavShell";
import IdleLock from "@/components/IdleLock";

interface Props {
  mode: "FULL" | "DECOY";
  email: string;
  passwordSalt: string;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 flex-shrink-0 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function AccordionSection({
  id, title, open, onToggle, children,
}: {
  id: string; title: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
        aria-expanded={open}
        aria-controls={`section-${id}`}
      >
        <span className="font-semibold text-gray-900 text-sm">{title}</span>
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div id={`section-${id}`} className="px-4 pb-4 border-t border-gray-50">
          <div className="pt-3">{children}</div>
        </div>
      )}
    </div>
  );
}

// The 8 spokes of the Power and Control Wheel (Duluth Model concepts)
const WHEEL_SPOKES = [
  {
    label: "Using intimidation",
    color: "#e85d5d",
    examples: [
      "Making threatening looks, gestures, or actions",
      "Smashing things, destroying property",
      "Abusing pets",
      "Displaying weapons",
    ],
  },
  {
    label: "Using emotional abuse",
    color: "#e8825d",
    examples: [
      "Putting you down or calling you names",
      "Making you feel bad about yourself",
      "Humiliating you — especially in front of others",
      "Making you think you are 'crazy'",
    ],
  },
  {
    label: "Using isolation",
    color: "#c4a824",
    examples: [
      "Controlling who you see, talk to, or where you go",
      "Using jealousy to justify controlling behavior",
      "Limiting outside involvement",
      "Monitoring phone calls, messages, or location",
    ],
  },
  {
    label: "Minimizing, denying, blaming",
    color: "#5db85d",
    examples: [
      "Saying the abuse didn't happen or wasn't that bad",
      "Shifting responsibility to you for causing it",
      "Making light of the abuse",
      "Saying you are oversensitive or overreacting",
    ],
  },
  {
    label: "Using children",
    color: "#4aabab",
    examples: [
      "Making you feel guilty about the children",
      "Using visitation to harass or control you",
      "Threatening to take or harm children",
      "Using children to relay messages or spy",
    ],
  },
  {
    label: "Using privilege",
    color: "#5d7de8",
    examples: [
      "Treating you like a servant or as inferior",
      "Making all the big decisions unilaterally",
      "Acting like the 'master of the house'",
      "Defining rigid roles in the relationship",
    ],
  },
  {
    label: "Using economic abuse",
    color: "#9b5de8",
    examples: [
      "Preventing you from getting or keeping a job",
      "Controlling all the money and making you ask for it",
      "Taking your paycheck or running up debt in your name",
      "Withholding money as punishment",
    ],
  },
  {
    label: "Using coercion and threats",
    color: "#e85d9b",
    examples: [
      "Making or carrying out threats to hurt you",
      "Threatening to leave, report you, or take the children",
      "Making you drop legal charges",
      "Making you do illegal things under threat",
    ],
  },
];

export default function GuidesClient({ mode, email, passwordSalt }: Props) {
  const [open, setOpen] = useState<Set<string>>(new Set(["self-check"]));
  const [wheelSpoke, setWheelSpoke] = useState<number | null>(null);

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <IdleLock mode={mode} email={email} passwordSalt={passwordSalt} />
      <NavShell mode={mode}>
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Guides</h1>
        <p className="text-xs text-gray-400 mb-5">
          This information is educational — not a diagnosis or legal advice. Only you know your situation.
        </p>

        <div className="space-y-3">

          {/* ── Is this abuse? ── */}
          <AccordionSection id="self-check" title="Is this abuse?" open={open.has("self-check")} onToggle={() => toggle("self-check")}>
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
              These questions are a starting point for reflection, not a scoring tool.
              Many people experience harm without recognizing it as abuse — and that is not your fault.
              Trust your own sense of what feels right and safe.
            </p>
            <ul className="space-y-2">
              {[
                "Does someone make decisions for you without your input, or punish you when you make your own choices?",
                "Are you afraid of someone's anger or reactions?",
                "Does someone isolate you from friends, family, or work?",
                "Does someone control money, access to a car, or your ability to work?",
                "Has someone hurt you physically, or threatened to?",
                "Does someone monitor your phone, location, or accounts without your consent?",
                "Do you feel like you are always walking on eggshells?",
                "Does someone blame you for their behavior or deny that things happened?",
              ].map((q, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="flex-shrink-0 text-gray-300 mt-0.5">▸</span>
                  {q}
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-400 mt-3 border-t border-gray-100 pt-3">
              If any of these resonated with you, support is available. You are not alone.
            </p>
          </AccordionSection>

          {/* ── Types of abuse ── */}
          <AccordionSection id="types" title="Types of abuse" open={open.has("types")} onToggle={() => toggle("types")}>
            <div className="space-y-3">
              {[
                { type: "Physical", desc: "Hitting, slapping, punching, kicking, strangling, shoving, restraining, or using objects as weapons. Also includes sleep deprivation or withholding food or medical care." },
                { type: "Emotional / psychological", desc: "Constant criticism, name-calling, humiliation, gaslighting (making you doubt your own memory or perception), threats, and manipulation designed to erode your self-worth and create fear." },
                { type: "Financial / economic", desc: "Controlling access to money or employment, taking wages, running up debt in your name, preventing education or career advancement, forcing financial dependence." },
                { type: "Sexual", desc: "Any sexual act without full, ongoing consent — including within a relationship or marriage. Also includes reproductive coercion: sabotaging birth control, pressuring pregnancy decisions, or forcing abortion." },
                { type: "Digital / tech abuse", desc: "Tracking your location, reading messages, installing spyware, taking over accounts, sharing private images without consent, or using technology to monitor, harass, or isolate." },
                { type: "Spiritual / cultural", desc: "Using religious beliefs or cultural norms to justify control, preventing religious practice or forcing it, using community standing to enforce obedience, or weaponizing family or community pressure." },
              ].map(({ type, desc }) => (
                <div key={type}>
                  <p className="text-sm font-medium text-gray-800">{type}</p>
                  <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </AccordionSection>

          {/* ── Cycle of abuse ── */}
          <AccordionSection id="cycle" title="The cycle of abuse" open={open.has("cycle")} onToggle={() => toggle("cycle")}>
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
              Many abusive relationships follow a recognizable cycle. Not every relationship follows this exact pattern — some skip phases, and some escalate without the calmer periods.
            </p>
            <div className="space-y-3">
              {[
                { phase: "1. Tension building", desc: "Stress and irritability increase. Walking on eggshells. Minor incidents escalate. The survivor may feel like they are trying to prevent the explosion." },
                { phase: "2. Incident", desc: "The abusive episode — physical, verbal, emotional, or other. Can range from a single outburst to prolonged violence." },
                { phase: "3. Reconciliation (\"honeymoon\")", desc: "Apologies, gifts, affection, or promises to change. The abuser may minimize what happened, blame stress, or blame the survivor. This phase reinforces hope that things will improve." },
                { phase: "4. Calm", desc: "A period of relative normalcy. Tension is low. This can feel like confirmation that the relationship can be fixed — before the cycle begins again." },
              ].map(({ phase, desc }) => (
                <div key={phase} className="flex gap-3">
                  <span className="flex-shrink-0 w-1.5 rounded-full bg-brand-300 self-stretch" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{phase}</p>
                    <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3 border-t border-gray-100 pt-3">
              The cycle often shortens over time — reconciliation phases get briefer and incidents become more severe.
            </p>
          </AccordionSection>

          {/* ── Warning signs ── */}
          <AccordionSection id="warning" title="Early warning signs" open={open.has("warning")} onToggle={() => toggle("warning")}>
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
              Abusive patterns often begin gradually. Early signs may feel flattering or easily explained away.
            </p>
            <ul className="space-y-2">
              {[
                "Love bombing: overwhelming affection, gifts, or intensity very early in the relationship",
                "Rapid escalation of commitment — pushing to move in together, get engaged, or become exclusive very quickly",
                "Extreme jealousy framed as love or protectiveness",
                "Subtle criticism disguised as jokes or \"just being honest\"",
                "Checking your phone, location, or social media \"because they care\"",
                "Pressure to cut contact with friends or family",
                "Needing to know where you are at all times",
                "Blaming past partners for everything in previous relationships",
                "Difficulty accepting 'no' or boundaries in small situations",
                "Your feelings are consistently dismissed, minimized, or turned back on you",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="flex-shrink-0 text-gray-300 mt-0.5">▸</span>
                  {item}
                </li>
              ))}
            </ul>
          </AccordionSection>

          {/* ── Barriers to leaving ── */}
          <AccordionSection id="barriers" title="Why leaving is complicated" open={open.has("barriers")} onToggle={() => toggle("barriers")}>
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
              Leaving an abusive relationship is rarely as simple as walking out. These barriers are real, and they are not a reflection of weakness.
            </p>
            <div className="space-y-2.5">
              {[
                { label: "Fear", desc: "Fear of retaliation, escalation, or that leaving will make things worse — which is statistically accurate; the period after leaving carries the highest risk." },
                { label: "Financial dependence", desc: "When an abuser controls money, employment, or housing, leaving can mean losing everything at once." },
                { label: "Children", desc: "Fear of custody battles, harm to children, or not wanting to disrupt children's lives." },
                { label: "Trauma bonding", desc: "The psychological attachment formed through cycles of harm and reconciliation. Feeling love for an abuser is not weakness — it is a normal response to an abnormal situation." },
                { label: "Immigration status", desc: "Fear of deportation, loss of visa status, or not knowing rights in a new country." },
                { label: "Pets", desc: "Many survivors stay because they fear leaving pets behind. Many shelters now have pet programs — ask when you call." },
                { label: "Cultural and religious pressure", desc: "Community, family, or faith traditions that discourage leaving or frame it as failure or sin." },
                { label: "Isolation", desc: "Being cut off from support systems makes it harder to know where to turn or believe that help is available." },
              ].map(({ label, desc }) => (
                <div key={label}>
                  <p className="text-sm font-medium text-gray-800">{label}</p>
                  <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </AccordionSection>

          {/* ── How to help a friend ── */}
          <AccordionSection id="friend" title="How to support someone experiencing abuse" open={open.has("friend")} onToggle={() => toggle("friend")}>
            <ul className="space-y-2.5">
              {[
                { heading: "Believe them", body: "Start there. Do not question details or suggest they might be misinterpreting. A survivor's account is the most important evidence." },
                { heading: "Don't push a timeline", body: "Leaving is a process, not an event. People leave an average of seven times before leaving for good. Pushing too hard can backfire or cut off communication." },
                { heading: "Stay in contact", body: "Even if they go back, keep the relationship open. Isolation is part of the abuser's strategy — your continued presence matters." },
                { heading: "Avoid badmouthing the abuser", body: "It can feel counterproductive, but direct criticism of the abuser may cause the survivor to defend them and pull away from you." },
                { heading: "Help with practical barriers", body: "Offer concrete support: a place to stay, help with a childcare plan, going with them to an appointment, or helping research shelters." },
                { heading: "Respect their decisions", body: "Your role is to support, not direct. Ultimatums and judgment make it harder for them to come to you when they are ready to leave." },
              ].map(({ heading, body }) => (
                <li key={heading} className="text-sm text-gray-700">
                  <span className="font-medium text-gray-800">{heading}: </span>
                  {body}
                </li>
              ))}
            </ul>
          </AccordionSection>

          {/* ── Glossary ── */}
          <AccordionSection id="glossary" title="Glossary" open={open.has("glossary")} onToggle={() => toggle("glossary")}>
            <div className="space-y-4">
              {[
                { term: "Coercive control", def: "A pattern of behavior — not just individual incidents — that seeks to take away liberty or autonomy. Includes rules, punishment, monitoring, and humiliation designed to create dependency and fear." },
                { term: "Financial abuse", def: "Controlling someone's access to money, employment, or resources. May include preventing you from working, taking your wages, running up debt in your name, or limiting access to bank accounts." },
                { term: "Tech abuse / surveillance", def: "Using technology to monitor, harass, or control — including tracking apps, spyware, account takeovers, sharing private images, or using devices to isolate." },
                { term: "Reproductive coercion", def: "Pressuring or forcing pregnancy or preventing it against your will. Includes sabotaging contraception, pressuring abortion decisions, or threatening harm related to pregnancy." },
                { term: "Stalking", def: "Repeated unwanted contact or surveillance that causes fear — online or in person. This can include following, monitoring, contacting through third parties, or showing up at your home or work." },
                { term: "Trauma bonding", def: "A strong emotional attachment to an abusive person, often formed through cycles of tension, harm, and reconciliation. It is a psychological response to abuse — not a character flaw." },
                { term: "Gaslighting", def: "A form of manipulation where someone causes you to question your own perception, memory, or sanity. Examples include denying events happened, minimizing your feelings, or insisting you are overreacting." },
                { term: "Escalation risk after leaving", def: "Research shows that the period immediately after leaving is often the highest-risk time. Planning a safe exit, connecting with support services, and having a safety plan can help reduce this risk." },
                { term: "DARVO", def: "Deny, Attack, Reverse Victim and Offender. A common tactic where an abuser denies the behavior, attacks the person confronting them, and claims to be the real victim." },
                { term: "Lethality indicators", def: "Risk factors associated with the most dangerous situations: strangulation, weapon access, threats to kill, extreme jealousy, stalking behavior, and a recent separation." },
              ].map((t) => (
                <div key={t.term}>
                  <p className="text-sm font-medium text-gray-800">{t.term}</p>
                  <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{t.def}</p>
                </div>
              ))}
            </div>
          </AccordionSection>

          {/* ── Power and Control Wheel ── */}
          <AccordionSection id="wheel" title="Power and Control Wheel" open={open.has("wheel")} onToggle={() => toggle("wheel")}>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              The Power and Control Wheel was developed by the Domestic Abuse Intervention Programs in Duluth, MN.
              It illustrates how abusive tactics work together to maintain power over a partner.
              Tap a segment to see examples.
            </p>

            {/* SVG Wheel */}
            <div className="flex justify-center mb-4">
              <svg viewBox="-110 -110 220 220" className="w-full max-w-[280px]" aria-label="Power and Control Wheel">
                {/* Outer ring segments */}
                {WHEEL_SPOKES.map((spoke, i) => {
                  const total = WHEEL_SPOKES.length;
                  const angle = (2 * Math.PI) / total;
                  const startAngle = i * angle - Math.PI / 2;
                  const endAngle = startAngle + angle;
                  const gap = 0.04;
                  const outerR = 105;
                  const innerR = 42;

                  const x1 = Math.cos(startAngle + gap) * outerR;
                  const y1 = Math.sin(startAngle + gap) * outerR;
                  const x2 = Math.cos(endAngle - gap) * outerR;
                  const y2 = Math.sin(endAngle - gap) * outerR;
                  const x3 = Math.cos(endAngle - gap) * innerR;
                  const y3 = Math.sin(endAngle - gap) * innerR;
                  const x4 = Math.cos(startAngle + gap) * innerR;
                  const y4 = Math.sin(startAngle + gap) * innerR;

                  const midAngle = startAngle + angle / 2;
                  const textR = (outerR + innerR) / 2 + 2;
                  const tx = Math.cos(midAngle) * textR;
                  const ty = Math.sin(midAngle) * textR;

                  // Wrap long labels
                  const words = spoke.label.split(" ");
                  const lines: string[] = [];
                  let cur = "";
                  for (const w of words) {
                    if ((cur + " " + w).trim().length > 12) { lines.push(cur.trim()); cur = w; }
                    else cur += " " + w;
                  }
                  if (cur.trim()) lines.push(cur.trim());

                  const isSelected = wheelSpoke === i;

                  return (
                    <g key={i} onClick={() => setWheelSpoke(isSelected ? null : i)} style={{ cursor: "pointer" }}>
                      <path
                        d={`M ${x1} ${y1} A ${outerR} ${outerR} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 0 0 ${x4} ${y4} Z`}
                        fill={isSelected ? spoke.color : spoke.color + "cc"}
                        stroke="white"
                        strokeWidth="1.5"
                        className="transition-opacity"
                      />
                      {lines.map((line, li) => (
                        <text
                          key={li}
                          x={tx}
                          y={ty + (li - (lines.length - 1) / 2) * 7.5}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize="5.2"
                          fontWeight={isSelected ? "700" : "500"}
                          fill="white"
                          style={{ pointerEvents: "none", userSelect: "none" }}
                        >
                          {line}
                        </text>
                      ))}
                    </g>
                  );
                })}

                {/* Center circle */}
                <circle cx="0" cy="0" r="40" fill="#1e293b" />
                <text x="0" y="-7" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="white" style={{ userSelect: "none" }}>POWER</text>
                <text x="0" y="1" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="white" style={{ userSelect: "none" }}>AND</text>
                <text x="0" y="9" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="white" style={{ userSelect: "none" }}>CONTROL</text>
              </svg>
            </div>

            {/* Selected spoke detail */}
            {wheelSpoke !== null && (
              <div
                className="rounded-xl p-3 mb-4"
                style={{ backgroundColor: WHEEL_SPOKES[wheelSpoke].color + "18", borderLeft: `3px solid ${WHEEL_SPOKES[wheelSpoke].color}` }}
              >
                <p className="text-sm font-semibold text-gray-800 mb-1.5">{WHEEL_SPOKES[wheelSpoke].label}</p>
                <ul className="space-y-1">
                  {WHEEL_SPOKES[wheelSpoke].examples.map((ex, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-sm text-gray-700">
                      <span className="flex-shrink-0 text-gray-400 mt-0.5">•</span>
                      {ex}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* All spokes summary */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {WHEEL_SPOKES.map((spoke, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setWheelSpoke(wheelSpoke === i ? null : i)}
                  className="text-left px-2.5 py-2 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: wheelSpoke === i ? spoke.color + "20" : "#f9fafb",
                    color: wheelSpoke === i ? spoke.color : "#4b5563",
                    border: `1.5px solid ${wheelSpoke === i ? spoke.color : "#e5e7eb"}`,
                  }}
                >
                  {spoke.label}
                </button>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-3 flex flex-col gap-2">
              <a
                href="https://www.thehotline.org/identify-abuse/power-and-control/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-brand-600 font-medium hover:underline"
              >
                View &amp; print the official wheel at thehotline.org
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" /></svg>
              </a>
              <p className="text-xs text-gray-400">
                Power and Control Wheel concept developed by the Domestic Abuse Intervention Programs, Duluth, MN.
              </p>
            </div>
          </AccordionSection>

        </div>
      </NavShell>
    </>
  );
}
