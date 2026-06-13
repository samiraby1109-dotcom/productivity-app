"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import NavShell from "@/components/NavShell";
import IdleLock from "@/components/IdleLock";
import TrustedContactNudgeModal from "@/components/TrustedContactNudgeModal";
import {
  getTrackerData,
  saveTrackerData,
  type TrackerData,
  type TrackerTask,
} from "@/lib/offline-queue";

const DEFAULT_DATA: TrackerData = {
  id: "main",
  tasks: [],
  notes: [{ id: "n1", content: "", updatedAt: new Date().toISOString() }],
  habits: [
    { id: "h1", label: "Exercise", done: false },
    { id: "h2", label: "Read", done: false },
    { id: "h3", label: "Water", done: false },
  ],
  journal: [],
  moods: {},
  updatedAt: new Date().toISOString(),
};

const MOODS = [
  { v: 1, emoji: "😞", label: "Rough" },
  { v: 2, emoji: "😕", label: "Low" },
  { v: 3, emoji: "😐", label: "Okay" },
  { v: 4, emoji: "🙂", label: "Good" },
  { v: 5, emoji: "😄", label: "Great" },
];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function keyOfISO(iso: string): string {
  return dayKey(new Date(iso));
}

interface Props {
  mode: "FULL" | "DECOY";
  email: string;
  passwordSalt: string;
  showWelcomeNudge?: boolean;
}

