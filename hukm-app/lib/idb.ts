/**
 * HUKM — IndexedDB cache for offline analyses.
 *
 * When the user is offline (or on flaky network), the PWA shell still
 * lets them browse analyses they've previously viewed. We mirror each
 * fetched `/results/[id]` record into IndexedDB; the offline page reads
 * from this store.
 *
 * All functions are no-ops in non-browser environments (SSR, build
 * time) so they're safe to import from anywhere.
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { AnalysisResult, LawChunk } from "./types";

interface HukmDB extends DBSchema {
  analyses: {
    key: string;
    value: StoredAnalysis;
    indexes: { createdAt: string };
  };
}

export interface StoredAnalysis {
  id: string;
  scenario: string;
  modelId: string;
  result: AnalysisResult;
  retrievedChunks: LawChunk[];
  created_at: string;
}

const DB_NAME = "hukm-db";
const DB_VERSION = 1;
const STORE = "analyses";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

let cached: Promise<IDBPDatabase<HukmDB>> | null = null;

function getDB(): Promise<IDBPDatabase<HukmDB>> | null {
  if (!isBrowser()) return null;
  if (!cached) {
    cached = openDB<HukmDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("createdAt", "created_at");
        }
      },
    });
  }
  return cached;
}

export async function saveAnalysis(record: StoredAnalysis): Promise<void> {
  const dbPromise = getDB();
  if (!dbPromise) return;
  try {
    const db = await dbPromise;
    await db.put(STORE, record);
  } catch {
    // IndexedDB can fail in private mode / disabled storage. Swallow.
  }
}

export async function getAllAnalyses(): Promise<StoredAnalysis[]> {
  const dbPromise = getDB();
  if (!dbPromise) return [];
  try {
    const db = await dbPromise;
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const index = store.index("createdAt");
    const all = await index.getAll();
    return all.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  } catch {
    return [];
  }
}

export async function getAnalysis(id: string): Promise<StoredAnalysis | null> {
  const dbPromise = getDB();
  if (!dbPromise) return null;
  try {
    const db = await dbPromise;
    const value = await db.get(STORE, id);
    return value ?? null;
  } catch {
    return null;
  }
}

export async function deleteAnalysis(id: string): Promise<void> {
  const dbPromise = getDB();
  if (!dbPromise) return;
  try {
    const db = await dbPromise;
    await db.delete(STORE, id);
  } catch {
    // Ignore.
  }
}
