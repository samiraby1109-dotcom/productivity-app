"use client";
/**
 * IndexedDB-backed offline upload queue.
 * Stores encrypted file blobs for retry when network is restored.
 */
import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "daybook_offline";
const DB_VERSION = 1;
const STORE_QUEUE = "upload_queue";
const STORE_TRACKER = "tracker_data";

interface UploadQueueItem {
  id: string;
  entryId: string;
  userId: string;
  encryptedBlob: ArrayBuffer;
  wrappedKey: string;
  wrappedKeyIv: string;
  mimeType: string;
  kind: "IMAGE" | "VIDEO" | "AUDIO";
  sizeBytes: number;
  createdAt: string;
  retries: number;
}

let _db: IDBPDatabase | null = null;

async function getDb(): Promise<IDBPDatabase> {
  if (_db) return _db;
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_TRACKER)) {
        db.createObjectStore(STORE_TRACKER, { keyPath: "id" });
      }
    },
  });
  return _db;
}

// ─── Upload Queue ─────────────────────────────────────────────────────────────
export async function enqueueUpload(item: UploadQueueItem): Promise<void> {
  const db = await getDb();
  await db.put(STORE_QUEUE, item);
}

export async function dequeueUpload(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_QUEUE, id);
}

export async function getPendingUploads(): Promise<UploadQueueItem[]> {
  const db = await getDb();
  return db.getAll(STORE_QUEUE);
}

export async function updateRetryCount(id: string): Promise<void> {
  const db = await getDb();
  const item = await db.get(STORE_QUEUE, id);
  if (item) {
    item.retries = (item.retries ?? 0) + 1;
    await db.put(STORE_QUEUE, item);
  }
}

// ─── Local Tracker Data (Decoy + Full productivity tasks) ─────────────────────
export interface TrackerTask {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
}

export interface TrackerNote {
  id: string;
  content: string;
  updatedAt: string;
}

export interface TrackerData {
  id: "main";
  tasks: TrackerTask[];
  notes: TrackerNote[];
  habits: { id: string; label: string; done: boolean }[];
  updatedAt: string;
}

export async function getTrackerData(): Promise<TrackerData | null> {
  const db = await getDb();
  return db.get(STORE_TRACKER, "main") as Promise<TrackerData | null>;
}

export async function saveTrackerData(data: TrackerData): Promise<void> {
  const db = await getDb();
  await db.put(STORE_TRACKER, { ...data, id: "main" });
}
