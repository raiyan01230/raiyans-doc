import { Response } from 'express';
import { SyncConflict, PrivateRecord } from '../src/types';
import { store } from './store';

interface SseSubscriber {
  userId: string;
  deviceId?: string;
  res: Response;
  connectedAt: string;
}

const subscribers = new Set<SseSubscriber>();

// Register new SSE client subscriber
export function addSseSubscriber(userId: string, deviceId: string | undefined, res: Response) {
  const subscriber: SseSubscriber = {
    userId,
    deviceId,
    res,
    connectedAt: new Date().toISOString(),
  };

  subscribers.add(subscriber);

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  // Send initial connection confirmation
  res.write(
    `event: connected\ndata: ${JSON.stringify({
      status: 'connected',
      timestamp: new Date().toISOString(),
      subscriberCount: subscribers.size,
    })}\n\n`
  );

  res.on('close', () => {
    subscribers.delete(subscriber);
  });
}

// Keep-alive ping every 15 seconds to prevent timeout
setInterval(() => {
  const pingData = `event: ping\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`;
  for (const sub of subscribers) {
    try {
      sub.res.write(pingData);
    } catch {
      subscribers.delete(sub);
    }
  }
}, 15000);

// Broadcast an event to all connected sessions for a given user
export function broadcastSyncEvent(
  userId: string,
  eventType: string,
  payload: Record<string, unknown>
) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const sub of subscribers) {
    if (sub.userId === userId) {
      try {
        sub.res.write(message);
      } catch {
        subscribers.delete(sub);
      }
    }
  }
}

// Detect update conflict
export function detectSyncConflict(
  existingRecord: PrivateRecord & { version?: number },
  clientBaseVersion?: number,
  clientDraft?: Partial<PrivateRecord>
): SyncConflict | null {
  const serverVersion = existingRecord.version || 1;

  // If client provided a base version and server version is higher, we have a conflict
  if (typeof clientBaseVersion === 'number' && clientBaseVersion < serverVersion) {
    return {
      recordId: existingRecord.id,
      serverRecord: {
        ...existingRecord,
        version: serverVersion,
      },
      clientRecord: {
        ...existingRecord,
        ...clientDraft,
        version: clientBaseVersion,
      },
      detectedAt: new Date().toISOString(),
    };
  }

  return null;
}

// Resolve sync conflict
export function resolveSyncConflict(params: {
  userId: string;
  recordId: string;
  resolution: 'keep_server' | 'overwrite_client' | 'merge';
  clientContent?: string;
  clientTitle?: string;
  clientTags?: string[];
  deviceId?: string;
  deviceLabel?: string;
}): PrivateRecord | null {
  const { userId, recordId, resolution, clientContent, clientTitle, clientTags, deviceId, deviceLabel } = params;
  const userRecords = store.records.get(userId) || [];
  const index = userRecords.findIndex(r => r.id === recordId);
  if (index === -1) return null;

  const serverRecord = userRecords[index];
  const currentVersion = (serverRecord as any).version || 1;
  const now = new Date().toISOString();

  if (resolution === 'keep_server') {
    // Keep server version as is, broadcast state
    broadcastSyncEvent(userId, 'record_synced', { record: serverRecord });
    return serverRecord as any;
  }

  if (resolution === 'overwrite_client') {
    // Overwrite server with client's submitted changes
    const updated: any = {
      ...serverRecord,
      title: clientTitle !== undefined ? clientTitle : serverRecord.title,
      content: clientContent !== undefined ? clientContent : serverRecord.content,
      tags: clientTags !== undefined ? clientTags : serverRecord.tags,
      version: currentVersion + 1,
      sync_version: currentVersion + 1,
      last_modified_device_id: deviceId,
      last_modified_device_label: deviceLabel,
      updated_at: now,
    };
    userRecords[index] = updated;
    broadcastSyncEvent(userId, 'record_updated', { record: updated, deviceId });
    return updated;
  }

  if (resolution === 'merge') {
    // Intelligently merge text and tags
    let mergedContent = serverRecord.content;
    if (clientContent && clientContent !== serverRecord.content) {
      mergedContent = `${serverRecord.content}\n\n--- MERGED FROM ${deviceLabel || 'REMOTE DEVICE'} (${now}) ---\n${clientContent}`;
    }

    const mergedTags = Array.from(
      new Set([...(serverRecord.tags || []), ...(clientTags || [])])
    );

    const updated: any = {
      ...serverRecord,
      title: clientTitle || serverRecord.title,
      content: mergedContent,
      tags: mergedTags,
      version: currentVersion + 1,
      sync_version: currentVersion + 1,
      last_modified_device_id: deviceId,
      last_modified_device_label: `Merged (${deviceLabel || 'Remote'})`,
      updated_at: now,
    };
    userRecords[index] = updated;
    broadcastSyncEvent(userId, 'record_updated', { record: updated, deviceId });
    return updated;
  }

  return null;
}
