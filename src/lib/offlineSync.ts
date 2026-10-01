import { getAnonymousClientId } from './clientId';

export interface QueuedSubmission {
  id: string;
  surveyId: number;
  demographics: any;
  answers: any[];
  timestamp: string;
}

const STORAGE_KEY = 'DGC_OFFLINE_SURVEY_QUEUE';

export function getOfflineQueue(): QueuedSubmission[] {
  // Clear any legacy survey responses from storage to protect citizen confidentiality on shared devices
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  return [];
}

export function saveToOfflineQueue(_item: Omit<QueuedSubmission, 'id' | 'timestamp'>): QueuedSubmission {
  // Disabled: Storing citizen demographics and opinions in unencrypted shared browser storage is prohibited for privacy.
  return {
    ..._item,
    id: 'OFF-TEMP',
    timestamp: new Date().toISOString(),
  };
}

export function removeFromOfflineQueue(_id: string) {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
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
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': getAnonymousClientId(),
        },
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
