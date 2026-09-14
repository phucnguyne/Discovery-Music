// apps/api/src/lib/sync.ts
import { SSEStreamingApi } from 'hono/streaming';
import type { PlaybackSyncEvent } from '@music/types';

// In-memory connection manager for SSE streams.
// Map of userId -> Set of active SSE streams.
const connections = new Map<string, Set<SSEStreamingApi>>();

// If we were to scale this API to multiple instances, we would use Redis Pub/Sub here.
// e.g., redis.subscribe('playback-sync', (message) => { ... broadcast to local connections ... })

export function addSyncConnection(userId: string, stream: SSEStreamingApi) {
  let userConns = connections.get(userId);
  if (!userConns) {
    userConns = new Set();
    connections.set(userId, userConns);
  }
  userConns.add(stream);
  
  // Clean up when the stream aborts
  stream.onAbort(() => {
    removeSyncConnection(userId, stream);
  });
}

export function removeSyncConnection(userId: string, stream: SSEStreamingApi) {
  const userConns = connections.get(userId);
  if (userConns) {
    userConns.delete(stream);
    if (userConns.size === 0) {
      connections.delete(userId);
    }
  }
}

/**
 * Broadcasts a playback state to all connections for a specific user.
 */
export async function broadcastToUser(userId: string, event: PlaybackSyncEvent) {
  const userConns = connections.get(userId);
  if (!userConns) return;

  // For future Redis scale-out:
  // redis.publish(`playback:${userId}`, JSON.stringify(event));
  
  const promises = Array.from(userConns).map(async (stream) => {
    try {
      await stream.writeSSE({
        data: JSON.stringify(event),
        event: 'sync',
      });
    } catch (err) {
      // If a stream is dead but hasn't aborted yet, remove it
      removeSyncConnection(userId, stream);
    }
  });

  await Promise.all(promises);
}