export default function DashboardClient({ mode, email, passwordSalt, showWelcomeNudge = false }: Props) {
  const router = useRouter();
  const [data, setData] = useState<TrackerData>(DEFAULT_DATA);
  const [newTask, setNewTask] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [showNudge, setShowNudge] = useState(showWelcomeNudge);
  const [newHabit, setNewHabit] = useState("");
  const [editingHabits, setEditingHabits] = useState(false);
  const [newJournal, setNewJournal] = useState("");

  // Load from IndexedDB
  useEffect(() => {
    getTrackerData().then((d) => {
      if (d) {
        const migrated: TrackerData = { ...d, journal: d.journal ?? [], moods: d.moods ?? {} };
        // Carry a legacy single note into the journal so nothing is lost.
        if ((migrated.journal?.length ?? 0) === 0 && d.notes?.[0]?.content?.trim()) {
          migrated.journal = [{ id: uuidv4(), dateISO: d.notes[0].updatedAt ?? new Date().toISOString(), text: d.notes[0].content.trim() }];
        }
        setData(migrated);
      }
      setLoaded(true);
    });
  }, []);

  // Save to IndexedDB on change, debounced — the notes textarea otherwise
  // issues a full write per keystroke. Pending writes are flushed when the tab
  // hides or unmounts so Quick Exit / app close can't drop the last keystrokes.
  const latestData = useRef(data);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    latestData.current = data;
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      saveTrackerData(latestData.current);
    }, 500);
  }, [data, loaded]);

  useEffect(() => {
    function flush() {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        saveTrackerData(latestData.current);
      }
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") flush();
    }
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, []);

  const addTask = useCallback(() => {
    if (!newTask.trim()) return;
    const task: TrackerTask = {
      id: uuidv4(),
      text: newTask.trim(),
      done: false,
      createdAt: new Date().toISOString(),
    };
    setData((d) => ({ ...d, tasks: [task, ...d.tasks], updatedAt: new Date().toISOString() }));
    setNewTask("");
  }, [newTask]);

  const toggleTask = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      tasks: d.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      tasks: d.tasks.filter((t) => t.id !== id),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const toggleHabit = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      habits: d.habits.map((h) => (h.id === id ? { ...h, done: !h.done } : h)),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const addHabit = useCallback(() => {
    const label = newHabit.trim();
    if (!label) return;
    setData((d) => ({
      ...d,
      habits: [...d.habits, { id: uuidv4(), label, done: false }],
      updatedAt: new Date().toISOString(),
    }));
    setNewHabit("");
  }, [newHabit]);

  const removeHabit = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      habits: d.habits.filter((h) => h.id !== id),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const todayKey = dayKey(new Date());

  const setMood = useCallback((v: number) => {
    setData((d) => ({
      ...d,
      moods: { ...(d.moods ?? {}), [todayKey]: v },
      updatedAt: new Date().toISOString(),
    }));
  }, [todayKey]);

  const addJournal = useCallback(() => {
    const text = newJournal.trim();
    if (!text) return;
    setData((d) => ({
      ...d,
      journal: [{ id: uuidv4(), dateISO: new Date().toISOString(), text }, ...(d.journal ?? [])],
      updatedAt: new Date().toISOString(),
    }));
    setNewJournal("");
  }, [newJournal]);

  const deleteJournal = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      journal: (d.journal ?? []).filter((j) => j.id !== id),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const completedCount = data.tasks.filter((t) => t.done).length;

  // "Active days" = days with a mood check-in or a journal entry. The streak is
  // the run of consecutive active days ending today (or yesterday, so it isn't
  // broken just because today's check-in hasn't happened yet).
  const activeDays = new Set<string>();
  Object.keys(data.moods ?? {}).forEach((k) => activeDays.add(k));
  (data.journal ?? []).forEach((j) => activeDays.add(keyOfISO(j.dateISO)));
  let streak = 0;
  {
    const cur = new Date();
    if (!activeDays.has(dayKey(cur))) cur.setDate(cur.getDate() - 1);
    while (activeDays.has(dayKey(cur))) { streak++; cur.setDate(cur.getDate() - 1); }
  }
  const todayMood = (data.moods ?? {})[todayKey];
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const k = dayKey(d);
    return { key: k, label: d.toLocaleDateString("en-US", { weekday: "narrow" }), mood: (data.moods ?? {})[k] };
  });

  function handleDismissNudge() {
    setShowNudge(false);
    // Remove ?welcome=1 from the URL without a page reload
    router.replace("/dashboard", { scroll: false });
  }

  return (
    <>
      {showNudge && (
        <TrustedContactNudgeModal
          title="Add a trusted contact"
          message="Consider adding someone you trust — a DV advocate, attorney, or close friend — so they can help you access your records if you ever need it."
          onDismiss={handleDismissNudge}
        />
      )}
      <IdleLock mode={mode} email={email} passwordSalt={passwordSalt} />
      <NavShell mode={mode}>
        {/* Greeting */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">{greeting}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{today}</p>
          {data.tasks.length > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              {completedCount} of {data.tasks.length} tasks done
            </p>
          )}
        </div>

        {streak >= 2 && (
          <div className="mb-5 flex items-center gap-2 rounded-xl bg-brand-50 border border-brand-100 px-4 py-2.5">
            <span className="text-lg" aria-hidden>✨</span>
            <p className="text-sm text-brand-800">
              <span className="font-semibold">{streak}-day streak</span> — you&apos;ve checked in {streak} days in a row.
            </p>
          </div>
        )}

        {/* Mood check-in */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">How are you feeling?</h2>
          <div className="flex justify-between gap-2">
            {MOODS.map((m) => (
              <button
                key={m.v}
                onClick={() => setMood(m.v)}
                aria-label={m.label}
                aria-pressed={todayMood === m.v}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all ${
                  todayMood === m.v ? "bg-brand-50 border-brand-300" : "bg-white border-gray-200 hover:border-brand-200"
                }`}
              >
                <span className="text-2xl leading-none" aria-hidden>{m.emoji}</span>
                <span className="text-[10px] text-gray-500">{m.label}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between px-1">
            {last7.map((d) => (
              <div key={d.key} className="flex flex-col items-center gap-1">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm ${d.mood ? "bg-brand-100" : "bg-gray-100"}`} aria-hidden>
                  {d.mood ? MOODS[d.mood - 1].emoji : ""}
                </span>
                <span className="text-[10px] text-gray-400">{d.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Tasks */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Today&apos;s Tasks</h2>

          {/* Add task */}
          <form
            onSubmit={(e) => { e.preventDefault(); addTask(); }}
            className="flex gap-2 mb-3"
          >
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="Add a task…"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              Add
            </button>
          </form>

          {/* Task list */}
          <div className="space-y-1">
            {data.tasks.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No tasks yet — add one above.</p>
            )}
            {data.tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100 group"
              >
                <button
                  onClick={() => toggleTask(task.id)}
                  className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    task.done
                      ? "bg-brand-500 border-brand-500"
                      : "border-gray-300 hover:border-brand-400"
                  }`}
                  aria-label={task.done ? "Mark incomplete" : "Mark complete"}
                >
                  {task.done && (
                    <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <span className={`flex-1 text-sm ${task.done ? "line-through text-gray-400" : "text-gray-800"}`}>
                  {task.text}
                </span>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all"
                  aria-label="Remove task"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Habits */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Habits</h2>
            <button
              onClick={() => setEditingHabits((v) => !v)}
              className="text-xs text-gray-400 hover:text-brand-600 transition-colors"
            >
              {editingHabits ? "Done" : "Edit"}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {data.habits.map((habit) => (
              <div key={habit.id} className="relative">
                <button
                  onClick={() => toggleHabit(habit.id)}
                  disabled={editingHabits}
                  className={`w-full py-3 rounded-xl text-sm font-medium transition-all ${
                    habit.done
                      ? "bg-brand-500 text-white shadow-sm"
                      : "bg-white border border-gray-200 text-gray-600 hover:border-brand-300"
                  }`}
                >
                  {habit.label}
                </button>
                {editingHabits && (
                  <button
                    onClick={() => removeHabit(habit.id)}
                    aria-label={`Remove ${habit.label}`}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-200 text-gray-600 hover:bg-red-100 hover:text-red-500 flex items-center justify-center shadow-sm"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            ))}
          </div>
          {editingHabits && (
            <form onSubmit={(e) => { e.preventDefault(); addHabit(); }} className="flex gap-2 mt-2">
              <input
                value={newHabit}
                onChange={(e) => setNewHabit(e.target.value)}
                placeholder="Add a habit…"
                maxLength={24}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
              />
              <button type="submit" className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors">Add</button>
            </form>
          )}
        </section>

        {/* Journal */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Journal</h2>
          <form onSubmit={(e) => { e.preventDefault(); addJournal(); }} className="mb-3">
            <textarea
              value={newJournal}
              onChange={(e) => setNewJournal(e.target.value)}
              placeholder="Write a few lines about your day…"
              className="w-full p-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 transition min-h-[90px]"
            />
            <div className="flex justify-end mt-2">
              <button
                type="submit"
                disabled={!newJournal.trim()}
                className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                Save entry
              </button>
            </div>
          </form>
          <div className="space-y-2">
            {(data.journal ?? []).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No entries yet — your past reflections will appear here.</p>
            )}
            {(data.journal ?? []).map((j) => (
              <div key={j.id} className="bg-white rounded-xl border border-gray-100 p-3 group">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-400">
                    {new Date(j.dateISO).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </p>
                  <button
                    onClick={() => deleteJournal(j.id)}
                    aria-label="Delete entry"
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{j.text}</p>
              </div>
            ))}
          </div>
        </section>
      </NavShell>
    </>
  );
}
