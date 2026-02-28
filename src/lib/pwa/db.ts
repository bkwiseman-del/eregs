import type { EcfrSection, PartToc } from "@/lib/ecfr";
import type { ReaderAnnotation } from "@/lib/annotations";

const DB_NAME = "eregs-offline";
const DB_VERSION = 1;

// ── Types ──

export interface StoredPartData {
  part: string;
  toc: PartToc | null;
  sections: EcfrSection[];
  meta: { ecfrVersion: string | null; cachedAt: string | null };
  storedAt: string; // ISO timestamp when stored in IDB
}

export interface SyncQueueItem {
  queueId?: number; // auto-increment
  operation: "CREATE" | "UPDATE" | "DELETE";
  annotationType: "HIGHLIGHT" | "NOTE" | "BOOKMARK";
  localId?: string;
  serverId?: string;
  payload: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
}

// ── DB singleton ──

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains("reader-data")) {
        db.createObjectStore("reader-data", { keyPath: "part" });
      }

      if (!db.objectStoreNames.contains("annotations")) {
        const store = db.createObjectStore("annotations", { keyPath: "id" });
        store.createIndex("section", "section", { unique: false });
        store.createIndex("part", "part", { unique: false });
      }

      if (!db.objectStoreNames.contains("sync-queue")) {
        db.createObjectStore("sync-queue", {
          keyPath: "queueId",
          autoIncrement: true,
        });
      }

      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

// ── Generic helpers ──

async function tx(
  storeName: string,
  mode: IDBTransactionMode
): Promise<IDBObjectStore> {
  const db = await openDB();
  return db.transaction(storeName, mode).objectStore(storeName);
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ── Reader Data ──

export async function getStoredPartData(
  part: string
): Promise<StoredPartData | null> {
  const store = await tx("reader-data", "readonly");
  return promisify(store.get(part));
}

export async function storePartData(data: StoredPartData): Promise<void> {
  const store = await tx("reader-data", "readwrite");
  await promisify(store.put(data));
}

export async function getAllStoredParts(): Promise<string[]> {
  const store = await tx("reader-data", "readonly");
  return promisify(store.getAllKeys()) as Promise<string[]>;
}

export async function getPartCachedAt(part: string): Promise<string | null> {
  const data = await getStoredPartData(part);
  return data?.storedAt ?? null;
}

// ── Annotations ──

export async function getAnnotationsForSection(
  section: string
): Promise<ReaderAnnotation[]> {
  const store = await tx("annotations", "readonly");
  const index = store.index("section");
  return promisify(index.getAll(section));
}

export async function getAllAnnotations(): Promise<ReaderAnnotation[]> {
  const store = await tx("annotations", "readonly");
  return promisify(store.getAll());
}

export async function putAnnotation(
  annotation: ReaderAnnotation
): Promise<void> {
  const store = await tx("annotations", "readwrite");
  await promisify(store.put(annotation));
}

export async function deleteAnnotation(id: string): Promise<void> {
  const store = await tx("annotations", "readwrite");
  await promisify(store.delete(id));
}

export async function putAnnotations(
  annotations: ReaderAnnotation[]
): Promise<void> {
  const db = await openDB();
  const txn = db.transaction("annotations", "readwrite");
  const store = txn.objectStore("annotations");
  for (const a of annotations) {
    store.put(a);
  }
  return new Promise((resolve, reject) => {
    txn.oncomplete = () => resolve();
    txn.onerror = () => reject(txn.error);
  });
}

// ── Sync Queue ──

export async function enqueueSync(
  item: Omit<SyncQueueItem, "queueId">
): Promise<void> {
  const store = await tx("sync-queue", "readwrite");
  await promisify(store.add(item));
}

export async function getAllSyncQueue(): Promise<SyncQueueItem[]> {
  const store = await tx("sync-queue", "readonly");
  return promisify(store.getAll());
}

export async function removeSyncItem(queueId: number): Promise<void> {
  const store = await tx("sync-queue", "readwrite");
  await promisify(store.delete(queueId));
}

export async function updateSyncItem(item: SyncQueueItem): Promise<void> {
  const store = await tx("sync-queue", "readwrite");
  await promisify(store.put(item));
}

// ── Meta ──

export async function getMeta(key: string): Promise<unknown> {
  const store = await tx("meta", "readonly");
  const record = await promisify(store.get(key));
  return (record as { key: string; value: unknown } | undefined)?.value ?? null;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const store = await tx("meta", "readwrite");
  await promisify(store.put({ key, value }));
}
