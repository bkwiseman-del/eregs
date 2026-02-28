import {
  getAllSyncQueue,
  removeSyncItem,
  updateSyncItem,
  putAnnotation,
  deleteAnnotation as deleteAnnotationFromIDB,
  type SyncQueueItem,
} from "./db";
import type { ReaderAnnotation } from "@/lib/annotations";

const MAX_RETRIES = 3;

/** Process all pending sync queue items. Call on online event or after login. */
export async function processSyncQueue(): Promise<{
  succeeded: number;
  failed: number;
  reconciled: Map<string, string>; // localId -> serverId
}> {
  const queue = await getAllSyncQueue();
  let succeeded = 0;
  let failed = 0;
  const reconciled = new Map<string, string>();

  for (const item of queue) {
    try {
      switch (item.operation) {
        case "CREATE": {
          const res = await fetch("/api/annotations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.payload),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.id && item.localId && data.id !== item.localId) {
              reconciled.set(item.localId, data.id);
              // Update IDB: remove local-ID entry, store with server ID
              await deleteAnnotationFromIDB(item.localId);
              await putAnnotation({
                ...item.payload,
                id: data.id,
              } as ReaderAnnotation);
            }
            await removeSyncItem(item.queueId!);
            succeeded++;
          } else if (res.status === 401) {
            // Not authenticated — stop processing, retry after login
            break;
          } else {
            throw new Error(`HTTP ${res.status}`);
          }
          break;
        }

        case "UPDATE": {
          const res = await fetch("/api/annotations", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.payload),
          });
          if (res.ok) {
            await removeSyncItem(item.queueId!);
            succeeded++;
          } else if (res.status === 401) {
            break;
          } else {
            throw new Error(`HTTP ${res.status}`);
          }
          break;
        }

        case "DELETE": {
          const id = item.payload.id as string;
          const type = item.payload.type as string;
          const res = await fetch(
            `/api/annotations?id=${id}&type=${type}`,
            { method: "DELETE" }
          );
          if (res.ok || res.status === 404) {
            // 404 = already deleted — that's fine
            await removeSyncItem(item.queueId!);
            succeeded++;
          } else if (res.status === 401) {
            break;
          } else {
            throw new Error(`HTTP ${res.status}`);
          }
          break;
        }
      }
    } catch {
      // Network error or other failure — increment retry count
      if ((item.retryCount || 0) >= MAX_RETRIES) {
        await removeSyncItem(item.queueId!);
        failed++;
      } else {
        await updateSyncItem({
          ...item,
          retryCount: (item.retryCount || 0) + 1,
        });
        failed++;
      }
    }
  }

  return { succeeded, failed, reconciled };
}

/**
 * Register online listener to auto-process sync queue.
 * Call once on app startup. Returns cleanup function.
 */
export function startSyncListener(
  onReconcile?: (reconciled: Map<string, string>) => void
): () => void {
  const handler = async () => {
    const result = await processSyncQueue();
    if (result.reconciled.size > 0 && onReconcile) {
      onReconcile(result.reconciled);
    }
  };

  window.addEventListener("online", handler);

  // Also process immediately if currently online (handles app restart with pending items)
  if (navigator.onLine) {
    handler();
  }

  return () => window.removeEventListener("online", handler);
}
