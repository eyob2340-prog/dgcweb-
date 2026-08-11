export interface QueuedSubmission {
  id: string;
  surveyId: number;
  demographics: any;
  answers: any[];
  timestamp: string;
}

const STORAGE_KEY = 'DGC_OFFLINE_SURVEY_QUEUE';

export function getOfflineQueue(): QueuedSubmission[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveToOfflineQueue(item: Omit<QueuedSubmission, 'id' | 'timestamp'>): QueuedSubmission {
  const queue = getOfflineQueue();
  const newItem: QueuedSubmission = {
    ...item,
    id: 'OFF-' + Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
  };
  queue.push(newItem);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  return newItem;
}

export function removeFromOfflineQueue(id: string) {
  const queue = getOfflineQueue().filter((item) => item.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export async function processOfflineQueue(onSuccessItem?: (item: QueuedSubmission) => void): Promise<{
  synced: number;
  failed: number;
}> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      const res = await fetch(`/api/surveys/${item.surveyId}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: item.answers,
          demographics: item.demographics,
        }),
      });

      if (res.ok) {
        removeFromOfflineQueue(item.id);
        synced++;
        if (onSuccessItem) onSuccessItem(item);
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}
