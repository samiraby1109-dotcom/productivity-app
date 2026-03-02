"use client";
import { useState, useEffect, useCallback } from "react";
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
  updatedAt: new Date().toISOString(),
};

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

  // Load from IndexedDB
  useEffect(() => {
    getTrackerData().then((d) => {
      if (d) setData(d);
      setLoaded(true);
    });
  }, []);

  // Save to IndexedDB on change
  useEffect(() => {
    if (!loaded) return;
    saveTrackerData(data);
  }, [data, loaded]);

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

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  const completedCount = data.tasks.filter((t) => t.done).length;

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
        {/* Date heading */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">{today}</h1>
          {data.tasks.length > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">
              {completedCount} of {data.tasks.length} tasks done
            </p>
          )}
        </div>

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
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Habits</h2>
          <div className="grid grid-cols-3 gap-2">
            {data.habits.map((habit) => (
              <button
                key={habit.id}
                onClick={() => toggleHabit(habit.id)}
                className={`py-3 rounded-xl text-sm font-medium transition-all ${
                  habit.done
                    ? "bg-brand-500 text-white shadow-sm"
                    : "bg-white border border-gray-200 text-gray-600 hover:border-brand-300"
                }`}
              >
                {habit.label}
              </button>
            ))}
          </div>
        </section>

        {/* Notes */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Notes</h2>
          <textarea
            className="w-full p-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 transition min-h-[140px]"
            placeholder="Jot down anything…"
            value={data.notes[0]?.content ?? ""}
            onChange={(e) => {
              const content = e.target.value;
              setData((d) => ({
                ...d,
                notes: [{ id: "n1", content, updatedAt: new Date().toISOString() }],
                updatedAt: new Date().toISOString(),
              }));
            }}
          />
        </section>
      </NavShell>
    </>
  );
}
